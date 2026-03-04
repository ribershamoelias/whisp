import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:whisp_mobile/core/libsignal_bridge.dart';
import 'package:whisp_mobile/core/secure_storage.dart';
import 'package:whisp_mobile/features/identity/data/prekey_bundle_remote_data_source.dart';
import 'package:whisp_mobile/features/identity/domain/signal_prekey_provisioning_service.dart';
import 'package:whisp_mobile/features/messaging/domain/signal_session_service.dart';

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

class FakePrekeyDirectory implements PrekeyBundleRemoteDataSource {
  FakePrekeyDirectory(this.bundle);

  PeerPreKeyBundle bundle;

  @override
  Future<PeerPreKeyBundle> fetchPeerPrekeyBundle({
    required String wid,
    required String deviceId,
  }) async {
    return bundle;
  }

  @override
  Future<void> uploadPrekeyBundle(PreKeyBundleUploadPayload payload) async {}
}

void main() {
  group('SignalSessionService', () {
    late InMemorySecureStorage senderStorage;
    late InMemorySecureStorage receiverStorage;
    late NativeLibsignalBridge bridge;
    late FakePrekeyDirectory prekeyDirectory;
    late SignalPrekeyProvisioningService senderProvisioning;
    late SignalPrekeyProvisioningService receiverProvisioning;
    late SignalSessionService senderSessionService;
    late SignalSessionService receiverSessionService;

    setUp(() async {
      senderStorage = InMemorySecureStorage();
      receiverStorage = InMemorySecureStorage();
      bridge = NativeLibsignalBridge();

      prekeyDirectory = FakePrekeyDirectory(
        const PeerPreKeyBundle(
          wid: 'wid-b',
          deviceId: 'device-b1',
          identityKey: 'placeholder',
          signedPreKeyPublic: 'placeholder',
          signedPreKeySignature: 'placeholder',
          oneTimePreKeyId: 1,
          oneTimePreKeyPublic: 'placeholder',
        ),
      );

      senderProvisioning = SignalPrekeyProvisioningService(
        secureStorage: senderStorage,
        libsignalBridge: bridge,
        remoteDataSource: prekeyDirectory,
      );

      receiverProvisioning = SignalPrekeyProvisioningService(
        secureStorage: receiverStorage,
        libsignalBridge: bridge,
        remoteDataSource: prekeyDirectory,
      );

      final senderSnapshot = await senderProvisioning.prepareAndUploadBundle(
        wid: 'wid-a',
        deviceId: 'device-a1',
        oneTimePreKeyCount: 2,
      );
      final receiverSnapshot = await receiverProvisioning.prepareAndUploadBundle(
        wid: 'wid-b',
        deviceId: 'device-b1',
        oneTimePreKeyCount: 2,
      );
      final receiverMaterialRaw =
          await receiverStorage.read(key: 'signal:device:wid-b:device-b1:material');
      final receiverMaterial = jsonDecode(receiverMaterialRaw!) as Map<String, dynamic>;
      final receiverOpk =
          (receiverMaterial['one_time_prekeys'] as List<dynamic>).first as Map<String, dynamic>;

      prekeyDirectory.bundle = PeerPreKeyBundle(
        wid: 'wid-b',
        deviceId: 'device-b1',
        identityKey: receiverSnapshot.identityPublicKey,
        signedPreKeyPublic: receiverMaterial['signed_prekey_public'] as String,
        signedPreKeySignature: receiverMaterial['signed_prekey_signature'] as String,
        oneTimePreKeyId: receiverOpk['prekey_id'] as int,
        oneTimePreKeyPublic: receiverOpk['public_key'] as String,
      );

      await receiverStorage.write(
        key: 'signal:trust:wid-a:device-a1:identity_key',
        value: senderSnapshot.identityPublicKey,
      );

      senderSessionService = SignalSessionService(
        secureStorage: senderStorage,
        libsignalBridge: bridge,
        prekeyRemoteDataSource: prekeyDirectory,
        identityProvisioningService: senderProvisioning,
      );
      receiverSessionService = SignalSessionService(
        secureStorage: receiverStorage,
        libsignalBridge: bridge,
        prekeyRemoteDataSource: prekeyDirectory,
        identityProvisioningService: receiverProvisioning,
      );
    });

    test('session init success and first message decrypts correctly', () async {
      final outgoing = await senderSessionService.initiateSessionAndEncryptFirstMessage(
        localWid: 'wid-a',
        localDeviceId: 'device-a1',
        peerWid: 'wid-b',
        peerDeviceId: 'device-b1',
        messageId: 'msg-1',
        plaintext: 'hello-signal-first-message',
      );

      final cleartext = await receiverSessionService.decryptFirstMessageAndEstablishSession(
        localWid: 'wid-b',
        localDeviceId: 'device-b1',
        message: outgoing,
      );

      expect(cleartext, equals('hello-signal-first-message'));
    });

    test('tampered bundle signature is detected before session creation', () async {
      prekeyDirectory.bundle = PeerPreKeyBundle(
        wid: prekeyDirectory.bundle.wid,
        deviceId: prekeyDirectory.bundle.deviceId,
        identityKey: prekeyDirectory.bundle.identityKey,
        signedPreKeyPublic: prekeyDirectory.bundle.signedPreKeyPublic,
        signedPreKeySignature: 'invalid-signature',
        oneTimePreKeyId: prekeyDirectory.bundle.oneTimePreKeyId,
        oneTimePreKeyPublic: prekeyDirectory.bundle.oneTimePreKeyPublic,
      );

      await expectLater(
        () => senderSessionService.initiateSessionAndEncryptFirstMessage(
          localWid: 'wid-a',
          localDeviceId: 'device-a1',
          peerWid: 'wid-b',
          peerDeviceId: 'device-b1',
          messageId: 'msg-tampered',
          plaintext: 'should-fail',
        ),
        throwsA(isA<IdentityVerificationException>()),
      );
    });

    test('replay of consumed prekey artifact is blocked', () async {
      await senderSessionService.initiateSessionAndEncryptFirstMessage(
        localWid: 'wid-a',
        localDeviceId: 'device-a1',
        peerWid: 'wid-b',
        peerDeviceId: 'device-b1',
        messageId: 'msg-first',
        plaintext: 'first',
      );

      await expectLater(
        () => senderSessionService.initiateSessionAndEncryptFirstMessage(
          localWid: 'wid-a',
          localDeviceId: 'device-a1',
          peerWid: 'wid-b',
          peerDeviceId: 'device-b1',
          messageId: 'msg-replay',
          plaintext: 'second',
        ),
        throwsA(isA<SessionReplayDetectedException>()),
      );
    });

    test('wrong sender identity key is rejected on receiver side', () async {
      final outgoing = await senderSessionService.initiateSessionAndEncryptFirstMessage(
        localWid: 'wid-a',
        localDeviceId: 'device-a1',
        peerWid: 'wid-b',
        peerDeviceId: 'device-b1',
        messageId: 'msg-key-change',
        plaintext: 'payload',
      );

      final tamperedMessage = EncryptedSessionMessage(
        messageId: outgoing.messageId,
        ciphertextBase64: outgoing.ciphertextBase64,
        initEnvelope: SessionInitEnvelope(
          fromWid: outgoing.initEnvelope.fromWid,
          fromDeviceId: outgoing.initEnvelope.fromDeviceId,
          toWid: outgoing.initEnvelope.toWid,
          toDeviceId: outgoing.initEnvelope.toDeviceId,
          initiatorIdentityKey: 'tampered-initiator-identity',
          initiatorEphemeralKey: outgoing.initEnvelope.initiatorEphemeralKey,
          responderIdentityKey: outgoing.initEnvelope.responderIdentityKey,
          responderSignedPreKeyPublic: outgoing.initEnvelope.responderSignedPreKeyPublic,
          responderOneTimePreKeyId: outgoing.initEnvelope.responderOneTimePreKeyId,
          responderOneTimePreKeyPublic: outgoing.initEnvelope.responderOneTimePreKeyPublic,
        ),
      );

      await expectLater(
        () => receiverSessionService.decryptFirstMessageAndEstablishSession(
          localWid: 'wid-b',
          localDeviceId: 'device-b1',
          message: tamperedMessage,
        ),
        throwsA(isA<IdentityVerificationException>()),
      );
    });
  });
}
