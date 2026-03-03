import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import 'secure_storage.dart';

class EchoCryptoException implements Exception {
  EchoCryptoException(this.message);

  final String message;

  @override
  String toString() => 'EchoCryptoException: $message';
}

class EchoCryptoAdapter {
  EchoCryptoAdapter({
    required SecureStorage secureStorage,
    Cipher? algorithm,
  })  : _secureStorage = secureStorage,
        _algorithm = algorithm ?? AesGcm.with256bits();

  static const int maxCiphertextBytes = 65536;
  static const int _nonceLengthBytes = 12;
  static const int _keyLengthBytes = 32;
  static const int _tagLengthBytes = 16;
  static const String _aadPrefix = 'whisp-echo-v1';

  final SecureStorage _secureStorage;
  final Cipher _algorithm;
  final Random _random = Random.secure();

  Future<String> encryptForEcho({
    required String deviceId,
    required String plaintext,
  }) async {
    final key = await _loadOrCreateDeviceKey(deviceId);
    final nonce = _newNonce();
    final message = utf8.encode(plaintext);
    final aad = utf8.encode('$_aadPrefix:$deviceId');

    final secretBox = await _algorithm.encrypt(
      message,
      secretKey: SecretKey(key),
      nonce: nonce,
      aad: aad,
    );

    final payload = Uint8List(
      secretBox.nonce.length +
          secretBox.cipherText.length +
          secretBox.mac.bytes.length,
    )
      ..setRange(0, secretBox.nonce.length, secretBox.nonce)
      ..setRange(
        secretBox.nonce.length,
        secretBox.nonce.length + secretBox.cipherText.length,
        secretBox.cipherText,
      )
      ..setRange(
        secretBox.nonce.length + secretBox.cipherText.length,
        secretBox.nonce.length +
            secretBox.cipherText.length +
            secretBox.mac.bytes.length,
        secretBox.mac.bytes,
      );

    return base64Encode(payload);
  }

  Future<String> decryptFromEcho({
    required String deviceId,
    required String payloadBase64,
  }) async {
    final payload = _decodePayload(payloadBase64);
    if (payload.length < _nonceLengthBytes + _tagLengthBytes) {
      throw EchoCryptoException('ciphertext payload too short');
    }

    final nonce = payload.sublist(0, _nonceLengthBytes);
    final macStart = payload.length - _tagLengthBytes;
    final ciphertext = payload.sublist(_nonceLengthBytes, macStart);
    final tag = payload.sublist(macStart);
    final aad = utf8.encode('$_aadPrefix:$deviceId');

    try {
      final key = await _loadOrCreateDeviceKey(deviceId);
      final clearBytes = await _algorithm.decrypt(
        SecretBox(ciphertext, nonce: nonce, mac: Mac(tag)),
        secretKey: SecretKey(key),
        aad: aad,
      );
      return utf8.decode(clearBytes);
    } on SecretBoxAuthenticationError {
      throw EchoCryptoException('ciphertext authentication failed');
    } on FormatException {
      throw EchoCryptoException('decrypted payload is not valid UTF-8');
    }
  }

  Uint8List _decodePayload(String payloadBase64) {
    try {
      return base64Decode(payloadBase64);
    } on FormatException {
      throw EchoCryptoException('ciphertext payload must be valid base64');
    }
  }

  Future<Uint8List> _loadOrCreateDeviceKey(String deviceId) async {
    final keyName = 'echo_key_$deviceId';
    final existing = await _secureStorage.read(key: keyName);
    if (existing != null && existing.isNotEmpty) {
      final decoded = base64Decode(existing);
      if (decoded.length != _keyLengthBytes) {
        throw EchoCryptoException('invalid stored echo key length');
      }
      return Uint8List.fromList(decoded);
    }

    final generated = Uint8List(_keyLengthBytes);
    for (var i = 0; i < generated.length; i++) {
      generated[i] = _random.nextInt(256);
    }
    await _secureStorage.write(key: keyName, value: base64Encode(generated));
    return generated;
  }

  Uint8List _newNonce() {
    final nonce = Uint8List(_nonceLengthBytes);
    for (var i = 0; i < nonce.length; i++) {
      nonce[i] = _random.nextInt(256);
    }
    return nonce;
  }
}
