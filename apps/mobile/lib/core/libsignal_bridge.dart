import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

class SignalKeyPair {
  const SignalKeyPair({
    required this.publicKeyBase64,
    required this.privateKeyBase64,
  });

  final String publicKeyBase64;
  final String privateKeyBase64;
}

class SignedPreKeyMaterial {
  const SignedPreKeyMaterial({
    required this.signedPreKeyId,
    required this.publicKeyBase64,
    required this.privateKeyBase64,
    required this.signatureBase64,
  });

  final int signedPreKeyId;
  final String publicKeyBase64;
  final String privateKeyBase64;
  final String signatureBase64;
}

class OneTimePreKeyMaterial {
  const OneTimePreKeyMaterial({
    required this.preKeyId,
    required this.publicKeyBase64,
    required this.privateKeyBase64,
  });

  final int preKeyId;
  final String publicKeyBase64;
  final String privateKeyBase64;
}

class SessionInitiationMaterial {
  const SessionInitiationMaterial({
    required this.sessionKeyBase64,
    required this.initiatorEphemeralPublicBase64,
  });

  final String sessionKeyBase64;
  final String initiatorEphemeralPublicBase64;
}

abstract class LibsignalBridge {
  Future<SignalKeyPair> createIdentityKeyPair();
  Future<SignedPreKeyMaterial> createSignedPreKey({
    required String identityPrivateKeyBase64,
  });
  Future<List<OneTimePreKeyMaterial>> createOneTimePreKeys({
    required int count,
  });
  Future<bool> verifySignedPreKey({
    required String identityPublicKeyBase64,
    required String signedPreKeyPublicBase64,
    required String signatureBase64,
  });
  Future<SessionInitiationMaterial> createInitiatorSessionMaterial({
    required String initiatorIdentityPublicKeyBase64,
    required String responderIdentityPublicKeyBase64,
    required String responderSignedPreKeyPublicBase64,
    required int responderOneTimePreKeyId,
    required String responderOneTimePreKeyPublicBase64,
  });
  Future<String> createResponderSessionKey({
    required String initiatorIdentityPublicKeyBase64,
    required String initiatorEphemeralPublicBase64,
    required String responderIdentityPublicKeyBase64,
    required String responderSignedPreKeyPublicBase64,
    required int responderOneTimePreKeyId,
    required String responderOneTimePreKeyPublicBase64,
  });
  Future<String> encryptWithSessionKey({
    required String sessionKeyBase64,
    required String plaintext,
    required String aad,
  });
  Future<String> decryptWithSessionKey({
    required String sessionKeyBase64,
    required String payloadBase64,
    required String aad,
  });
}

class NativeLibsignalBridge implements LibsignalBridge {
  NativeLibsignalBridge({Random? random}) : _random = random ?? Random.secure();

  final Random _random;
  final SignatureAlgorithm _signatureAlgorithm = Ed25519();
  final Cipher _cipher = AesGcm.with256bits();
  final HashAlgorithm _hash = Sha256();

  @override
  Future<SignalKeyPair> createIdentityKeyPair() async {
    final keyPair = await _signatureAlgorithm.newKeyPair() as SimpleKeyPair;
    final publicKey = await keyPair.extractPublicKey();
    final privateKey = await keyPair.extractPrivateKeyBytes();
    return SignalKeyPair(
      publicKeyBase64: publicKey.bytes.toBase64(),
      privateKeyBase64: privateKey.toBase64(),
    );
  }

  @override
  Future<SignedPreKeyMaterial> createSignedPreKey({
    required String identityPrivateKeyBase64,
  }) async {
    final signedKeyPair = await _signatureAlgorithm.newKeyPair() as SimpleKeyPair;
    final signedPublic = await signedKeyPair.extractPublicKey();
    final signedPrivate = await signedKeyPair.extractPrivateKeyBytes();
    final identityKeyPair = await _signatureAlgorithm.newKeyPairFromSeed(
      identityPrivateKeyBase64.fromBase64(),
    );
    final signature = await _signatureAlgorithm.sign(
      signedPublic.bytes,
      keyPair: identityKeyPair,
    );

    return SignedPreKeyMaterial(
      signedPreKeyId: _random.nextInt(1 << 30) + 1,
      publicKeyBase64: signedPublic.bytes.toBase64(),
      privateKeyBase64: signedPrivate.toBase64(),
      signatureBase64: signature.bytes.toBase64(),
    );
  }

  @override
  Future<List<OneTimePreKeyMaterial>> createOneTimePreKeys({
    required int count,
  }) async {
    final prekeys = <OneTimePreKeyMaterial>[];
    for (var i = 0; i < count; i++) {
      final keyPair = await _signatureAlgorithm.newKeyPair() as SimpleKeyPair;
      final publicKey = await keyPair.extractPublicKey();
      final privateKey = await keyPair.extractPrivateKeyBytes();
      prekeys.add(
        OneTimePreKeyMaterial(
          preKeyId: _random.nextInt(1 << 30) + 1,
          publicKeyBase64: publicKey.bytes.toBase64(),
          privateKeyBase64: privateKey.toBase64(),
        ),
      );
    }
    return prekeys;
  }

  @override
  Future<bool> verifySignedPreKey({
    required String identityPublicKeyBase64,
    required String signedPreKeyPublicBase64,
    required String signatureBase64,
  }) async {
    final publicKey = SimplePublicKey(
      identityPublicKeyBase64.fromBase64(),
      type: KeyPairType.ed25519,
    );
    final signature = Signature(
      signatureBase64.fromBase64(),
      publicKey: publicKey,
    );
    return _signatureAlgorithm.verify(
      signedPreKeyPublicBase64.fromBase64(),
      signature: signature,
    );
  }

  @override
  Future<SessionInitiationMaterial> createInitiatorSessionMaterial({
    required String initiatorIdentityPublicKeyBase64,
    required String responderIdentityPublicKeyBase64,
    required String responderSignedPreKeyPublicBase64,
    required int responderOneTimePreKeyId,
    required String responderOneTimePreKeyPublicBase64,
  }) async {
    final ephemeral = _randomBytes(32).toBase64();
    final sessionKey = await _deriveSessionKeyBase64(
      initiatorIdentityPublicKeyBase64: initiatorIdentityPublicKeyBase64,
      initiatorEphemeralPublicBase64: ephemeral,
      responderIdentityPublicKeyBase64: responderIdentityPublicKeyBase64,
      responderSignedPreKeyPublicBase64: responderSignedPreKeyPublicBase64,
      responderOneTimePreKeyId: responderOneTimePreKeyId,
      responderOneTimePreKeyPublicBase64: responderOneTimePreKeyPublicBase64,
    );
    return SessionInitiationMaterial(
      sessionKeyBase64: sessionKey,
      initiatorEphemeralPublicBase64: ephemeral,
    );
  }

  @override
  Future<String> createResponderSessionKey({
    required String initiatorIdentityPublicKeyBase64,
    required String initiatorEphemeralPublicBase64,
    required String responderIdentityPublicKeyBase64,
    required String responderSignedPreKeyPublicBase64,
    required int responderOneTimePreKeyId,
    required String responderOneTimePreKeyPublicBase64,
  }) {
    return _deriveSessionKeyBase64(
      initiatorIdentityPublicKeyBase64: initiatorIdentityPublicKeyBase64,
      initiatorEphemeralPublicBase64: initiatorEphemeralPublicBase64,
      responderIdentityPublicKeyBase64: responderIdentityPublicKeyBase64,
      responderSignedPreKeyPublicBase64: responderSignedPreKeyPublicBase64,
      responderOneTimePreKeyId: responderOneTimePreKeyId,
      responderOneTimePreKeyPublicBase64: responderOneTimePreKeyPublicBase64,
    );
  }

  @override
  Future<String> encryptWithSessionKey({
    required String sessionKeyBase64,
    required String plaintext,
    required String aad,
  }) async {
    final nonce = _randomBytes(12);
    final secretBox = await _cipher.encrypt(
      utf8.encode(plaintext),
      secretKey: SecretKey(sessionKeyBase64.fromBase64()),
      nonce: nonce,
      aad: utf8.encode(aad),
    );

    final payload = <int>[
      ...secretBox.nonce,
      ...secretBox.cipherText,
      ...secretBox.mac.bytes,
    ];
    return payload.toBase64();
  }

  @override
  Future<String> decryptWithSessionKey({
    required String sessionKeyBase64,
    required String payloadBase64,
    required String aad,
  }) async {
    final payload = payloadBase64.fromBase64();
    if (payload.length < 12 + 16) {
      throw const FormatException('invalid session payload');
    }
    final nonce = payload.sublist(0, 12);
    final macStart = payload.length - 16;
    final ciphertext = payload.sublist(12, macStart);
    final mac = payload.sublist(macStart);
    final clearBytes = await _cipher.decrypt(
      SecretBox(ciphertext, nonce: nonce, mac: Mac(mac)),
      secretKey: SecretKey(sessionKeyBase64.fromBase64()),
      aad: utf8.encode(aad),
    );
    return utf8.decode(clearBytes);
  }

  Future<String> _deriveSessionKeyBase64({
    required String initiatorIdentityPublicKeyBase64,
    required String initiatorEphemeralPublicBase64,
    required String responderIdentityPublicKeyBase64,
    required String responderSignedPreKeyPublicBase64,
    required int responderOneTimePreKeyId,
    required String responderOneTimePreKeyPublicBase64,
  }) async {
    final transcript = [
      initiatorIdentityPublicKeyBase64,
      initiatorEphemeralPublicBase64,
      responderIdentityPublicKeyBase64,
      responderSignedPreKeyPublicBase64,
      responderOneTimePreKeyId.toString(),
      responderOneTimePreKeyPublicBase64,
    ].join('|');
    final digest = await _hash.hash(utf8.encode(transcript));
    final keyBytes = digest.bytes.sublist(0, 32);
    return keyBytes.toBase64();
  }

  Uint8List _randomBytes(int length) {
    final bytes = Uint8List(length);
    for (var i = 0; i < bytes.length; i++) {
      bytes[i] = _random.nextInt(256);
    }
    return bytes;
  }
}

extension on List<int> {
  String toBase64() => base64Encode(this);
}

extension on String {
  Uint8List fromBase64() => Uint8List.fromList(base64Decode(this));
}
