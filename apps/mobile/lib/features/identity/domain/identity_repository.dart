abstract class IdentityRepository {
  Future<void> registerIdentity({required String wid, required String publicKey});
}
