/// App configuration: base URLs of the Go services + OIDC issuer.
///
/// Defaults point at the local dev stack (same ports as the web app). On the
/// Android emulator, `localhost` works thanks to `adb reverse` (see
/// `tool/adb-reverse.ps1`). Override any value at build time with --dart-define,
/// e.g. `--dart-define=CR_CATALOG=https://api.certready.app`.
class AppConfig {
  const AppConfig._();

  static const String catalog = String.fromEnvironment(
    'CR_CATALOG',
    defaultValue: 'http://localhost:18090',
  );
  static const String users = String.fromEnvironment(
    'CR_USERS',
    defaultValue: 'http://localhost:18091',
  );
  static const String enrollments = String.fromEnvironment(
    'CR_ENROLLMENTS',
    defaultValue: 'http://localhost:18092',
  );
  static const String progress = String.fromEnvironment(
    'CR_PROGRESS',
    defaultValue: 'http://localhost:18093',
  );
  static const String content = String.fromEnvironment(
    'CR_CONTENT',
    defaultValue: 'http://localhost:18094',
  );
  static const String exams = String.fromEnvironment(
    'CR_EXAMS',
    defaultValue: 'http://localhost:18095',
  );
  static const String problems = String.fromEnvironment(
    'CR_PROBLEMS',
    defaultValue: 'http://localhost:18096',
  );
  static const String judge = String.fromEnvironment(
    'CR_JUDGE',
    defaultValue: 'http://localhost:18097',
  );
  static const String dss = String.fromEnvironment(
    'CR_DSS',
    defaultValue: 'http://localhost:18098',
  );

  // --- OIDC ---
  static const String oidcIssuer = String.fromEnvironment(
    'CR_OIDC',
    defaultValue: 'http://localhost:9099',
  );
  // Debe coincidir con la audiencia que validan los servicios Go: el mock OIDC
  // emite `aud = client_id` y en dev los servicios esperan `certready-web`
  // (igual que la web). Con otro valor, el token daría 401 en todo lo protegido.
  static const String oidcClientId = String.fromEnvironment(
    'CR_CLIENT_ID',
    defaultValue: 'certready-web',
  );

  /// Redirect URI for the auth-code flow. With the dev mock (auto-approves) we
  /// never actually navigate here: we read the `code` from the 302 `Location`.
  /// For real Cognito on mobile, this becomes a custom scheme / app link handled
  /// by the system browser (integrated in the release increment).
  static const String oidcRedirect = String.fromEnvironment(
    'CR_REDIRECT',
    defaultValue: 'certready://auth/callback',
  );

  /// True when pointing at the local dev issuer (auto-approve, plain HTTP ok).
  static bool get isDevIssuer =>
      oidcIssuer.contains('localhost') || oidcIssuer.contains('10.0.2.2');
}
