import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/client.dart';
import 'api/models.dart';
import 'api/services.dart';
import 'auth/oidc.dart';
import 'auth/token_store.dart';

/// Secure token storage (single instance).
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

/// OIDC client for the PKCE flow.
final oidcProvider = Provider<OidcClient>((ref) => OidcClient());

/// Configured API service. Depends only on the token store + OIDC client (NOT on
/// the auth controller) so there is no circular dependency: the 401 refresh hook
/// refreshes straight from the stored refresh token.
final apiProvider = Provider<ApiService>((ref) {
  final store = ref.watch(tokenStoreProvider);
  final oidc = ref.watch(oidcProvider);

  Future<TokenSet?> refresh() async {
    final rt = store.current?.refreshToken;
    if (rt == null) return null;
    try {
      final ts = await oidc.refresh(rt);
      await store.save(ts);
      return ts;
    } catch (_) {
      return null;
    }
  }

  return ApiService(buildApiDio(store, refresh));
});

/// Auth session: the logged-in account, or null when signed out.
final authProvider = AsyncNotifierProvider<AuthController, Cuenta?>(
  AuthController.new,
);

class AuthController extends AsyncNotifier<Cuenta?> {
  TokenStore get _store => ref.read(tokenStoreProvider);
  OidcClient get _oidc => ref.read(oidcProvider);

  @override
  Future<Cuenta?> build() async {
    final ts = await _store.load();
    if (ts == null) return null;
    try {
      // The interceptor refreshes on 401 automatically.
      return await ref.read(apiProvider).getMe();
    } catch (e) {
      if (e is ApiError && e.status == 401) await _store.clear();
      return null;
    }
  }

  /// login runs the OIDC flow for the given identity (dev: any email auto-approves).
  Future<void> login({String email = 'dev@local', String? name}) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final ts = await _oidc.login(email: email, name: name);
      await _store.save(ts);
      return ref.read(apiProvider).getMe();
    });
  }

  Future<void> logout() async {
    await _store.clear();
    state = const AsyncValue.data(null);
  }
}

/// jwtSubject decodes the `sub` claim from a JWT payload (no validation — used
/// only to key the auth-less DSS, which expects `usuario_id = sub`).
String? jwtSubject(String? token) {
  if (token == null) return null;
  final parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    final payload = utf8.decode(
      base64Url.decode(base64Url.normalize(parts[1])),
    );
    return (json.decode(payload) as Map<String, dynamic>)['sub'] as String?;
  } catch (_) {
    return null;
  }
}
