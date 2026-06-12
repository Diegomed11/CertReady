/// Token set returned by the OIDC token endpoint.
class TokenSet {
  TokenSet({
    required this.accessToken,
    required this.refreshToken,
    required this.idToken,
    required this.expiresAt,
  });

  final String accessToken;
  final String? refreshToken;
  final String? idToken;
  final DateTime expiresAt;

  bool get isExpired =>
      DateTime.now().isAfter(expiresAt.subtract(const Duration(seconds: 30)));
}

/// In-memory token store for this increment.
///
/// On desktop/web dev we avoid the native `flutter_secure_storage` plugin —
/// it would force Windows **Developer Mode** (plugin symlinks) just to build.
/// Tokens therefore live only for the app session (re-login on restart). Secure
/// persistence (flutter_secure_storage → Keychain/Keystore on iOS/Android) is
/// wired back in for the mobile release increment. The async API is kept so the
/// callers don't change.
class TokenStore {
  TokenStore();

  TokenSet? _current;

  TokenSet? get current => _current;
  String? get accessToken => _current?.accessToken;

  /// Nothing is persisted between launches in this increment.
  Future<TokenSet?> load() async => _current;

  Future<void> save(TokenSet t) async => _current = t;

  Future<void> clear() async => _current = null;
}
