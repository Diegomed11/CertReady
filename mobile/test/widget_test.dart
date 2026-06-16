// Smoke tests for the DTO parsing (no backend needed).
import 'package:certready/core/api/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('PaginatedList parsea data + count', () {
    final page = PaginatedList.fromJson<Certificacion>({
      'data': [
        {
          'id': 'u1',
          'slug': 'aws-saa',
          'nombre': 'AWS SAA',
          'proveedor': 'AWS',
          'nivel': 'associate',
        },
      ],
      'count': 1,
      'next_offset': null,
    }, Certificacion.fromJson);
    expect(page.count, 1);
    expect(page.data.single.slug, 'aws-saa');
    expect(page.data.single.proveedor, 'AWS');
  });

  test('Progreso expone los temas aprobados', () {
    final p = Progreso.fromJson({
      'lecciones': [],
      'temas': [
        {'tema': 't1', 'quiz_puntaje': 80, 'quiz_aprobado': true},
        {'tema': 't2', 'quiz_puntaje': 40, 'quiz_aprobado': false},
      ],
    });
    expect(p.temasAprobados, {'t1'});
  });

  test('ResultadoExamen calcula el porcentaje de aciertos', () {
    final r = ResultadoExamen.fromJson({
      'sesion_id': 's1',
      'puntaje': 75,
      'correctas': 3,
      'total': 4,
      'resultados': [],
    });
    expect(r.pct, 75);
  });

  test('PreguntaPublica distingue respuesta múltiple', () {
    final q = PreguntaPublica.fromJson({
      'ref': 'q1',
      'tema': 't1',
      'dificultad': 'media',
      'tipo': 'respuesta_multiple',
      'enunciado': '¿Cuáles?',
      'opciones': [
        {'id': 'a', 'texto': 'A'},
        {'id': 'b', 'texto': 'B'},
      ],
    });
    expect(q.esMultiple, isTrue);
    expect(q.opciones.length, 2);
  });

  test('ResultadoJuez detecta aceptado', () {
    final r = ResultadoJuez.fromJson({
      'veredicto': 'accepted',
      'casos_total': 5,
      'casos_pasados': 5,
      'duracion_ms': 120,
      'casos': [],
    });
    expect(r.aceptado, isTrue);
    expect(r.casosPasados, 5);
  });

  test('Problema parsea casos y plantillas', () {
    final p = Problema.fromJson({
      'id': 'p1',
      'titulo': 'Suma',
      'enunciado': '...',
      'dificultad': 'facil',
      'area': 'algoritmos',
      'etiquetas': ['arrays'],
      'lenguajes_permitidos': ['python'],
      'plantillas': {'python': 'def f(): pass'},
      'casos': [
        {'entrada': '1', 'salida_esperada': '1', 'oculto': false},
      ],
    });
    expect(p.lenguajesPermitidos.first, 'python');
    expect(p.plantillas['python'], 'def f(): pass');
    expect(p.casos.single.oculto, isFalse);
  });

  test('JobReadiness parsea readiness combinada + señales (con sin-datos)', () {
    final d = JobReadiness.fromJson({
      'usuario_id': 'u1',
      'puesto': 'backend',
      'nombre': 'Desarrollador(a) Backend',
      'readiness_pct': 62.5,
      'nivel': 'Sólido',
      'enfoque': 'Código',
      'senales': [
        {
          'clave': 'examenes',
          'etiqueta': 'Exámenes',
          'score_pct': 70.0,
          'peso': 0.25,
          'cobertura': 1,
          'detalle': '1 certificación(es) con intentos',
        },
        {
          'clave': 'codigo',
          'etiqueta': 'Código',
          'score_pct': null, // sin datos: debe quedar null
          'peso': 0.40,
          'cobertura': 0,
          'detalle': 'sin envíos de código',
        },
      ],
    });
    expect(d.readinessPct, 62.5);
    expect(d.nivel, 'Sólido');
    expect(d.enfoque, 'Código');
    expect(d.senales.length, 2);
    expect(d.senales[0].scorePct, 70.0);
    expect(d.senales[1].scorePct, isNull);
  });

  test('PuestoResumen parsea slug + nombre + áreas', () {
    final p = PuestoResumen.fromJson({
      'slug': 'backend',
      'nombre': 'Backend',
      'descripcion': 'Servicios y APIs',
      'qa_areas': ['sistemas', 'bases-de-datos'],
      'code_areas': ['algoritmos'],
    });
    expect(p.slug, 'backend');
    expect(p.nombre, 'Backend');
    expect(p.qaAreas, ['sistemas', 'bases-de-datos']);
    expect(p.codeAreas, ['algoritmos']);
  });

  test('Recomendaciones parsea perfil + recomendaciones', () {
    final r = Recomendaciones.fromJson({
      'perfil': {
        'skills': ['aws'],
        'areas': ['Nube'],
        'nivel': 'mid',
        'resumen': 'x',
      },
      'caminos': [],
      'recomendaciones': [
        {
          'slug': 'aws-saa',
          'nombre': 'AWS SAA',
          'proveedor': 'AWS',
          'area': 'Nube',
          'nivel': 'associate',
          'match_pct': 80,
          'por_que': 'match',
          'tiene_contenido': true,
          'slug_estudio': 'aws-saa',
        },
      ],
    });
    expect(r.perfil.areas, ['Nube']);
    expect(r.recomendaciones.single.tieneContenido, isTrue);
    expect(r.recomendaciones.single.slugEstudio, 'aws-saa');
  });
}
