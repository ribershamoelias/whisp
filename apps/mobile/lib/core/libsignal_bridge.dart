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
}

class NativeLibsignalBridge implements LibsignalBridge {
  NativeLibsignalBridge({Random? random}) : _random = random ?? Random.secure();

  final Random _random;
  final SignatureAlgorithm _signatureAlgorithm = Ed25519();

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
}

extension on List<int> {
  String toBase64() => base64Encode(this);
}

extension on String {
  Uint8List fromBase64() => Uint8List.fromList(base64Decode(this));
}
