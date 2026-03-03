abstract class PermissionsRepository {
  Future<bool> canDirectMessage({required String fromWid, required String toWid});
}
