abstract class AuthRepository {
  Future<void> login(String wid);
  Future<void> logout();
}
