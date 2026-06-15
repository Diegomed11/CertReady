import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

import '../config.dart';
import 'token_store.dart';

/// OIDC discovery document (only the bits we use).
class _Discovery {
  _Discovery(this.authorize, this.token);
  final String authorize;
  final String token;
}

/// Minimal OIDC client: Authorization Code + PKCE against the configured issuer.
///
/// In dev the issuer is the mock (`tools/oidc-mock`), which **auto-approves**, so
/// the whole flow runs over HTTP without a browser: we request `/authorize` with
/// `followRedirects:false` and read the `code` from the 302 `Location`, then
/// exchange it at `/token`. For real Cognito on mobile a browser-based flow
/// (system browser) is added in the release increment.
class OidcClient {
  OidcClient([Dio? dio])
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              followRedirects: false,
              validateStatus: (s) => s != null && s < 400,
            ),
          );

  final Dio _dio;
  _Discovery? _disco;

  Future<_Discovery> _discover() async {
    if (_disco != null) return _disco!;
    final res = await _dio.getUri<Map<String, dynamic>>(
      Uri.parse('${AppConfig.oidcIssuer}/.well-known/openid-configuration'),
      options: Options(responseType: ResponseType.json),
    );
    final j = res.data!;
    _disco = _Discovery(
      j['authorization_endpoint'] as String,
      j['token_endpoint'] as String,
    );
    return _disco!;
  }

  /// login runs the auth-code+PKCE flow and returns the token set. `email`/`name`
  /// are passed to the dev mock so it issues a token for that identity.
  Future<TokenSet> login({String email = 'dev@local', String? name}) async {
    final disco = await _discover();
    final verifier = _randomString(64);
    final challenge = _s256(verifier);
    final state = _randomString(24);
    final nonce = _randomString(24);

    final authUri = Uri.parse(disco.authorize).replace(
      queryParameters: {
        'response_type': 'code',
        'client_id': AppConfig.oidcClientId,
        'redirect_uri': AppConfig.oidcRedirect,
        'scope': 'openid email profile',
        'state': state,
        'nonce': nonce,
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
        'email': email,
        if (name != null && name.isNotEmpty) 'name': name,
      },
    );

    final res = await _dio.getUri<dynamic>(
      authUri,
      options: Options(
        followRedirects: false,
        validateStatus: (s) => s != null && s < 400,
      ),
    );
    final location = res.headers.value('location');
    if (location == null) {
      throw const OidcException(
        'el emisor no devolvió redirección con el código',
      );
    }
    final cbUri = Uri.parse(location);
    final code = cbUri.queryParameters['code'];
    if (code == null) {
      final err = cbUri.queryParameters['error'] ?? 'sin código';
      throw OidcException('autorización rechazada: $err');
    }

    return _exchange({
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': AppConfig.oidcRedirect,
      'client_id': AppConfig.oidcClientId,
      'code_verifier': verifier,
    });
  }

  /// loginNative verifica email + contraseña contra el IdP (endpoint /login) y
  /// devuelve el token set. Flujo first-party (en prod = API de Cognito).
  Future<TokenSet> loginNative({
    required String email,
    required String password,
  }) => _native('/login', {'email': email, 'password': password});

  /// registerNative crea la cuenta en el IdP (/register) y devuelve los tokens.
  Future<TokenSet> registerNative({
    required String email,
    required String password,
    required String name,
  }) => _native('/register', {
    'email': email,
    'password': password,
    'name': name,
  });

  Future<TokenSet> _native(String path, Map<String, dynamic> body) async {
    Response<Map<String, dynamic>> res;
    try {
      res = await _dio.postUri<Map<String, dynamic>>(
        Uri.parse('${AppConfig.oidcIssuer}$path'),
        data: {...body, 'client_id': AppConfig.oidcClientId},
        options: Options(
          contentType: Headers.jsonContentType,
          responseType: ResponseType.json,
          validateStatus: (_) => true, // leemos {error} de los 4xx nosotros
        ),
      );
    } on DioException {
      throw const OidcException(
        'No se pudo contactar al servidor. ¿El stack local está arriba?',
      );
    }
    final status = res.statusCode ?? 0;
    final j = res.data ?? const <String, dynamic>{};
    if (status < 200 || status >= 300) {
      throw OidcException((j['error'] as String?) ?? 'No se pudo autenticar');
    }
    final expiresIn = (j['expires_in'] as num?)?.toInt() ?? 3600;
    return TokenSet(
      accessToken: j['access_token'] as String,
      refreshToken: j['refresh_token'] as String?,
      idToken: j['id_token'] as String?,
      expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
    );
  }

  /// refresh exchanges a refresh token for a fresh token set.
  Future<TokenSet> refresh(String refreshToken) async {
    return _exchange({
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken,
      'client_id': AppConfig.oidcClientId,
    });
  }

  Future<TokenSet> _exchange(Map<String, String> form) async {
    final disco = await _discover();
    final res = await _dio.postUri<Map<String, dynamic>>(
      Uri.parse(disco.token),
      data: form,
      options: Options(
        contentType: Headers.formUrlEncodedContentType,
        responseType: ResponseType.json,
      ),
    );
    final j = res.data!;
    final expiresIn = (j['expires_in'] as num?)?.toInt() ?? 3600;
    return TokenSet(
      accessToken: j['access_token'] as String,
      refreshToken: j['refresh_token'] as String?,
      idToken: j['id_token'] as String?,
      expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
    );
  }

  static final _rnd = Random.secure();

  static String _randomString(int len) {
    final bytes = List<int>.generate(len, (_) => _rnd.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '').substring(0, len);
  }

  static String _s256(String input) {
    return _base64UrlNoPad(sha256.convert(ascii.encode(input)).bytes);
  }

  static String _base64UrlNoPad(List<int> bytes) =>
      base64Url.encode(bytes).replaceAll('=', '');
}

class OidcException implements Exception {
  const OidcException(this.message);
  final String message;
  @override
  String toString() => message;
}
