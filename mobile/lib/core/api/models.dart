/// DTOs that mirror the Go services' JSON (manual mirror of
/// `web/lib/api/types.ts`). Only the models used by the study core are included
/// in this increment; more are added as features land.
library;

/// Paginated list wrapper used by catalog / enrollments / etc.
class PaginatedList<T> {
  PaginatedList({required this.data, required this.count, this.nextOffset});

  final List<T> data;
  final int count;
  final int? nextOffset;

  static PaginatedList<T> fromJson<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) item,
  ) {
    final raw = (json['data'] as List?) ?? const [];
    return PaginatedList<T>(
      data: raw.map((e) => item(e as Map<String, dynamic>)).toList(),
      count: (json['count'] as num?)?.toInt() ?? raw.length,
      nextOffset: (json['next_offset'] as num?)?.toInt(),
    );
  }
}

class Certificacion {
  Certificacion({
    required this.id,
    required this.slug,
    required this.nombre,
    required this.proveedor,
    required this.nivel,
    this.descripcion,
  });

  final String id;
  final String slug;
  final String nombre;
  final String proveedor;
  final String nivel;
  final String? descripcion;

  factory Certificacion.fromJson(Map<String, dynamic> j) => Certificacion(
    id: j['id'] as String,
    slug: j['slug'] as String,
    nombre: j['nombre'] as String,
    proveedor: (j['proveedor'] ?? '') as String,
    nivel: (j['nivel'] ?? '') as String,
    descripcion: j['descripcion'] as String?,
  );
}

class Tema {
  Tema({
    required this.id,
    required this.slug,
    required this.nombre,
    this.dominio,
    required this.orden,
  });

  final String id;
  final String slug;
  final String nombre;
  final String? dominio;
  final int orden;

  factory Tema.fromJson(Map<String, dynamic> j) => Tema(
    id: j['id'] as String,
    slug: j['slug'] as String,
    nombre: j['nombre'] as String,
    dominio: j['dominio'] as String?,
    orden: (j['orden'] as num?)?.toInt() ?? 0,
  );
}

class Material {
  Material({
    required this.id,
    required this.certificacion,
    required this.tema,
    required this.titulo,
    required this.formato,
    required this.contenido,
  });

  final String id;
  final String certificacion;
  final String tema;
  final String titulo;
  final String formato; // markdown | html | texto
  final String contenido;

  factory Material.fromJson(Map<String, dynamic> j) => Material(
    id: j['id'] as String,
    certificacion: (j['certificacion'] ?? '') as String,
    tema: (j['tema'] ?? '') as String,
    titulo: (j['titulo'] ?? '') as String,
    formato: (j['formato'] ?? 'markdown') as String,
    contenido: (j['contenido'] ?? '') as String,
  );
}

class Cuenta {
  Cuenta({
    required this.id,
    required this.email,
    this.nombre,
    required this.rol,
    this.creadoEn = '',
  });

  final String id;
  final String email;
  final String? nombre;
  final String rol; // estudiante | admin
  final String creadoEn; // ISO-8601 (creado_en)

  factory Cuenta.fromJson(Map<String, dynamic> j) => Cuenta(
    id: j['id'] as String,
    email: (j['email'] ?? '') as String,
    nombre: j['nombre'] as String?,
    rol: (j['rol'] ?? 'estudiante') as String,
    creadoEn: (j['creado_en'] ?? '') as String,
  );
}

class Inscripcion {
  Inscripcion({
    required this.id,
    required this.tipoObjetivo,
    required this.objetivoId,
    required this.estado,
  });

  final String id;
  final String tipoObjetivo; // certificacion | pista
  final String objetivoId;
  final String estado; // activa | pausada | completada | archivada

  factory Inscripcion.fromJson(Map<String, dynamic> j) => Inscripcion(
    id: j['id'] as String,
    tipoObjetivo: (j['tipo_objetivo'] ?? '') as String,
    objetivoId: (j['objetivo_id'] ?? '') as String,
    estado: (j['estado'] ?? 'activa') as String,
  );
}

// --- progress ---------------------------------------------------------------

class LeccionCompletada {
  LeccionCompletada({
    required this.tema,
    required this.materialId,
    required this.creadoEn,
  });

  final String tema;
  final String materialId;
  final String creadoEn;

  factory LeccionCompletada.fromJson(Map<String, dynamic> j) =>
      LeccionCompletada(
        tema: (j['tema'] ?? '') as String,
        materialId: (j['material_id'] ?? '') as String,
        creadoEn: (j['creado_en'] ?? '') as String,
      );
}

class TemaProgreso {
  TemaProgreso({
    required this.tema,
    required this.quizPuntaje,
    required this.quizAprobado,
  });

  final String tema;
  final num quizPuntaje;
  final bool quizAprobado;

  factory TemaProgreso.fromJson(Map<String, dynamic> j) => TemaProgreso(
    tema: (j['tema'] ?? '') as String,
    quizPuntaje: (j['quiz_puntaje'] as num?) ?? 0,
    quizAprobado: (j['quiz_aprobado'] as bool?) ?? false,
  );
}

class Progreso {
  Progreso({required this.lecciones, required this.temas});

  final List<LeccionCompletada> lecciones;
  final List<TemaProgreso> temas;

  /// Slugs of topics whose quiz is approved (used to gate the study path).
  Set<String> get temasAprobados =>
      temas.where((t) => t.quizAprobado).map((t) => t.tema).toSet();

  factory Progreso.fromJson(Map<String, dynamic> j) => Progreso(
    lecciones: ((j['lecciones'] as List?) ?? const [])
        .map((e) => LeccionCompletada.fromJson(e as Map<String, dynamic>))
        .toList(),
    temas: ((j['temas'] as List?) ?? const [])
        .map((e) => TemaProgreso.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

// --- exams (quiz por tema) --------------------------------------------------

class OpcionPregunta {
  OpcionPregunta({required this.id, required this.texto});

  final String id;
  final String texto;

  factory OpcionPregunta.fromJson(Map<String, dynamic> j) => OpcionPregunta(
    id: (j['id'] ?? '') as String,
    texto: (j['texto'] ?? '') as String,
  );
}

/// Question as seen by the student (no correct answer leaked).
class PreguntaPublica {
  PreguntaPublica({
    required this.ref,
    required this.tema,
    required this.dificultad,
    required this.tipo,
    required this.enunciado,
    required this.opciones,
  });

  final String ref;
  final String tema;
  final String dificultad;
  final String tipo; // opcion_multiple | respuesta_multiple
  final String enunciado;
  final List<OpcionPregunta> opciones;

  bool get esMultiple => tipo == 'respuesta_multiple';

  factory PreguntaPublica.fromJson(Map<String, dynamic> j) => PreguntaPublica(
    ref: (j['ref'] ?? '') as String,
    tema: (j['tema'] ?? '') as String,
    dificultad: (j['dificultad'] ?? '') as String,
    tipo: (j['tipo'] ?? 'opcion_multiple') as String,
    enunciado: (j['enunciado'] ?? '') as String,
    opciones: ((j['opciones'] as List?) ?? const [])
        .map((e) => OpcionPregunta.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class SesionConPreguntas {
  SesionConPreguntas({required this.id, required this.preguntas});

  final String id;
  final List<PreguntaPublica> preguntas;

  factory SesionConPreguntas.fromJson(Map<String, dynamic> j) =>
      SesionConPreguntas(
        id: j['id'] as String,
        preguntas: ((j['preguntas'] as List?) ?? const [])
            .map((e) => PreguntaPublica.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class ResultadoPregunta {
  ResultadoPregunta({
    required this.ref,
    required this.correcto,
    required this.seleccion,
    required this.respuestaCorrecta,
    required this.explicacion,
  });

  final String ref;
  final bool correcto;
  final List<String> seleccion;
  final List<String> respuestaCorrecta;
  final String explicacion;

  factory ResultadoPregunta.fromJson(Map<String, dynamic> j) =>
      ResultadoPregunta(
        ref: (j['ref'] ?? '') as String,
        correcto: (j['correcto'] as bool?) ?? false,
        seleccion: ((j['seleccion'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        respuestaCorrecta: ((j['respuesta_correcta'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        explicacion: (j['explicacion'] ?? '') as String,
      );
}

class ResultadoExamen {
  ResultadoExamen({
    required this.sesionId,
    required this.puntaje,
    required this.correctas,
    required this.total,
    required this.resultados,
  });

  final String sesionId;
  final num puntaje;
  final int correctas;
  final int total;
  final List<ResultadoPregunta> resultados;

  /// Percentage correct (0–100), independent of the raw `puntaje` scale.
  int get pct => total == 0 ? 0 : ((correctas / total) * 100).round();

  factory ResultadoExamen.fromJson(Map<String, dynamic> j) => ResultadoExamen(
    sesionId: (j['sesion_id'] ?? '') as String,
    puntaje: (j['puntaje'] as num?) ?? 0,
    correctas: (j['correctas'] as num?)?.toInt() ?? 0,
    total: (j['total'] as num?)?.toInt() ?? 0,
    resultados: ((j['resultados'] as List?) ?? const [])
        .map((e) => ResultadoPregunta.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

/// Exam session header (history list / simulacro).
class SesionExamen {
  SesionExamen({
    required this.id,
    required this.certificacion,
    required this.modo,
    required this.estado,
    this.puntaje,
    required this.iniciadoEn,
    this.finalizadoEn,
  });

  final String id;
  final String certificacion;
  final String modo; // simulacro | practica
  final String estado; // en_curso | finalizada
  final num? puntaje;
  final String iniciadoEn;
  final String? finalizadoEn;

  factory SesionExamen.fromJson(Map<String, dynamic> j) => SesionExamen(
    id: j['id'] as String,
    certificacion: (j['certificacion'] ?? '') as String,
    modo: (j['modo'] ?? 'simulacro') as String,
    estado: (j['estado'] ?? 'finalizada') as String,
    puntaje: j['puntaje'] as num?,
    iniciadoEn: (j['iniciado_en'] ?? '') as String,
    finalizadoEn: j['finalizado_en'] as String?,
  );
}

// --- problems / qa ----------------------------------------------------------

class CasoProblema {
  CasoProblema({
    required this.entrada,
    required this.salidaEsperada,
    required this.oculto,
  });
  final String entrada;
  final String salidaEsperada;
  final bool oculto;

  factory CasoProblema.fromJson(Map<String, dynamic> j) => CasoProblema(
    entrada: (j['entrada'] ?? '') as String,
    salidaEsperada: (j['salida_esperada'] ?? '') as String,
    oculto: (j['oculto'] as bool?) ?? false,
  );
}

/// Coding problem (public view: hidden cases come without expected output).
class Problema {
  Problema({
    required this.id,
    required this.titulo,
    required this.enunciado,
    required this.dificultad,
    required this.area,
    required this.etiquetas,
    required this.lenguajesPermitidos,
    required this.plantillas,
    required this.casos,
  });

  final String id;
  final String titulo;
  final String enunciado;
  final String dificultad;
  final String area;
  final List<String> etiquetas;
  final List<String> lenguajesPermitidos;
  final Map<String, String> plantillas; // lenguaje -> plantilla
  final List<CasoProblema> casos;

  factory Problema.fromJson(Map<String, dynamic> j) => Problema(
    id: j['id'] as String,
    titulo: (j['titulo'] ?? '') as String,
    enunciado: (j['enunciado'] ?? '') as String,
    dificultad: (j['dificultad'] ?? '') as String,
    area: (j['area'] ?? '') as String,
    etiquetas: ((j['etiquetas'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
    lenguajesPermitidos: ((j['lenguajes_permitidos'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
    plantillas:
        ((j['plantillas'] as Map?)?.map(
          (k, v) => MapEntry(k.toString(), v.toString()),
        )) ??
        const {},
    casos: ((j['casos'] as List?) ?? const [])
        .map((e) => CasoProblema.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

/// Interview Q&A item (self-study: includes the model answer).
class PreguntaQA {
  PreguntaQA({
    required this.id,
    required this.puesto,
    required this.area,
    required this.categoria,
    required this.enunciado,
    required this.respuestaModelo,
    required this.puntosClave,
  });

  final String id;
  final String puesto;
  final String area;
  final String categoria;
  final String enunciado;
  final String respuestaModelo;
  final List<String> puntosClave;

  factory PreguntaQA.fromJson(Map<String, dynamic> j) => PreguntaQA(
    id: j['id'] as String,
    puesto: (j['puesto'] ?? '') as String,
    area: (j['area'] ?? '') as String,
    categoria: (j['categoria'] ?? '') as String,
    enunciado: (j['enunciado'] ?? '') as String,
    respuestaModelo: (j['respuesta_modelo'] ?? '') as String,
    puntosClave: ((j['puntos_clave'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
  );
}

// --- judge ------------------------------------------------------------------

class ResultadoCaso {
  ResultadoCaso({
    required this.indice,
    required this.oculto,
    required this.estado,
    this.entrada,
    this.salidaEsperada,
    this.salidaObtenida,
  });

  final int indice;
  final bool oculto;
  final String estado; // passed | wrong | tle | mle | re | ce
  final String? entrada;
  final String? salidaEsperada;
  final String? salidaObtenida;

  factory ResultadoCaso.fromJson(Map<String, dynamic> j) => ResultadoCaso(
    indice: (j['indice'] as num?)?.toInt() ?? 0,
    oculto: (j['oculto'] as bool?) ?? false,
    estado: (j['estado'] ?? '') as String,
    entrada: j['entrada'] as String?,
    salidaEsperada: j['salida_esperada'] as String?,
    salidaObtenida: j['salida_obtenida'] as String?,
  );
}

class ResultadoJuez {
  ResultadoJuez({
    required this.veredicto,
    required this.casosTotal,
    required this.casosPasados,
    required this.duracionMs,
    required this.casos,
  });

  final String veredicto; // accepted | wrong_answer | time_limit_exceeded | ...
  final int casosTotal;
  final int casosPasados;
  final int duracionMs;
  final List<ResultadoCaso> casos;

  bool get aceptado => veredicto == 'accepted';

  factory ResultadoJuez.fromJson(Map<String, dynamic> j) => ResultadoJuez(
    veredicto: (j['veredicto'] ?? '') as String,
    casosTotal: (j['casos_total'] as num?)?.toInt() ?? 0,
    casosPasados: (j['casos_pasados'] as num?)?.toInt() ?? 0,
    duracionMs: (j['duracion_ms'] as num?)?.toInt() ?? 0,
    casos: ((j['casos'] as List?) ?? const [])
        .map((e) => ResultadoCaso.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

/// Response of POST /v1/judge/runs (we only need the resultado for the UI).
class RespuestaEjecucion {
  RespuestaEjecucion({required this.resultado});
  final ResultadoJuez resultado;

  factory RespuestaEjecucion.fromJson(Map<String, dynamic> j) => RespuestaEjecucion(
    resultado: ResultadoJuez.fromJson(
      (j['resultado'] as Map<String, dynamic>?) ?? const {},
    ),
  );
}

// --- dss: readiness ---------------------------------------------------------

class CeldaDominio {
  CeldaDominio({
    required this.tema,
    required this.dificultad,
    required this.dominioPct,
    required this.intentos,
  });
  final String tema;
  final String dificultad;
  final num dominioPct;
  final int intentos;

  factory CeldaDominio.fromJson(Map<String, dynamic> j) => CeldaDominio(
    tema: (j['tema'] ?? '') as String,
    dificultad: (j['dificultad'] ?? '') as String,
    dominioPct: (j['dominio_pct'] as num?) ?? 0,
    intentos: (j['intentos'] as num?)?.toInt() ?? 0,
  );
}

class SiguienteAccion {
  SiguienteAccion({
    required this.tema,
    required this.dificultad,
    required this.motivo,
  });
  final String tema;
  final String dificultad;
  final String motivo;

  factory SiguienteAccion.fromJson(Map<String, dynamic> j) => SiguienteAccion(
    tema: (j['tema'] ?? '') as String,
    dificultad: (j['dificultad'] ?? '') as String,
    motivo: (j['motivo'] ?? '') as String,
  );
}

class Readiness {
  Readiness({
    required this.readinessPct,
    required this.probabilidadAprobar,
    required this.porCelda,
    this.siguienteAccion,
  });

  final num readinessPct;
  final num probabilidadAprobar;
  final List<CeldaDominio> porCelda;
  final SiguienteAccion? siguienteAccion;

  factory Readiness.fromJson(Map<String, dynamic> j) => Readiness(
    readinessPct: (j['readiness_pct'] as num?) ?? 0,
    probabilidadAprobar: (j['probabilidad_aprobar'] as num?) ?? 0,
    porCelda: ((j['por_celda'] as List?) ?? const [])
        .map((e) => CeldaDominio.fromJson(e as Map<String, dynamic>))
        .toList(),
    siguienteAccion: j['siguiente_accion'] == null
        ? null
        : SiguienteAccion.fromJson(
            j['siguiente_accion'] as Map<String, dynamic>,
          ),
  );
}

// --- dss: analítica ---------------------------------------------------------

class TemaAcierto {
  TemaAcierto({
    required this.tema,
    required this.aciertos,
    required this.total,
    required this.pct,
  });
  final String tema;
  final int aciertos;
  final int total;
  final num pct;

  factory TemaAcierto.fromJson(Map<String, dynamic> j) => TemaAcierto(
    tema: (j['tema'] ?? '') as String,
    aciertos: (j['aciertos'] as num?)?.toInt() ?? 0,
    total: (j['total'] as num?)?.toInt() ?? 0,
    pct: (j['pct'] as num?) ?? 0,
  );
}

class PuntoTendencia {
  PuntoTendencia({
    required this.fecha,
    required this.pct,
    required this.intentos,
  });
  final String fecha;
  final num pct;
  final int intentos;

  factory PuntoTendencia.fromJson(Map<String, dynamic> j) => PuntoTendencia(
    fecha: (j['fecha'] ?? '') as String,
    pct: (j['pct'] as num?) ?? 0,
    intentos: (j['intentos'] as num?)?.toInt() ?? 0,
  );
}

class Analitica {
  Analitica({
    required this.total,
    required this.aciertos,
    required this.pct,
    required this.porTema,
    required this.tendencia,
  });

  final int total;
  final int aciertos;
  final num pct;
  final List<TemaAcierto> porTema;
  final List<PuntoTendencia> tendencia;

  factory Analitica.fromJson(Map<String, dynamic> j) => Analitica(
    total: (j['total'] as num?)?.toInt() ?? 0,
    aciertos: (j['aciertos'] as num?)?.toInt() ?? 0,
    pct: (j['pct'] as num?) ?? 0,
    porTema: ((j['por_tema'] as List?) ?? const [])
        .map((e) => TemaAcierto.fromJson(e as Map<String, dynamic>))
        .toList(),
    tendencia: ((j['tendencia'] as List?) ?? const [])
        .map((e) => PuntoTendencia.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

// --- dss: preparación por puesto --------------------------------------------

/// A job role/specialty for which job readiness can be estimated.
class PuestoResumen {
  PuestoResumen({
    required this.slug,
    required this.nombre,
    required this.descripcion,
    this.qaAreas = const [],
    this.codeAreas = const [],
  });
  final String slug;
  final String nombre;
  final String descripcion;
  final List<String> qaAreas; // áreas conceptuales de Q&A de la especialidad
  final List<String> codeAreas; // áreas de código de la especialidad

  factory PuestoResumen.fromJson(Map<String, dynamic> j) => PuestoResumen(
    slug: (j['slug'] ?? '') as String,
    nombre: (j['nombre'] ?? '') as String,
    descripcion: (j['descripcion'] ?? '') as String,
    qaAreas: ((j['qa_areas'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
    codeAreas: ((j['code_areas'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
  );
}

/// One signal that makes up the job readiness (examenes | codigo | qa).
class SenalPreparacion {
  SenalPreparacion({
    required this.clave,
    required this.etiqueta,
    this.scorePct,
    required this.peso,
    required this.cobertura,
    required this.detalle,
  });
  final String clave;
  final String etiqueta;
  final num? scorePct; // null = sin datos
  final num peso;
  final int cobertura;
  final String detalle;

  factory SenalPreparacion.fromJson(Map<String, dynamic> j) => SenalPreparacion(
    clave: (j['clave'] ?? '') as String,
    etiqueta: (j['etiqueta'] ?? '') as String,
    scorePct: j['score_pct'] as num?,
    peso: (j['peso'] as num?) ?? 0,
    cobertura: (j['cobertura'] as num?)?.toInt() ?? 0,
    detalle: (j['detalle'] ?? '') as String,
  );
}

/// Combined readiness (exams + code + Q&A) of a user for a job role.
class JobReadiness {
  JobReadiness({
    required this.puesto,
    required this.nombre,
    this.readinessPct,
    required this.nivel,
    required this.senales,
    this.enfoque,
  });
  final String puesto;
  final String nombre;
  final num? readinessPct; // null = ninguna señal con datos
  final String nivel;
  final List<SenalPreparacion> senales;
  final String? enfoque;

  factory JobReadiness.fromJson(Map<String, dynamic> j) => JobReadiness(
    puesto: (j['puesto'] ?? '') as String,
    nombre: (j['nombre'] ?? '') as String,
    readinessPct: j['readiness_pct'] as num?,
    nivel: (j['nivel'] ?? '') as String,
    senales: ((j['senales'] as List?) ?? const [])
        .map((e) => SenalPreparacion.fromJson(e as Map<String, dynamic>))
        .toList(),
    enfoque: j['enfoque'] as String?,
  );
}

// --- dss: recomendador por CV -----------------------------------------------

class PasoCamino {
  PasoCamino({
    required this.slug,
    required this.nombre,
    required this.proveedor,
    required this.area,
    required this.nivel,
    required this.matchPct,
    required this.porQue,
    required this.tieneContenido,
    this.slugEstudio,
  });

  final String slug;
  final String nombre;
  final String proveedor;
  final String area;
  final String nivel;
  final num matchPct;
  final String porQue;
  final bool tieneContenido;
  final String? slugEstudio;

  factory PasoCamino.fromJson(Map<String, dynamic> j) => PasoCamino(
    slug: (j['slug'] ?? '') as String,
    nombre: (j['nombre'] ?? '') as String,
    proveedor: (j['proveedor'] ?? '') as String,
    area: (j['area'] ?? '') as String,
    nivel: (j['nivel'] ?? '') as String,
    matchPct: (j['match_pct'] as num?) ?? 0,
    porQue: (j['por_que'] ?? '') as String,
    tieneContenido: (j['tiene_contenido'] as bool?) ?? false,
    slugEstudio: j['slug_estudio'] as String?,
  );
}

class Camino {
  Camino({required this.nombre, required this.motivo, required this.pasos});
  final String nombre;
  final String motivo;
  final List<PasoCamino> pasos;

  factory Camino.fromJson(Map<String, dynamic> j) => Camino(
    nombre: (j['nombre'] ?? '') as String,
    motivo: (j['motivo'] ?? '') as String,
    pasos: ((j['pasos'] as List?) ?? const [])
        .map((e) => PasoCamino.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class PerfilCV {
  PerfilCV({
    required this.skills,
    required this.areas,
    required this.nivel,
    required this.resumen,
  });
  final List<String> skills;
  final List<String> areas;
  final String nivel;
  final String resumen;

  factory PerfilCV.fromJson(Map<String, dynamic> j) => PerfilCV(
    skills: ((j['skills'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
    areas: ((j['areas'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList(),
    nivel: (j['nivel'] ?? '') as String,
    resumen: (j['resumen'] ?? '') as String,
  );
}

class Recomendaciones {
  Recomendaciones({
    required this.perfil,
    required this.caminos,
    required this.recomendaciones,
  });
  final PerfilCV perfil;
  final List<Camino> caminos;
  final List<PasoCamino> recomendaciones;

  factory Recomendaciones.fromJson(Map<String, dynamic> j) => Recomendaciones(
    perfil: PerfilCV.fromJson(
      (j['perfil'] as Map<String, dynamic>?) ?? const {},
    ),
    caminos: ((j['caminos'] as List?) ?? const [])
        .map((e) => Camino.fromJson(e as Map<String, dynamic>))
        .toList(),
    recomendaciones: ((j['recomendaciones'] as List?) ?? const [])
        .map((e) => PasoCamino.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}
