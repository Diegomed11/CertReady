import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/api/models.dart';
import '../../core/theme.dart';

/// A single answerable question (radio for single, checkbox for multiple).
class PreguntaCard extends StatelessWidget {
  const PreguntaCard({
    super.key,
    required this.indice,
    required this.pregunta,
    required this.seleccion,
    required this.onToggle,
  });

  final int indice;
  final PreguntaPublica pregunta;
  final Set<String> seleccion;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pregunta $indice',
              style: const TextStyle(
                fontSize: 12,
                color: Colors.black45,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              pregunta.enunciado,
              style: const TextStyle(fontWeight: FontWeight.w600, height: 1.4),
            ),
            if (pregunta.esMultiple)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Selecciona todas las que apliquen',
                  style: TextStyle(
                    fontSize: 12,
                    color: CRColors.brand,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            const SizedBox(height: 8),
            ...pregunta.opciones.map((o) {
              final marcada = seleccion.contains(o.id);
              return InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onToggle(o.id),
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: marcada
                          ? CRColors.brand
                          : Colors.black.withValues(alpha: 0.12),
                      width: marcada ? 2 : 1,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    color: marcada
                        ? CRColors.brand.withValues(alpha: 0.06)
                        : null,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        pregunta.esMultiple
                            ? (marcada
                                  ? Icons.check_box_rounded
                                  : Icons.check_box_outline_blank_rounded)
                            : (marcada
                                  ? Icons.radio_button_checked_rounded
                                  : Icons.radio_button_off_rounded),
                        color: marcada ? CRColors.brand : Colors.black38,
                        size: 22,
                      ),
                      const SizedBox(width: 10),
                      Expanded(child: Text(o.texto)),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

/// Graded result header + per-question review (shared by the exam runner and
/// the history review screen).
class ResultadoExamenView extends StatelessWidget {
  const ResultadoExamenView({
    super.key,
    required this.resultado,
    this.aprobadoCorte = 72,
  });

  final ResultadoExamen resultado;
  final int aprobadoCorte;

  @override
  Widget build(BuildContext context) {
    final pct = resultado.puntaje.round();
    final aprobado = pct >= aprobadoCorte;
    final color = aprobado ? CRColors.good : CRColors.brand;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
              padding: const EdgeInsets.symmetric(vertical: 26),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Text(
                    '$pct%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '${resultado.correctas} de ${resultado.total} correctas',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    aprobado ? 'Aprobado ✓' : 'Sigue practicando',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            )
            .animate()
            .fadeIn(duration: 400.ms)
            .scale(
              begin: const Offset(0.85, 0.85),
              end: const Offset(1, 1),
              duration: 500.ms,
              curve: Curves.easeOutBack,
            ),
        const SizedBox(height: 18),
        const Text(
          'Repaso',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        ),
        const SizedBox(height: 8),
        ...resultado.resultados.asMap().entries.map(
          (e) =>
              Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            e.value.correcto
                                ? Icons.check_circle_rounded
                                : Icons.cancel_rounded,
                            color: e.value.correcto
                                ? CRColors.good
                                : Theme.of(context).colorScheme.error,
                            size: 22,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              e.value.explicacion.isEmpty
                                  ? (e.value.correcto
                                        ? 'Correcta'
                                        : 'Incorrecta')
                                  : e.value.explicacion,
                              style: const TextStyle(
                                height: 1.4,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .animate()
                  .fadeIn(delay: (e.key * 45).ms, duration: 240.ms)
                  .slideY(
                    begin: 0.12,
                    end: 0,
                    delay: (e.key * 45).ms,
                    duration: 240.ms,
                    curve: Curves.easeOut,
                  ),
        ),
      ],
    );
  }
}
