abstract class SpacesRepository {
  Future<void> createRequest(String toWid);
  Future<void> acceptRequest(String requestId);
}
