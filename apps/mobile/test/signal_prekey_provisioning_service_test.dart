import 'package:flutter_test/flutter_test.dart';
import 'package:whisp_mobile/core/libsignal_bridge.dart';
import 'package:whisp_mobile/core/secure_storage.dart';
import 'package:whisp_mobile/features/identity/data/prekey_bundle_remote_data_source.dart';
import 'package:whisp_mobile/features/identity/domain/signal_prekey_provisioning_service.dart';

class InMemorySecureStorage implements SecureStorage {
  final Map<String, String> _store = <String, String>{};

  @override
  Future<void> delete({required String key}) async {
    _store.remove(key);
  }

  @override
  Future<String?> read({required String key}) async => _store[key];

  @override
  Future<void> write({required String key, required String value}) async {
    _store[key] = value;
  }
}

class FakeLibsignalBridge implements LibsignalBridge {
  int _identityCounter = 0;
  bool _forceInvalidSignature = false;

  void setForceInvalidSignature(bool enabled) {
    _forceInvalidSignature = enabled;
  }

  @override
  Future<SignalKeyPair> createIdentityKeyPair() async {
    _identityCounter += 1;
    return SignalKeyPair(
      publicKeyBase64: 'identity-public-$_identityCounter',
      privateKeyBase64: 'identity-private-$_identityCounter',
    );
  }

  @override
  Future<SignedPreKeyMaterial> createSignedPreKey({
    required String identityPrivateKeyBase64,
  }) async {
    return SignedPreKeyMaterial(
      signedPreKeyId: 100 + _identityCounter,
      publicKeyBase64: 'signed-public-$identityPrivateKeyBase64',
      privateKeyBase64: 'signed-private-$identityPrivateKeyBase64',
      signatureBase64: 'sig:$identityPrivateKeyBase64',
    );
  }

  @override
  Future<List<OneTimePreKeyMaterial>> createOneTimePreKeys({
    required int count,
  }) async {
    return List<OneTimePreKeyMaterial>.generate(
      count,
      (index) => OneTimePreKeyMaterial(
        preKeyId: 1000 + index,
        publicKeyBase64: 'opk-public-$index',
        privateKeyBase64: 'opk-private-$index',
      ),
      growable: false,
    );
  }

  @override
  Future<bool> verifySignedPreKey({
    required String identityPublicKeyBase64,
    required String signedPreKeyPublicBase64,
    required String signatureBase64,
  }) async {
    if (_forceInvalidSignature) {
      return false;
    }
    return signatureBase64.startsWith('sig:');
  }
}

class FakePrekeyBundleRemoteDataSource implements PrekeyBundleRemoteDataSource {
  int uploadCalls = 0;
  PreKeyBundleUploadPayload? lastUpload;
  int? failUploadWithStatusCode;

  @override
  Future<PeerPreKeyBundle> fetchPeerPrekeyBundle({
    required String wid,
    required String deviceId,
  }) async {
    return PeerPreKeyBundle(
      wid: wid,
      deviceId: deviceId,
      identityKey: 'peer-identity-$wid-$deviceId',
      signedPreKeyPublic: 'peer-signed-public-$wid-$deviceId',
      signedPreKeySignature: 'sig:peer',
      oneTimePreKeyId: 1,
      oneTimePreKeyPublic: 'peer-opk',
    );
  }

  @override
  Future<void> uploadPrekeyBundle(PreKeyBundleUploadPayload payload) async {
    uploadCalls += 1;
    if (failUploadWithStatusCode != null) {
      throw IdentityApiException(
        statusCode: failUploadWithStatusCode!,
        message: 'forced failure',
      );
    }
    lastUpload = payload;
  }
}

void main() {
  group('SignalPrekeyProvisioningService', () {
    late InMemorySecureStorage secureStorage;
    late FakeLibsignalBridge libsignalBridge;
    late FakePrekeyBundleRemoteDataSource remoteDataSource;
    late SignalPrekeyProvisioningService service;

    setUp(() {
      secureStorage = InMemorySecureStorage();
      libsignalBridge = FakeLibsignalBridge();
      remoteDataSource = FakePrekeyBundleRemoteDataSource();
      service = SignalPrekeyProvisioningService(
        secureStorage: secureStorage,
        libsignalBridge: libsignalBridge,
        remoteDataSource: remoteDataSource,
      );
    });

    test('persists identity key material per device and reuses it', () async {
      final first = await service.prepareAndUploadBundle(
        wid: 'wid-1',
        deviceId: 'device-1',
        oneTimePreKeyCount: 3,
      );
      final second = await service.prepareAndUploadBundle(
        wid: 'wid-1',
        deviceId: 'device-1',
        oneTimePreKeyCount: 3,
      );

      expect(first.identityPublicKey, equals(second.identityPublicKey));
      expect(remoteDataSource.uploadCalls, equals(2));
    });

    test('uploads bundle with expected one-time prekey pool size', () async {
      await service.prepareAndUploadBundle(
        wid: 'wid-upload',
        deviceId: 'device-upload',
        oneTimePreKeyCount: 5,
      );

      final uploaded = remoteDataSource.lastUpload;
      expect(uploaded, isNotNull);
      expect(uploaded!.oneTimePreKeys.length, equals(5));
      expect(uploaded.signedPreKeySignature, isNotEmpty);
    });

    test('validates one-time prekey pool size bounds', () async {
      expect(
        () => service.prepareAndUploadBundle(
          wid: 'wid-1',
          deviceId: 'device-1',
          oneTimePreKeyCount: 0,
        ),
        throwsArgumentError,
      );
      expect(
        () => service.prepareAndUploadBundle(
          wid: 'wid-1',
          deviceId: 'device-1',
          oneTimePreKeyCount: 1001,
        ),
        throwsArgumentError,
      );
    });

    test('maps server 409 during reinstall to explicit reset-required exception', () async {
      await service.prepareAndUploadBundle(
        wid: 'wid-reinstall',
        deviceId: 'device-reinstall',
        oneTimePreKeyCount: 2,
      );
      await service.clearLocalMaterialForDevice(
        wid: 'wid-reinstall',
        deviceId: 'device-reinstall',
      );
      remoteDataSource.failUploadWithStatusCode = 409;

      expect(
        () => service.prepareAndUploadBundle(
          wid: 'wid-reinstall',
          deviceId: 'device-reinstall',
          oneTimePreKeyCount: 2,
        ),
        throwsA(isA<IdentityResetRequiredException>()),
      );
    });

    test('verifies peer signed prekey and fails closed on invalid signature', () async {
      await service.verifyPeerBundle(
        const PeerPreKeyBundle(
          wid: 'wid-peer',
          deviceId: 'device-peer',
          identityKey: 'peer-identity',
          signedPreKeyPublic: 'peer-spk',
          signedPreKeySignature: 'sig:peer',
          oneTimePreKeyId: 1,
          oneTimePreKeyPublic: 'peer-opk',
        ),
      );

      libsignalBridge.setForceInvalidSignature(true);
      expect(
        () => service.verifyPeerBundle(
          const PeerPreKeyBundle(
            wid: 'wid-peer-bad',
            deviceId: 'device-peer-bad',
            identityKey: 'peer-identity-bad',
            signedPreKeyPublic: 'peer-spk-bad',
            signedPreKeySignature: 'sig:peer-bad',
            oneTimePreKeyId: 2,
            oneTimePreKeyPublic: 'peer-opk-bad',
          ),
        ),
        throwsA(isA<IdentityVerificationException>()),
      );
    });

    test('blocks identity key change after TOFU trust record', () async {
      await service.verifyPeerBundle(
        const PeerPreKeyBundle(
          wid: 'wid-trust',
          deviceId: 'device-trust',
          identityKey: 'identity-v1',
          signedPreKeyPublic: 'spk-v1',
          signedPreKeySignature: 'sig:v1',
          oneTimePreKeyId: 1,
          oneTimePreKeyPublic: 'opk-v1',
        ),
      );

      expect(
        () => service.verifyPeerBundle(
          const PeerPreKeyBundle(
            wid: 'wid-trust',
            deviceId: 'device-trust',
            identityKey: 'identity-v2',
            signedPreKeyPublic: 'spk-v2',
            signedPreKeySignature: 'sig:v2',
            oneTimePreKeyId: 2,
            oneTimePreKeyPublic: 'opk-v2',
          ),
        ),
        throwsA(isA<IdentityVerificationException>()),
      );
    });
  });
}
