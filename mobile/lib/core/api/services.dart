import 'package:dio/dio.dart';

import '../config.dart';
import 'client.dart';
import 'models.dart';

/// Typed calls to the Go services (`/v1/...`), mirror of `web/lib/api/services.ts`.
/// Only the endpoints used by the study core are included in this increment.
class ApiService {
  ApiService(this._dio);

  final Dio _dio;

  // --- helpers -------------------------------------------------------------

  Future<T> _get<T>(
    String url,
    T Function(Map<String, dynamic>) parse, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        url,
        queryParameters: _clean(query),
      );
      return parse(res.data ?? const {});
    } on DioException catch (e) {
      throw _toApiError(e);
    }
  }

  Future<Map<String, dynamic>?> _send(
    String url, {
    String method = 'POST',
    Object? body,
    Duration? timeout,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        url,
        data: body,
        options: Options(method: method, receiveTimeout: timeout),
      );
      return res.data;
    } on DioException catch (e) {
      throw _toApiError(e);
    }
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? q) {
    if (q == null) return null;
    final out = <String, dynamic>{};
    q.forEach((k, v) {
      if (v != null && v != '') out[k] = v;
    });
    return out.isEmpty ? null : out;
  }

  static ApiError _toApiError(DioException e) =>
      ApiError(e.response?.statusCode ?? 0, e.response?.data);

  // --- catalog -------------------------------------------------------------

  Future<PaginatedList<Certificacion>> listCertifications({
    String? proveedor,
    String? nivel,
    int? limit,
    int? offset,
  }) => _get(
    '${AppConfig.catalog}/v1/certifications',
    (j) => PaginatedList.fromJson(j, Certificacion.fromJson),
    query: {
      'proveedor': proveedor,
      'nivel': nivel,
      'limit': limit,
      'offset': offset,
    },
  );

  Future<Certificacion?> getCertification(String idOrSlug) async {
    try {
      return await _get(
        '${AppConfig.catalog}/v1/certifications/${Uri.encodeComponent(idOrSlug)}',
        Certificacion.fromJson,
      );
    } on ApiError catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  Future<List<Tema>> listTopics(String certId) async {
    final res = await _get<List<Tema>>(
      '${AppConfig.catalog}/v1/certifications/${Uri.encodeComponent(certId)}/topics',
      (j) => ((j['data'] as List?) ?? const [])
          .map((e) => Tema.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
    return res;
  }

  // --- users ---------------------------------------------------------------

  Future<Cuenta> getMe() => _get('${AppConfig.users}/v1/me', Cuenta.fromJson);

  // --- enrollments ---------------------------------------------------------

  Future<PaginatedList<Inscripcion>> listMyEnrollments() => _get(
    '${AppConfig.enrollments}/v1/me/enrollments',
    (j) => PaginatedList.fromJson(j, Inscripcion.fromJson),
  );

  Future<Inscripcion> createEnrollment({
    required String tipoObjetivo,
    required String objetivoId,
  }) async {
    final data = await _send(
      '${AppConfig.enrollments}/v1/enrollments',
      body: {'tipo_objetivo': tipoObjetivo, 'objetivo_id': objetivoId},
    );
    return Inscripcion.fromJson(data ?? const {});
  }

  Future<void> deleteEnrollment(String id) => _send(
    '${AppConfig.enrollments}/v1/enrollments/${Uri.encodeComponent(id)}',
    method: 'DELETE',
  );

  // --- content -------------------------------------------------------------

  Future<PaginatedList<Material>> listContent({
    String? certificacion,
    String? tema,
    int? limit,
    int? offset,
  }) => _get(
    '${AppConfig.content}/v1/content',
    (j) => PaginatedList.fromJson(j, Material.fromJson),
    query: {
      'certificacion': certificacion,
      'tema': tema,
      'limit': limit,
      'offset': offset,
    },
  );

  // --- progress ------------------------------------------------------------

  Future<Progreso> getMyProgress(String certificacion) => _get(
    '${AppConfig.progress}/v1/me/progress',
    Progreso.fromJson,
    query: {'certificacion': certificacion},
  );

  Future<void> completeLesson({
    required String certificacion,
    required String tema,
    required String materialId,
  }) => _send(
    '${AppConfig.progress}/v1/progress/lessons',
    body: {
      'certificacion': certificacion,
      'tema': tema,
      'material_id': materialId,
    },
  );

  Future<TemaProgreso> completeQuiz({
    required String certificacion,
    required String tema,
    required num puntaje,
  }) async {
    final data = await _send(
      '${AppConfig.progress}/v1/progress/quizzes',
      body: {'certificacion': certificacion, 'tema': tema, 'puntaje': puntaje},
    );
    return TemaProgreso.fromJson(data ?? const {});
  }

  /// submitQARevision registra la autoevaluación de una pregunta de entrevista
  /// (nivel 1=me costó · 2=regular · 3=bien). Alimenta la señal de Q&A del DSS.
  Future<void> submitQARevision({required String qaRef, required int nivel}) =>
      _send(
        '${AppConfig.progress}/v1/progress/qa',
        body: {'qa_ref': qaRef, 'nivel': nivel},
      );

  // --- exams (quiz por tema) ----------------------------------------------

  Future<SesionConPreguntas> createTemaQuiz({
    required String certificacion,
    required String tema,
    int numPreguntas = 6,
  }) async {
    final data = await _send(
      '${AppConfig.exams}/v1/exams/sessions',
      body: {
        'certificacion': certificacion,
        'tema': tema,
        'num_preguntas': numPreguntas,
        'modo': 'practica',
      },
    );
    return SesionConPreguntas.fromJson(data ?? const {});
  }

  Future<ResultadoExamen> submitExam(
    String sesionId,
    List<Map<String, dynamic>> respuestas,
  ) async {
    final data = await _send(
      '${AppConfig.exams}/v1/exams/sessions/${Uri.encodeComponent(sesionId)}/submit',
      body: {'respuestas': respuestas},
    );
    return ResultadoExamen.fromJson(data ?? const {});
  }

  // --- exams (simulacro + historial) --------------------------------------

  Future<PaginatedList<SesionExamen>> listMyExams({int? limit, int? offset}) =>
      _get(
        '${AppConfig.exams}/v1/me/exams',
        (j) => PaginatedList.fromJson(j, SesionExamen.fromJson),
        query: {'limit': limit, 'offset': offset},
      );

  Future<SesionConPreguntas> createSimulacro({
    required String certificacion,
    int numPreguntas = 65,
  }) async {
    final data = await _send(
      '${AppConfig.exams}/v1/exams/sessions',
      body: {
        'certificacion': certificacion,
        'num_preguntas': numPreguntas,
        'modo': 'simulacro',
      },
    );
    return SesionConPreguntas.fromJson(data ?? const {});
  }

  /// getExamResultado returns the graded result of a finished session (or null).
  Future<ResultadoExamen?> getExamResultado(String sesionId) async {
    try {
      final raw = await _get<Map<String, dynamic>>(
        '${AppConfig.exams}/v1/exams/sessions/${Uri.encodeComponent(sesionId)}',
        (j) => j,
      );
      final r = raw['resultado'];
      return r is Map<String, dynamic> ? ResultadoExamen.fromJson(r) : null;
    } on ApiError catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  // --- problems / qa -------------------------------------------------------

  Future<PaginatedList<Problema>> listProblems({
    String? area,
    String? dificultad,
    int? limit,
    int? offset,
  }) => _get(
    '${AppConfig.problems}/v1/problems',
    (j) => PaginatedList.fromJson(j, Problema.fromJson),
    query: {
      'area': area,
      'dificultad': dificultad,
      'limit': limit,
      'offset': offset,
    },
  );

  Future<Problema?> getProblem(String id) async {
    try {
      return await _get(
        '${AppConfig.problems}/v1/problems/${Uri.encodeComponent(id)}',
        Problema.fromJson,
      );
    } on ApiError catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  Future<PaginatedList<PreguntaQA>> listQA({
    String? puesto,
    String? area,
    List<String>? areas,
    int? limit,
    int? offset,
  }) => _get(
    '${AppConfig.problems}/v1/qa',
    (j) => PaginatedList.fromJson(j, PreguntaQA.fromJson),
    query: {
      'puesto': puesto,
      'area': area,
      // Varias áreas (p. ej. las de una especialidad) → filtro $in en el backend.
      'areas': (areas != null && areas.isNotEmpty) ? areas.join(',') : null,
      'limit': limit,
      'offset': offset,
    },
  );

  Future<PreguntaQA?> getQA(String id) async {
    try {
      return await _get(
        '${AppConfig.problems}/v1/qa/${Uri.encodeComponent(id)}',
        PreguntaQA.fromJson,
      );
    } on ApiError catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  // --- judge ---------------------------------------------------------------

  Future<RespuestaCorrida> submitJudge({
    required String problemaRef,
    required String lenguaje,
    required String fuente,
  }) async {
    final data = await _send(
      '${AppConfig.judge}/v1/judge/runs',
      body: {
        'problema_ref': problemaRef,
        'lenguaje': lenguaje,
        'fuente': fuente,
      },
      timeout: const Duration(seconds: 30),
    );
    return RespuestaCorrida.fromJson(data ?? const {});
  }

  // --- dss: readiness + analítica (degradan a null si el DSS no responde) --

  Future<Readiness?> getReadiness(
    String usuarioId,
    String certificacion,
  ) async {
    try {
      return await _get(
        '${AppConfig.dss}/v1/readiness/${Uri.encodeComponent(usuarioId)}',
        Readiness.fromJson,
        query: {'certificacion': certificacion},
      );
    } catch (_) {
      return null; // 404 sin datos o DSS/ClickHouse apagado
    }
  }

  Future<Analitica?> getAnalytics(
    String usuarioId,
    String certificacion,
  ) async {
    try {
      return await _get(
        '${AppConfig.dss}/v1/analytics/${Uri.encodeComponent(usuarioId)}',
        Analitica.fromJson,
        query: {'certificacion': certificacion},
      );
    } catch (_) {
      return null;
    }
  }

  // --- dss: preparación por puesto (degrada a [] / null si el DSS no responde) -

  /// listPuestos devuelve el catálogo de puestos (el endpoint responde un arreglo
  /// JSON de nivel superior, no un objeto, así que se llama a `dio` directo).
  Future<List<PuestoResumen>> listPuestos() async {
    try {
      final res = await _dio.get<List<dynamic>>('${AppConfig.dss}/v1/puestos');
      return (res.data ?? const [])
          .map((e) => PuestoResumen.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  Future<JobReadiness?> getJobReadiness(String usuarioId, String puesto) async {
    try {
      return await _get(
        '${AppConfig.dss}/v1/job-readiness/${Uri.encodeComponent(usuarioId)}',
        JobReadiness.fromJson,
        query: {'puesto': puesto},
      );
    } catch (_) {
      return null; // 404 puesto desconocido o DSS/ClickHouse apagado
    }
  }

  // --- dss: recomendador por CV (texto pegado → .txt multipart) ------------

  Future<Recomendaciones> getRecommendations(String textoCv) async {
    try {
      final form = FormData.fromMap({
        'file': MultipartFile.fromString(
          textoCv,
          filename: 'cv.txt',
          contentType: DioMediaType('text', 'plain'),
        ),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.dss}/v1/recommendations',
        data: form,
      );
      return Recomendaciones.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw _toApiError(e);
    }
  }

  /// getRecommendationsFile sube el archivo del CV (PDF/DOC/DOCX/TXT) al DSS, que
  /// extrae el texto según la extensión del nombre. Se preserva el filename real.
  Future<Recomendaciones> getRecommendationsFile({
    required List<int> bytes,
    required String filename,
  }) async {
    try {
      final ext = filename.contains('.')
          ? filename.split('.').last.toLowerCase()
          : '';
      final contentType = switch (ext) {
        'pdf' => DioMediaType('application', 'pdf'),
        'doc' => DioMediaType('application', 'msword'),
        'docx' => DioMediaType(
          'application',
          'vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
        _ => DioMediaType('text', 'plain'),
      };
      final form = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          bytes,
          filename: filename,
          contentType: contentType,
        ),
      });
      final res = await _dio.post<Map<String, dynamic>>(
        '${AppConfig.dss}/v1/recommendations',
        data: form,
      );
      return Recomendaciones.fromJson(res.data ?? const {});
    } on DioException catch (e) {
      throw _toApiError(e);
    }
  }
}
