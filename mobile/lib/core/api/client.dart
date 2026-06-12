import 'package:dio/dio.dart';

import '../auth/token_store.dart';

/// Error thrown by the API layer (mirror of `web/lib/api/client.ts` ApiError).
class ApiError implements Exception {
  ApiError(this.status, [this.body]);
  final int status;
  final dynamic body;

  String get mensaje {
    if (body is Map && (body as Map)['error'] is Map) {
      final e = (body as Map)['error'] as Map;
      return (e['message'] ?? 'error $status').toString();
    }
    return 'error $status';
  }

  @override
  String toString() => 'ApiError($status): $mensaje';
}

/// buildApiDio configures the shared Dio used for all Go services: it injects the
/// `Authorization: Bearer` header from the [store] and, on a 401, tries a single
/// token refresh (via [refresh]) before retrying the request.
Dio buildApiDio(TokenStore store, Future<TokenSet?> Function() refresh) {
  final dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 20),
      responseType: ResponseType.json,
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final tok = store.accessToken;
        if (tok != null) options.headers['Authorization'] = 'Bearer $tok';
        handler.next(options);
      },
      onError: (e, handler) async {
        final is401 = e.response?.statusCode == 401;
        final retried = e.requestOptions.extra['cr_retried'] == true;
        if (is401 && !retried) {
          final fresh = await refresh();
          if (fresh != null) {
            final req = e.requestOptions
              ..extra['cr_retried'] = true
              ..headers['Authorization'] = 'Bearer ${fresh.accessToken}';
            try {
              return handler.resolve(await dio.fetch(req));
            } catch (_) {
              // fall through to the original error
            }
          }
        }
        handler.next(e);
      },
    ),
  );

  return dio;
}
