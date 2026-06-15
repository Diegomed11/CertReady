import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart' as m;
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Lesson reader: the topic's study sheets (markdown), paginated, then "Hacer quiz".
class LessonScreen extends ConsumerStatefulWidget {
  const LessonScreen({super.key, required this.slug, required this.tema});

  final String slug;
  final String tema;

  @override
  ConsumerState<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends ConsumerState<LessonScreen> {
  late Future<List<m.Material>> _future;
  final _pageCtrl = PageController();
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _future = ref
        .read(apiProvider)
        .listContent(certificacion: widget.slug, tema: widget.tema, limit: 20)
        .then((p) => p.data);
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  Future<void> _irAlQuiz(List<m.Material> hojas) async {
    // Marca la lección como leída (best-effort) antes del quiz.
    if (hojas.isNotEmpty) {
      try {
        await ref
            .read(apiProvider)
            .completeLesson(
              certificacion: widget.slug,
              tema: widget.tema,
              materialId: hojas.first.id,
            );
      } catch (_) {
        /* no bloquea el quiz */
      }
    }
    if (!mounted) return;
    // Espera a que el quiz se cierre y entonces cierra también la lección, para
    // volver a la ruta de estudio (que recargará el progreso).
    await context.push('/estudiar/${widget.slug}/${widget.tema}/quiz');
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lección')),
      body: DataView<List<m.Material>>(
        future: _future,
        builder: (context, hojas) {
          if (hojas.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Aún no hay material para este tema.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () => _irAlQuiz(hojas),
                    child: const Text('Ir al quiz'),
                  ),
                ],
              ),
            );
          }
          final esUltima = _page >= hojas.length - 1;
          return Column(
            children: [
              Expanded(
                child: PageView.builder(
                  controller: _pageCtrl,
                  itemCount: hojas.length,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemBuilder: (context, i) {
                    final h = hojas[i];
                    return SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            h.titulo,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (h.formato == 'markdown')
                            MarkdownBody(data: h.contenido, selectable: false)
                          else
                            Text(
                              h.contenido,
                              style: const TextStyle(height: 1.55),
                            ),
                        ],
                      ),
                    ).animate(key: ValueKey(h.id)).fadeIn(duration: 280.ms);
                  },
                ),
              ),
              _BarraInferior(
                page: _page,
                total: hojas.length,
                esUltima: esUltima,
                onAnterior: _page == 0
                    ? null
                    : () => _pageCtrl.previousPage(
                        duration: _dur,
                        curve: Curves.ease,
                      ),
                onSiguiente: esUltima
                    ? () => _irAlQuiz(hojas)
                    : () => _pageCtrl.nextPage(
                        duration: _dur,
                        curve: Curves.ease,
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

const _dur = Duration(milliseconds: 250);

class _BarraInferior extends StatelessWidget {
  const _BarraInferior({
    required this.page,
    required this.total,
    required this.esUltima,
    required this.onAnterior,
    required this.onSiguiente,
  });

  final int page;
  final int total;
  final bool esUltima;
  final VoidCallback? onAnterior;
  final VoidCallback onSiguiente;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
        child: Row(
          children: [
            IconButton(
              onPressed: onAnterior,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  total,
                  (i) => Container(
                    width: 7,
                    height: 7,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i == page
                          ? CRColors.brand
                          : Colors.black.withValues(alpha: 0.15),
                    ),
                  ),
                ),
              ),
            ),
            FilledButton(
              // Botón en línea dentro de un Row: ancho según contenido (el tema
              // pone min-ancho infinito para botones de ancho completo, que aquí
              // rompería el layout).
              style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
              onPressed: onSiguiente,
              child: Text(esUltima ? 'Hacer quiz' : 'Siguiente'),
            ),
          ],
        ),
      ),
    );
  }
}
