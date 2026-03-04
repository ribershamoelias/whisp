import 'dart:convert';

import '../../../core/libsignal_bridge.dart';
import '../../../core/secure_storage.dart';
import '../../identity/data/prekey_bundle_remote_data_source.dart';
import '../../identity/domain/signal_prekey_provisioning_service.dart';

class SessionReplayDetectedException implements Exception {
  SessionReplayDetectedException(this.message);

  final String message;

  @override
  String toString() => 'SessionReplayDetectedException: $message';
}

class SignalSessionException implements Exception {
  SignalSessionException(this.message);

  final String message;

  @override
  String toString() => 'SignalSessionException: $message';
}

class SessionInitEnvelope {
  const SessionInitEnvelope({
    required this.fromWid,
    required this.fromDeviceId,
    required this.toWid,
    required this.toDeviceId,
    required this.initiatorIdentityKey,
    required this.initiatorEphemeralKey,
    required this.responderIdentityKey,
    required this.responderSignedPreKeyPublic,
    required this.responderOneTimePreKeyId,
    required this.responderOneTimePreKeyPublic,
  });

  final String fromWid;
  final String fromDeviceId;
  final String toWid;
  final String toDeviceId;
  final String initiatorIdentityKey;
  final String initiatorEphemeralKey;
  final String responderIdentityKey;
  final String responderSignedPreKeyPublic;
  final int responderOneTimePreKeyId;
  final String responderOneTimePreKeyPublic;
}

class EncryptedSessionMessage {
  const EncryptedSessionMessage({
    required this.messageId,
    required this.ciphertextBase64,
    required this.initEnvelope,
  });

  final String messageId;
  final String ciphertextBase64;
  final SessionInitEnvelope initEnvelope;
}

class SignalSessionService {
  SignalSessionService({
    required SecureStorage secureStorage,
    required LibsignalBridge libsignalBridge,
    required PrekeyBundleRemoteDataSource prekeyRemoteDataSource,
    required SignalPrekeyProvisioningService identityProvisioningService,
  })  : _secureStorage = secureStorage,
        _libsignalBridge = libsignalBridge,
        _prekeyRemoteDataSource = prekeyRemoteDataSource,
        _identityProvisioningService = identityProvisioningService;

  final SecureStorage _secureStorage;
  final LibsignalBridge _libsignalBridge;
  final PrekeyBundleRemoteDataSource _prekeyRemoteDataSource;
  final SignalPrekeyProvisioningService _identityProvisioningService;

  Future<EncryptedSessionMessage> initiateSessionAndEncryptFirstMessage({
    required String localWid,
    required String localDeviceId,
    required String peerWid,
    required String peerDeviceId,
    required String messageId,
    required String plaintext,
  }) async {
    final localMaterial = await _readDeviceMaterial(localWid, localDeviceId);
    final peerBundle = await _prekeyRemoteDataSource.fetchPeerPrekeyBundle(
      wid: peerWid,
      deviceId: peerDeviceId,
    );
    await _identityProvisioningService.verifyPeerBundle(peerBundle);

    final replayKey = _sessionInitReplayKey(
      localWid: localWid,
      localDeviceId: localDeviceId,
      peerWid: peerWid,
      peerDeviceId: peerDeviceId,
      preKeyId: peerBundle.oneTimePreKeyId,
    );
    final replayMarker = await _secureStorage.read(key: replayKey);
    if (replayMarker != null) {
      throw SessionReplayDetectedException('session-init replay detected for consumed one-time prekey');
    }

    final sessionMaterial = await _libsignalBridge.createInitiatorSessionMaterial(
      initiatorIdentityPublicKeyBase64: localMaterial.identityPublicKey,
      responderIdentityPublicKeyBase64: peerBundle.identityKey,
      responderSignedPreKeyPublicBase64: peerBundle.signedPreKeyPublic,
      responderOneTimePreKeyId: peerBundle.oneTimePreKeyId,
      responderOneTimePreKeyPublicBase64: peerBundle.oneTimePreKeyPublic,
    );

    final sessionKey = sessionMaterial.sessionKeyBase64;
    await _secureStorage.write(
      key: _sessionKey(localWid, localDeviceId, peerWid, peerDeviceId),
      value: sessionKey,
    );
    await _secureStorage.write(key: replayKey, value: 'used');

    final aad = _aad(localWid, localDeviceId, peerWid, peerDeviceId, messageId);
    final ciphertext = await _libsignalBridge.encryptWithSessionKey(
      sessionKeyBase64: sessionKey,
      plaintext: plaintext,
      aad: aad,
    );

    return EncryptedSessionMessage(
      messageId: messageId,
      ciphertextBase64: ciphertext,
      initEnvelope: SessionInitEnvelope(
        fromWid: localWid,
        fromDeviceId: localDeviceId,
        toWid: peerWid,
        toDeviceId: peerDeviceId,
        initiatorIdentityKey: localMaterial.identityPublicKey,
        initiatorEphemeralKey: sessionMaterial.initiatorEphemeralPublicBase64,
        responderIdentityKey: peerBundle.identityKey,
        responderSignedPreKeyPublic: peerBundle.signedPreKeyPublic,
        responderOneTimePreKeyId: peerBundle.oneTimePreKeyId,
        responderOneTimePreKeyPublic: peerBundle.oneTimePreKeyPublic,
      ),
    );
  }

  Future<String> decryptFirstMessageAndEstablishSession({
    required String localWid,
    required String localDeviceId,
    required EncryptedSessionMessage message,
  }) async {
    if (message.initEnvelope.toWid != localWid || message.initEnvelope.toDeviceId != localDeviceId) {
      throw SignalSessionException('session-init envelope target mismatch');
    }

    await _verifySenderIdentityTrust(message.initEnvelope);

    final sessionKey = await _libsignalBridge.createResponderSessionKey(
      initiatorIdentityPublicKeyBase64: message.initEnvelope.initiatorIdentityKey,
      initiatorEphemeralPublicBase64: message.initEnvelope.initiatorEphemeralKey,
      responderIdentityPublicKeyBase64: message.initEnvelope.responderIdentityKey,
      responderSignedPreKeyPublicBase64: message.initEnvelope.responderSignedPreKeyPublic,
      responderOneTimePreKeyId: message.initEnvelope.responderOneTimePreKeyId,
      responderOneTimePreKeyPublicBase64: message.initEnvelope.responderOneTimePreKeyPublic,
    );

    await _secureStorage.write(
      key: _sessionKey(
        localWid,
        localDeviceId,
        message.initEnvelope.fromWid,
        message.initEnvelope.fromDeviceId,
      ),
      value: sessionKey,
    );

    final aad = _aad(
      message.initEnvelope.fromWid,
      message.initEnvelope.fromDeviceId,
      localWid,
      localDeviceId,
      message.messageId,
    );

    return _libsignalBridge.decryptWithSessionKey(
      sessionKeyBase64: sessionKey,
      payloadBase64: message.ciphertextBase64,
      aad: aad,
    );
  }

  Future<void> _verifySenderIdentityTrust(SessionInitEnvelope initEnvelope) async {
    final trustKey =
        'signal:trust:${initEnvelope.fromWid}:${initEnvelope.fromDeviceId}:identity_key';
    final trusted = await _secureStorage.read(key: trustKey);
    if (trusted == null) {
      await _secureStorage.write(key: trustKey, value: initEnvelope.initiatorIdentityKey);
      return;
    }
    if (trusted != initEnvelope.initiatorIdentityKey) {
      throw IdentityVerificationException(
        'sender identity key changed for ${initEnvelope.fromWid}/${initEnvelope.fromDeviceId}',
      );
    }
  }

  Future<_DeviceMaterialSnapshot> _readDeviceMaterial(String wid, String deviceId) async {
    final key = 'signal:device:$wid:$deviceId:material';
    final raw = await _secureStorage.read(key: key);
    if (raw == null || raw.isEmpty) {
      throw SignalSessionException('missing local device material for $wid/$deviceId');
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) {
      throw SignalSessionException('invalid local device material format');
    }
    return _DeviceMaterialSnapshot(
      identityPublicKey: decoded['identity_public_key'] as String,
    );
  }

  String _sessionInitReplayKey({
    required String localWid,
    required String localDeviceId,
    required String peerWid,
    required String peerDeviceId,
    required int preKeyId,
  }) {
    return 'signal:session-init:$localWid:$localDeviceId:$peerWid:$peerDeviceId:$preKeyId';
  }

  String _sessionKey(
    String localWid,
    String localDeviceId,
    String peerWid,
    String peerDeviceId,
  ) {
    return 'signal:session:$localWid:$localDeviceId:$peerWid:$peerDeviceId';
  }

  String _aad(
    String fromWid,
    String fromDeviceId,
    String toWid,
    String toDeviceId,
    String messageId,
  ) {
    return 'whisp-signal-v1|$fromWid|$fromDeviceId|$toWid|$toDeviceId|$messageId';
  }
}

class _DeviceMaterialSnapshot {
  const _DeviceMaterialSnapshot({
    required this.identityPublicKey,
  });

  final String identityPublicKey;
}
