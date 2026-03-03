import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:whisp_mobile/core/echo_crypto_adapter.dart';
import 'package:whisp_mobile/core/secure_storage.dart';
import 'package:whisp_mobile/features/messaging/data/messaging_remote_data_source.dart';

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

class FakeRelayError implements Exception {
  FakeRelayError(this.statusCode, this.message);

  final int statusCode;
  final String message;
}

class FakeRelayEchoTransport implements RelayEchoTransport {
  final Map<String, String> _ciphertexts = <String, String>{};

  @override
  Future<String> fetchEcho({
    required String wid,
    required String deviceId,
    required String messageId,
  }) async {
    final key = '$wid::$deviceId::$messageId';
    final value = _ciphertexts[key];
    if (value == null) {
      throw FakeRelayError(400, 'not found');
    }
    return value;
  }

  @override
  Future<void> submitEcho({
    required String wid,
    required String deviceId,
    required String messageId,
    required String ciphertextBase64,
  }) async {
    if (!_isCanonicalBase64(ciphertextBase64)) {
      throw FakeRelayError(400, 'malformed base64');
    }

    final decoded = base64Decode(ciphertextBase64);
    if (decoded.length > EchoCryptoAdapter.maxCiphertextBytes) {
      throw FakeRelayError(413, 'payload too large');
    }

    final key = '$wid::$deviceId::$messageId';
    if (_ciphertexts.containsKey(key)) {
      throw FakeRelayError(409, 'duplicate');
    }
    _ciphertexts[key] = ciphertextBase64;
  }

  bool _isCanonicalBase64(String value) {
    try {
      final decoded = base64Decode(value);
      return base64Encode(decoded) == value;
    } on FormatException {
      return false;
    }
  }
}

void main() {
  group('RelayEchoMessagingRemoteDataSource', () {
    late EchoCryptoAdapter adapter;
    late FakeRelayEchoTransport transport;
    late RelayEchoMessagingRemoteDataSource dataSource;

    setUp(() {
      adapter = EchoCryptoAdapter(secureStorage: InMemorySecureStorage());
      transport = FakeRelayEchoTransport();
      dataSource = RelayEchoMessagingRemoteDataSource(
        transport: transport,
        cryptoAdapter: adapter,
      );
    });

    test('encrypt-send-fetch-decrypt roundtrip succeeds', () async {
      final plaintext = await dataSource.echoRoundtrip(
        wid: 'wid-1',
        deviceId: 'device-1',
        messageId: 'message-1',
        plaintext: 'echo-pipeline',
      );

      expect(plaintext, 'echo-pipeline');
    });

    test('duplicate message id maps to 409 in relay transport', () async {
      await dataSource.echoRoundtrip(
        wid: 'wid-1',
        deviceId: 'device-1',
        messageId: 'message-dup',
        plaintext: 'first',
      );

      await expectLater(
        () => dataSource.echoRoundtrip(
          wid: 'wid-1',
          deviceId: 'device-1',
          messageId: 'message-dup',
          plaintext: 'second',
        ),
        throwsA(
          isA<FakeRelayError>()
              .having((error) => error.statusCode, 'statusCode', 409),
        ),
      );
    });

    test('oversize payload is rejected with 413', () async {
      final oversizedPlaintext = 'a' * 100000;
      await expectLater(
        () => dataSource.echoRoundtrip(
          wid: 'wid-1',
          deviceId: 'device-1',
          messageId: 'message-oversize',
          plaintext: oversizedPlaintext,
        ),
        throwsA(
          isA<FakeRelayError>()
              .having((error) => error.statusCode, 'statusCode', 413),
        ),
      );
    });

    test('malformed base64 from relay fails client decryption', () async {
      await transport.submitEcho(
        wid: 'wid-1',
        deviceId: 'device-1',
        messageId: 'message-malformed',
        ciphertextBase64: base64Encode(utf8.encode('valid-ciphertext')),
      );

      const badPayload = 'not-valid-base64';
      expect(
        () => adapter.decryptFromEcho(
          deviceId: 'device-1',
          payloadBase64: badPayload,
        ),
        throwsA(isA<EchoCryptoException>()),
      );
    });
  });
}
