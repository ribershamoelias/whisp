import 'dart:convert';

import '../../../core/libsignal_bridge.dart';
import '../../../core/secure_storage.dart';
import '../data/prekey_bundle_remote_data_source.dart';

class IdentityResetRequiredException implements Exception {
  IdentityResetRequiredException(this.message);

  final String message;

  @override
  String toString() => 'IdentityResetRequiredException: $message';
}

class IdentityVerificationException implements Exception {
  IdentityVerificationException(this.message);

  final String message;

  @override
  String toString() => 'IdentityVerificationException: $message';
}

class DeviceKeySnapshot {
  const DeviceKeySnapshot({
    required this.wid,
    required this.deviceId,
    required this.identityPublicKey,
    required this.signedPreKeyId,
    required this.oneTimePreKeyCount,
  });

  final String wid;
  final String deviceId;
  final String identityPublicKey;
  final int signedPreKeyId;
  final int oneTimePreKeyCount;
}

class SignalPrekeyProvisioningService {
  SignalPrekeyProvisioningService({
    required SecureStorage secureStorage,
    required LibsignalBridge libsignalBridge,
    required PrekeyBundleRemoteDataSource remoteDataSource,
  })  : _secureStorage = secureStorage,
        _libsignalBridge = libsignalBridge,
        _remoteDataSource = remoteDataSource;

  static const int defaultOneTimePreKeyCount = 100;
  static const int maxOneTimePreKeyCount = 1000;

  final SecureStorage _secureStorage;
  final LibsignalBridge _libsignalBridge;
  final PrekeyBundleRemoteDataSource _remoteDataSource;

  Future<DeviceKeySnapshot> prepareAndUploadBundle({
    required String wid,
    required String deviceId,
    int oneTimePreKeyCount = defaultOneTimePreKeyCount,
  }) async {
    _validateInputs(
      wid: wid,
      deviceId: deviceId,
      oneTimePreKeyCount: oneTimePreKeyCount,
    );

    final localMaterial =
        await _loadOrCreateLocalMaterial(wid: wid, deviceId: deviceId, preKeyCount: oneTimePreKeyCount);

    final payload = PreKeyBundleUploadPayload(
      wid: wid,
      deviceId: deviceId,
      identityKey: localMaterial.identityPublicKey,
      signedPreKeyId: localMaterial.signedPreKeyId,
      signedPreKeyPublic: localMaterial.signedPreKeyPublic,
      signedPreKeySignature: localMaterial.signedPreKeySignature,
      oneTimePreKeys: localMaterial.oneTimePreKeys
          .map(
            (prekey) => OneTimePreKeyUpload(
              prekeyId: prekey.preKeyId,
              publicKey: prekey.publicKeyBase64,
            ),
          )
          .toList(growable: false),
    );

    try {
      await _remoteDataSource.uploadPrekeyBundle(payload);
    } on IdentityApiException catch (error) {
      if (error.statusCode == 409) {
        throw IdentityResetRequiredException(
          'server rejected upload due to immutable identity material; trust reset required',
        );
      }
      rethrow;
    }

    await _secureStorage.write(
      key: _bundleUploadedKey(wid, deviceId),
      value: DateTime.now().toUtc().toIso8601String(),
    );

    return DeviceKeySnapshot(
      wid: wid,
      deviceId: deviceId,
      identityPublicKey: localMaterial.identityPublicKey,
      signedPreKeyId: localMaterial.signedPreKeyId,
      oneTimePreKeyCount: localMaterial.oneTimePreKeys.length,
    );
  }

  Future<void> verifyPeerBundle(PeerPreKeyBundle bundle) async {
    final trustKey = _peerIdentityTrustKey(bundle.wid, bundle.deviceId);
    final trustedIdentity = await _secureStorage.read(key: trustKey);
    if (trustedIdentity == null) {
      await _secureStorage.write(key: trustKey, value: bundle.identityKey);
    } else if (trustedIdentity != bundle.identityKey) {
      throw IdentityVerificationException('identity key changed for ${bundle.wid}/${bundle.deviceId}');
    }

    final signatureValid = await _libsignalBridge.verifySignedPreKey(
      identityPublicKeyBase64: bundle.identityKey,
      signedPreKeyPublicBase64: bundle.signedPreKeyPublic,
      signatureBase64: bundle.signedPreKeySignature,
    );
    if (!signatureValid) {
      throw IdentityVerificationException('invalid signed prekey signature');
    }
  }

  Future<void> clearLocalMaterialForDevice({
    required String wid,
    required String deviceId,
  }) async {
    await _secureStorage.delete(key: _deviceMaterialKey(wid, deviceId));
    await _secureStorage.delete(key: _bundleUploadedKey(wid, deviceId));
  }

  Future<_DeviceLocalMaterial> _loadOrCreateLocalMaterial({
    required String wid,
    required String deviceId,
    required int preKeyCount,
  }) async {
    final storageKey = _deviceMaterialKey(wid, deviceId);
    final existing = await _secureStorage.read(key: storageKey);
    if (existing != null && existing.isNotEmpty) {
      return _DeviceLocalMaterial.fromJson(existing);
    }

    final identity = await _libsignalBridge.createIdentityKeyPair();
    final signed = await _libsignalBridge.createSignedPreKey(
      identityPrivateKeyBase64: identity.privateKeyBase64,
    );
    final oneTime = await _libsignalBridge.createOneTimePreKeys(count: preKeyCount);
    final created = _DeviceLocalMaterial(
      identityPublicKey: identity.publicKeyBase64,
      identityPrivateKey: identity.privateKeyBase64,
      signedPreKeyId: signed.signedPreKeyId,
      signedPreKeyPublic: signed.publicKeyBase64,
      signedPreKeyPrivate: signed.privateKeyBase64,
      signedPreKeySignature: signed.signatureBase64,
      oneTimePreKeys: oneTime,
    );
    await _secureStorage.write(key: storageKey, value: created.toJson());
    return created;
  }

  void _validateInputs({
    required String wid,
    required String deviceId,
    required int oneTimePreKeyCount,
  }) {
    if (wid.trim().isEmpty) {
      throw ArgumentError.value(wid, 'wid', 'must be non-empty');
    }
    if (deviceId.trim().isEmpty) {
      throw ArgumentError.value(deviceId, 'deviceId', 'must be non-empty');
    }
    if (oneTimePreKeyCount < 1 || oneTimePreKeyCount > maxOneTimePreKeyCount) {
      throw ArgumentError.value(
        oneTimePreKeyCount,
        'oneTimePreKeyCount',
        'must be in range 1..$maxOneTimePreKeyCount',
      );
    }
  }

  String _deviceMaterialKey(String wid, String deviceId) => 'signal:device:$wid:$deviceId:material';

  String _bundleUploadedKey(String wid, String deviceId) => 'signal:device:$wid:$deviceId:last_upload_at';

  String _peerIdentityTrustKey(String wid, String deviceId) => 'signal:trust:$wid:$deviceId:identity_key';
}

class _DeviceLocalMaterial {
  const _DeviceLocalMaterial({
    required this.identityPublicKey,
    required this.identityPrivateKey,
    required this.signedPreKeyId,
    required this.signedPreKeyPublic,
    required this.signedPreKeyPrivate,
    required this.signedPreKeySignature,
    required this.oneTimePreKeys,
  });

  final String identityPublicKey;
  final String identityPrivateKey;
  final int signedPreKeyId;
  final String signedPreKeyPublic;
  final String signedPreKeyPrivate;
  final String signedPreKeySignature;
  final List<OneTimePreKeyMaterial> oneTimePreKeys;

  String toJson() {
    return jsonEncode({
      'identity_public_key': identityPublicKey,
      'identity_private_key': identityPrivateKey,
      'signed_prekey_id': signedPreKeyId,
      'signed_prekey_public': signedPreKeyPublic,
      'signed_prekey_private': signedPreKeyPrivate,
      'signed_prekey_signature': signedPreKeySignature,
      'one_time_prekeys': oneTimePreKeys
          .map(
            (prekey) => {
              'prekey_id': prekey.preKeyId,
              'public_key': prekey.publicKeyBase64,
              'private_key': prekey.privateKeyBase64,
            },
          )
          .toList(growable: false),
    });
  }

  static _DeviceLocalMaterial fromJson(String input) {
    final decoded = jsonDecode(input);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('invalid stored device material');
    }

    final oneTimePrekeysRaw = decoded['one_time_prekeys'];
    if (oneTimePrekeysRaw is! List) {
      throw const FormatException('invalid stored one-time prekeys');
    }

    return _DeviceLocalMaterial(
      identityPublicKey: decoded['identity_public_key'] as String,
      identityPrivateKey: decoded['identity_private_key'] as String,
      signedPreKeyId: decoded['signed_prekey_id'] as int,
      signedPreKeyPublic: decoded['signed_prekey_public'] as String,
      signedPreKeyPrivate: decoded['signed_prekey_private'] as String,
      signedPreKeySignature: decoded['signed_prekey_signature'] as String,
      oneTimePreKeys: oneTimePrekeysRaw
          .map((item) {
            final map = item as Map<String, dynamic>;
            return OneTimePreKeyMaterial(
              preKeyId: map['prekey_id'] as int,
              publicKeyBase64: map['public_key'] as String,
              privateKeyBase64: map['private_key'] as String,
            );
          })
          .toList(growable: false),
    );
  }
}
