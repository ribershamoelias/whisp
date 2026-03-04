import 'dart:convert';

import 'package:crypto/crypto.dart';

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

class SessionDesyncException implements Exception {
  SessionDesyncException(this.message);

  final String message;

  @override
  String toString() => 'SessionDesyncException: $message';
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
    required this.counter,
    required this.initEnvelope,
  });

  final String messageId;
  final String ciphertextBase64;
  final int counter;
  final SessionInitEnvelope initEnvelope;
}

class SessionCipherMessage {
  const SessionCipherMessage({
    required this.messageId,
    required this.ciphertextBase64,
    required this.counter,
  });

  final String messageId;
  final String ciphertextBase64;
  final int counter;
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

  static const int _maxCounterGap = 100;

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

    final state = _SessionState.initial(
      rootKeyBase64: sessionMaterial.sessionKeyBase64,
      isInitiator: true,
    );
    await _writeSessionState(
      localWid,
      localDeviceId,
      peerWid,
      peerDeviceId,
      state,
    );
    await _secureStorage.write(key: replayKey, value: 'used');

    final encrypted = await _encryptWithSendChain(
      localWid: localWid,
      localDeviceId: localDeviceId,
      peerWid: peerWid,
      peerDeviceId: peerDeviceId,
      messageId: messageId,
      plaintext: plaintext,
      sessionState: state,
    );

    return EncryptedSessionMessage(
      messageId: encrypted.messageId,
      ciphertextBase64: encrypted.ciphertextBase64,
      counter: encrypted.counter,
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

    final rootKey = await _libsignalBridge.createResponderSessionKey(
      initiatorIdentityPublicKeyBase64: message.initEnvelope.initiatorIdentityKey,
      initiatorEphemeralPublicBase64: message.initEnvelope.initiatorEphemeralKey,
      responderIdentityPublicKeyBase64: message.initEnvelope.responderIdentityKey,
      responderSignedPreKeyPublicBase64: message.initEnvelope.responderSignedPreKeyPublic,
      responderOneTimePreKeyId: message.initEnvelope.responderOneTimePreKeyId,
      responderOneTimePreKeyPublicBase64: message.initEnvelope.responderOneTimePreKeyPublic,
    );
    final state = _SessionState.initial(
      rootKeyBase64: rootKey,
      isInitiator: false,
    );
    await _writeSessionState(
      localWid,
      localDeviceId,
      message.initEnvelope.fromWid,
      message.initEnvelope.fromDeviceId,
      state,
    );

    return decryptIncomingMessage(
      localWid: localWid,
      localDeviceId: localDeviceId,
      peerWid: message.initEnvelope.fromWid,
      peerDeviceId: message.initEnvelope.fromDeviceId,
      messageId: message.messageId,
      ciphertextBase64: message.ciphertextBase64,
      counter: message.counter,
    );
  }

  Future<SessionCipherMessage> encryptWithExistingSession({
    required String localWid,
    required String localDeviceId,
    required String peerWid,
    required String peerDeviceId,
    required String messageId,
    required String plaintext,
  }) async {
    final state = await _readSessionState(localWid, localDeviceId, peerWid, peerDeviceId);
    return _encryptWithSendChain(
      localWid: localWid,
      localDeviceId: localDeviceId,
      peerWid: peerWid,
      peerDeviceId: peerDeviceId,
      messageId: messageId,
      plaintext: plaintext,
      sessionState: state,
    );
  }

  Future<String> decryptIncomingMessage({
    required String localWid,
    required String localDeviceId,
    required String peerWid,
    required String peerDeviceId,
    required String messageId,
    required String ciphertextBase64,
    required int counter,
  }) async {
    final state = await _readSessionState(localWid, localDeviceId, peerWid, peerDeviceId);
    final session = state;

    final skippedKey = session.skippedMessageKeys[counter];
    if (skippedKey != null) {
      final aad = _aad(peerWid, peerDeviceId, localWid, localDeviceId, messageId, counter);
      final clear = await _libsignalBridge.decryptWithSessionKey(
        sessionKeyBase64: skippedKey,
        payloadBase64: ciphertextBase64,
        aad: aad,
      );
      session.skippedMessageKeys.remove(counter);
      await _writeSessionState(localWid, localDeviceId, peerWid, peerDeviceId, session);
      return clear;
    }

    if (counter < session.recvCounter) {
      throw SessionDesyncException('stale or already-consumed message counter: $counter');
    }

    final gap = counter - session.recvCounter;
    if (gap > _maxCounterGap) {
      throw SessionDesyncException('counter gap too large: $gap');
    }

    for (var i = 0; i < gap; i++) {
      session.skippedMessageKeys[session.recvCounter] = _deriveMessageKey(session.recvChainKey);
      session.recvChainKey = _advanceChainKey(session.recvChainKey);
      session.recvCounter += 1;
    }

    final messageKey = _deriveMessageKey(session.recvChainKey);
    final aad = _aad(peerWid, peerDeviceId, localWid, localDeviceId, messageId, counter);
    final clear = await _libsignalBridge.decryptWithSessionKey(
      sessionKeyBase64: messageKey,
      payloadBase64: ciphertextBase64,
      aad: aad,
    );
    session.recvChainKey = _advanceChainKey(session.recvChainKey);
    session.recvCounter += 1;
    await _writeSessionState(localWid, localDeviceId, peerWid, peerDeviceId, session);
    return clear;
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

  Future<SessionCipherMessage> _encryptWithSendChain({
    required String localWid,
    required String localDeviceId,
    required String peerWid,
    required String peerDeviceId,
    required String messageId,
    required String plaintext,
    required _SessionState sessionState,
  }) async {
    final counter = sessionState.sendCounter;
    final messageKey = _deriveMessageKey(sessionState.sendChainKey);
    final aad = _aad(localWid, localDeviceId, peerWid, peerDeviceId, messageId, counter);
    final ciphertext = await _libsignalBridge.encryptWithSessionKey(
      sessionKeyBase64: messageKey,
      plaintext: plaintext,
      aad: aad,
    );
    sessionState.sendChainKey = _advanceChainKey(sessionState.sendChainKey);
    sessionState.sendCounter += 1;
    await _writeSessionState(localWid, localDeviceId, peerWid, peerDeviceId, sessionState);

    return SessionCipherMessage(
      messageId: messageId,
      ciphertextBase64: ciphertext,
      counter: counter,
    );
  }

  Future<_SessionState> _readSessionState(
    String localWid,
    String localDeviceId,
    String peerWid,
    String peerDeviceId,
  ) async {
    final raw = await _secureStorage.read(
      key: _sessionStateKey(localWid, localDeviceId, peerWid, peerDeviceId),
    );
    if (raw == null || raw.isEmpty) {
      throw SignalSessionException(
        'missing session state for $localWid/$localDeviceId -> $peerWid/$peerDeviceId',
      );
    }
    final state = _SessionState.fromJson(raw);
    final markerRaw = await _secureStorage.read(
      key: _sessionCounterMarkerKey(localWid, localDeviceId, peerWid, peerDeviceId),
    );
    final marker = int.tryParse(markerRaw ?? '0') ?? 0;
    if (state.maxCounter < marker) {
      throw SessionDesyncException(
        'ratchet rollback detected for $localWid/$localDeviceId -> $peerWid/$peerDeviceId',
      );
    }
    return state;
  }

  Future<void> _writeSessionState(
    String localWid,
    String localDeviceId,
    String peerWid,
    String peerDeviceId,
    _SessionState state,
  ) async {
    await _secureStorage.write(
      key: _sessionStateKey(localWid, localDeviceId, peerWid, peerDeviceId),
      value: state.toJson(),
    );
    final markerKey = _sessionCounterMarkerKey(localWid, localDeviceId, peerWid, peerDeviceId);
    final markerRaw = await _secureStorage.read(key: markerKey);
    final marker = int.tryParse(markerRaw ?? '0') ?? 0;
    final nextMarker = state.maxCounter > marker ? state.maxCounter : marker;
    await _secureStorage.write(key: markerKey, value: nextMarker.toString());
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

  String _deriveMessageKey(String chainKeyBase64) {
    final material = utf8.encode('msg:$chainKeyBase64');
    return base64Encode(sha256.convert(material).bytes.sublist(0, 32));
  }

  String _advanceChainKey(String chainKeyBase64) {
    final material = utf8.encode('chain:$chainKeyBase64');
    return base64Encode(sha256.convert(material).bytes.sublist(0, 32));
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

  String _sessionStateKey(
    String localWid,
    String localDeviceId,
    String peerWid,
    String peerDeviceId,
  ) {
    return 'signal:session-state:$localWid:$localDeviceId:$peerWid:$peerDeviceId';
  }

  String _sessionCounterMarkerKey(
    String localWid,
    String localDeviceId,
    String peerWid,
    String peerDeviceId,
  ) {
    return 'signal:session-marker:$localWid:$localDeviceId:$peerWid:$peerDeviceId';
  }

  String _aad(
    String fromWid,
    String fromDeviceId,
    String toWid,
    String toDeviceId,
    String messageId,
    int counter,
  ) {
    return 'whisp-signal-v1|$fromWid|$fromDeviceId|$toWid|$toDeviceId|$messageId|$counter';
  }
}

class _SessionState {
  _SessionState({
    required this.rootKey,
    required this.sendChainKey,
    required this.recvChainKey,
    required this.sendCounter,
    required this.recvCounter,
    required this.skippedMessageKeys,
  });

  factory _SessionState.initial({
    required String rootKeyBase64,
    required bool isInitiator,
  }) {
    final sendSalt = isInitiator ? 'chain:a2b' : 'chain:b2a';
    final recvSalt = isInitiator ? 'chain:b2a' : 'chain:a2b';
    final send = base64Encode(sha256.convert(utf8.encode('$sendSalt:$rootKeyBase64')).bytes.sublist(0, 32));
    final recv = base64Encode(sha256.convert(utf8.encode('$recvSalt:$rootKeyBase64')).bytes.sublist(0, 32));
    return _SessionState(
      rootKey: rootKeyBase64,
      sendChainKey: send,
      recvChainKey: recv,
      sendCounter: 0,
      recvCounter: 0,
      skippedMessageKeys: <int, String>{},
    );
  }

  factory _SessionState.fromJson(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, dynamic>) {
      throw SignalSessionException('invalid session state payload');
    }
    final skippedRaw = decoded['skipped_message_keys'] as Map<String, dynamic>? ?? <String, dynamic>{};
    return _SessionState(
      rootKey: decoded['root_key'] as String,
      sendChainKey: decoded['send_chain_key'] as String,
      recvChainKey: decoded['recv_chain_key'] as String,
      sendCounter: decoded['send_counter'] as int,
      recvCounter: decoded['recv_counter'] as int,
      skippedMessageKeys: skippedRaw.map((key, value) => MapEntry(int.parse(key), value as String)),
    );
  }

  String rootKey;
  String sendChainKey;
  String recvChainKey;
  int sendCounter;
  int recvCounter;
  Map<int, String> skippedMessageKeys;

  int get maxCounter => sendCounter > recvCounter ? sendCounter : recvCounter;

  String toJson() {
    return jsonEncode({
      'root_key': rootKey,
      'send_chain_key': sendChainKey,
      'recv_chain_key': recvChainKey,
      'send_counter': sendCounter,
      'recv_counter': recvCounter,
      'skipped_message_keys': skippedMessageKeys.map((key, value) => MapEntry(key.toString(), value)),
    });
  }
}

class _DeviceMaterialSnapshot {
  const _DeviceMaterialSnapshot({
    required this.identityPublicKey,
  });

  final String identityPublicKey;
}
