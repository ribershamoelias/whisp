abstract class MessagingRepository {
  Future<void> sendCiphertext({required String spaceId, required String ciphertextBlob});
}
