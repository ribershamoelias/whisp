import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:whisp_mobile/core/echo_crypto_adapter.dart';
import 'package:whisp_mobile/core/secure_storage.dart';

class InMemorySecureStorage implements SecureStorage {
  final Map<String, String> _store = <String, String>{};

  @override
  Future<void> delete({required String key}) async {
    _store.remove(key);
  }

  @override
  Future<String?> read({required String key}) async {
    return _store[key];
  }

  @override
  Future<void> write({required String key, required String value}) async {
    _store[key] = value;
  }
}

void main() {
  group('EchoCryptoAdapter', () {
    late EchoCryptoAdapter adapter;

    setUp(() {
      adapter = EchoCryptoAdapter(secureStorage: InMemorySecureStorage());
    });

    test('encrypts and decrypts roundtrip successfully', () async {
      const plaintext = 'hello-whisp-echo';
      final payload = await adapter.encryptForEcho(
        deviceId: 'device-1',
        plaintext: plaintext,
      );

      expect(payload, isNotEmpty);
      expect(payload, isNot(base64Encode(utf8.encode(plaintext))));

      final decrypted = await adapter.decryptFromEcho(
        deviceId: 'device-1',
        payloadBase64: payload,
      );
      expect(decrypted, plaintext);
    });

    test('same plaintext encrypts to different ciphertext due to fresh nonce',
        () async {
      const plaintext = 'same-plaintext';
      final payloadA = await adapter.encryptForEcho(
        deviceId: 'device-1',
        plaintext: plaintext,
      );
      final payloadB = await adapter.encryptForEcho(
        deviceId: 'device-1',
        plaintext: plaintext,
      );

      expect(payloadA, isNot(payloadB));
    });

    test('tampered payload fails decryption', () async {
      final payload = await adapter.encryptForEcho(
        deviceId: 'device-1',
        plaintext: 'tamper-me',
      );
      final bytes = base64Decode(payload);
      bytes[bytes.length - 1] = bytes.last ^ 0x01;
      final tamperedPayload = base64Encode(bytes);

      expect(
        () => adapter.decryptFromEcho(
          deviceId: 'device-1',
          payloadBase64: tamperedPayload,
        ),
        throwsA(isA<EchoCryptoException>()),
      );
    });

    test('malformed base64 fails decryption', () async {
      expect(
        () => adapter.decryptFromEcho(
          deviceId: 'device-1',
          payloadBase64: 'not-valid-base64',
        ),
        throwsA(isA<EchoCryptoException>()),
      );
    });
  });
}
