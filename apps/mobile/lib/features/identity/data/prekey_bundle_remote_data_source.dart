class OneTimePreKeyUpload {
  const OneTimePreKeyUpload({
    required this.prekeyId,
    required this.publicKey,
  });

  final int prekeyId;
  final String publicKey;
}

class PreKeyBundleUploadPayload {
  const PreKeyBundleUploadPayload({
    required this.wid,
    required this.deviceId,
    required this.identityKey,
    required this.signedPreKeyId,
    required this.signedPreKeyPublic,
    required this.signedPreKeySignature,
    required this.oneTimePreKeys,
  });

  final String wid;
  final String deviceId;
  final String identityKey;
  final int signedPreKeyId;
  final String signedPreKeyPublic;
  final String signedPreKeySignature;
  final List<OneTimePreKeyUpload> oneTimePreKeys;
}

class PeerPreKeyBundle {
  const PeerPreKeyBundle({
    required this.wid,
    required this.deviceId,
    required this.identityKey,
    required this.signedPreKeyPublic,
    required this.signedPreKeySignature,
    required this.oneTimePreKeyId,
    required this.oneTimePreKeyPublic,
  });

  final String wid;
  final String deviceId;
  final String identityKey;
  final String signedPreKeyPublic;
  final String signedPreKeySignature;
  final int oneTimePreKeyId;
  final String oneTimePreKeyPublic;
}

class IdentityApiException implements Exception {
  const IdentityApiException({
    required this.statusCode,
    required this.message,
  });

  final int statusCode;
  final String message;

  @override
  String toString() => 'IdentityApiException($statusCode): $message';
}

abstract class PrekeyBundleRemoteDataSource {
  Future<void> uploadPrekeyBundle(PreKeyBundleUploadPayload payload);
  Future<PeerPreKeyBundle> fetchPeerPrekeyBundle({
    required String wid,
    required String deviceId,
  });
}
