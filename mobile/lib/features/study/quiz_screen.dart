import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Topic quiz: fetches questions, collects answers, grades via the exams
/// service and records the result in progress (unlocks the next topic).
class QuizScreen extends ConsumerStatefulWidget {
  const QuizScreen({super.key, required this.slug, required this.tema});

  final String slug;
  final String tema;

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  bool _loading = true;
  Object? _error;
  SesionConPreguntas? _sesion;
  final Map<String, Set<String>> _sel = {};

  bool _enviando = false;
  ResultadoExamen? _resultado;
  TemaProgreso? _progreso;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _error = null;
      _resultado = null;
      _progreso = null;
      _sel.clear();
    });
    try {
      final s = await ref
          .read(apiProvider)
          .createTemaQuiz(certificacion: widget.slug, tema: widget.tema);
      setState(() {
        _sesion = s;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _toggle(PreguntaPublica q, String opt) {
    setState(() {
      final set = _sel.putIfAbsent(q.ref, () => <String>{});
      if (q.esMultiple) {
        set.contains(opt) ? set.remove(opt) : set.add(opt);
      } else {
        _sel[q.ref] = {opt};
      }
    });
  }

  bool get _todasRespondidas =>
      _sesion != null &&
      _sesion!.preguntas.every((q) => (_sel[q.ref]?.isNotEmpty ?? false));

  Future<void> _enviar() async {
    final s = _sesion!;
    setState(() => _enviando = true);
    try {
      final respuestas = s.preguntas
          .map(
            (q) => {
              'ref': q.ref,
              'seleccion': (_sel[q.ref] ?? const {}).toList(),
            },
          )
          .toList();
      final api = ref.read(apiProvider);
      final res = await api.submitExam(s.id, respuestas);
      final prog = await api.completeQuiz(
        certificacion: widget.slug,
        tema: widget.tema,
        puntaje: res.puntaje,
      );
      setState(() {
        _resultado = res;
        _progreso = prog;
        _enviando = false;
      });
    } catch (_) {
      setState(() => _enviando = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo calificar el quiz')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quiz')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorView(error: _error!, onRetry: _cargar);
    if (_resultado != null) {
      return _Resultado(
        resultado: _resultado!,
        aprobado: _progreso?.quizAprobado ?? false,
        // Cierra el quiz; la lección (que lo abrió) se cierra sola al volver y la
        // ruta de estudio recarga el progreso. Conserva el shell y el "atrás".
        onContinuar: () => context.pop(),
        onReintentar: _cargar,
      );
    }

    final preguntas = _sesion!.preguntas;
    if (preguntas.isEmpty) {
      return const Center(child: Text('Este tema aún no tiene preguntas.'));
    }
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            itemCount: preguntas.length,
            itemBuilder: (context, i) => _PreguntaCard(
              indice: i + 1,
              pregunta: preguntas[i],
              seleccion: _sel[preguntas[i].ref] ?? const {},
              onToggle: (opt) => _toggle(preguntas[i], opt),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: FilledButton(
              onPressed: (_todasRespondidas && !_enviando) ? _enviar : null,
              child: _enviando
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      _todasRespondidas
                          ? 'Enviar respuestas'
                          : 'Responde todas las preguntas',
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PreguntaCard extends StatelessWidget {
  const _PreguntaCard({
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

class _Resultado extends StatelessWidget {
  const _Resultado({
    required this.resultado,
    required this.aprobado,
    required this.onContinuar,
    required this.onReintentar,
  });

  final ResultadoExamen resultado;
  final bool aprobado;
  final VoidCallback onContinuar;
  final VoidCallback onReintentar;

  @override
  Widget build(BuildContext context) {
    final color = aprobado ? CRColors.good : CRColors.brand;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 12),
        Container(
              padding: const EdgeInsets.symmetric(vertical: 28),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Text(
                    '${resultado.puntaje.round()}%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 52,
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
                  const SizedBox(height: 8),
                  Text(
                    aprobado
                        ? '¡Tema aprobado! 🎉'
                        : 'Casi… vuelve a intentarlo',
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
              begin: const Offset(0.8, 0.8),
              end: const Offset(1, 1),
              duration: 500.ms,
              curve: Curves.elasticOut,
            ),
        const SizedBox(height: 20),
        ...resultado.resultados.asMap().entries.map(
          (e) => _RepasoItem(item: e.value)
              .animate()
              .fadeIn(delay: (e.key * 60).ms, duration: 260.ms)
              .slideY(begin: 0.1, end: 0, curve: Curves.easeOut),
        ),
        const SizedBox(height: 16),
        if (aprobado)
          FilledButton(onPressed: onContinuar, child: const Text('Continuar'))
        else ...[
          FilledButton(
            onPressed: onReintentar,
            child: const Text('Reintentar'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: onContinuar,
            child: const Text('Volver a la ruta'),
          ),
        ],
      ],
    );
  }
}

class _RepasoItem extends StatelessWidget {
  const _RepasoItem({required this.item});

  final ResultadoPregunta item;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              item.correcto ? Icons.check_circle_rounded : Icons.cancel_rounded,
              color: item.correcto
                  ? CRColors.good
                  : Theme.of(context).colorScheme.error,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item.explicacion.isEmpty
                    ? (item.correcto ? 'Correcta' : 'Incorrecta')
                    : item.explicacion,
                style: const TextStyle(height: 1.4, fontSize: 13.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
