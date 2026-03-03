abstract class SignalClient {
  Future<void> initializeIdentity();
  Future<void> establishSession(String peerWid);
  Future<String> encrypt(String peerWid, String plaintext);
  Future<String> decrypt(String peerWid, String ciphertext);
}
