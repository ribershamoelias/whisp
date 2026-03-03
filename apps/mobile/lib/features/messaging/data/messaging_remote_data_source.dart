import '../../../core/echo_crypto_adapter.dart';

abstract class RelayEchoTransport {
  Future<void> submitEcho({
    required String wid,
    required String deviceId,
    required String messageId,
    required String ciphertextBase64,
  });

  Future<String> fetchEcho({
    required String wid,
    required String deviceId,
    required String messageId,
  });
}

abstract class MessagingRemoteDataSource {
  Future<String> echoRoundtrip({
    required String wid,
    required String deviceId,
    required String messageId,
    required String plaintext,
  });
}

class RelayEchoMessagingRemoteDataSource implements MessagingRemoteDataSource {
  RelayEchoMessagingRemoteDataSource({
    required RelayEchoTransport transport,
    required EchoCryptoAdapter cryptoAdapter,
  })  : _transport = transport,
        _cryptoAdapter = cryptoAdapter;

  final RelayEchoTransport _transport;
  final EchoCryptoAdapter _cryptoAdapter;

  @override
  Future<String> echoRoundtrip({
    required String wid,
    required String deviceId,
    required String messageId,
    required String plaintext,
  }) async {
    final ciphertextBase64 = await _cryptoAdapter.encryptForEcho(
      deviceId: deviceId,
      plaintext: plaintext,
    );

    await _transport.submitEcho(
      wid: wid,
      deviceId: deviceId,
      messageId: messageId,
      ciphertextBase64: ciphertextBase64,
    );

    final echoedCiphertext = await _transport.fetchEcho(
      wid: wid,
      deviceId: deviceId,
      messageId: messageId,
    );

    return _cryptoAdapter.decryptFromEcho(
      deviceId: deviceId,
      payloadBase64: echoedCiphertext,
    );
  }
}
