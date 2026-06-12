import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Interview Q&A detail: model answer + key points (self-study).
class QAScreen extends ConsumerStatefulWidget {
  const QAScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<QAScreen> createState() => _QAScreenState();
}

class _QAScreenState extends ConsumerState<QAScreen> {
  late Future<PreguntaQA?> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).getQA(widget.id);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pregunta')),
      body: DataView<PreguntaQA?>(
        future: _future,
        builder: (context, q) {
          if (q == null) {
            return const Center(child: Text('Pregunta no encontrada.'));
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Wrap(
                spacing: 6,
                children: [
                  if (q.area.isNotEmpty) CRChip(q.area),
                  if (q.categoria.isNotEmpty) CRChip(q.categoria),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                q.enunciado,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Respuesta modelo',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: CRColors.brand,
                ),
              ),
              const SizedBox(height: 8),
              MarkdownBody(data: q.respuestaModelo),
              if (q.puntosClave.isNotEmpty) ...[
                const SizedBox(height: 18),
                const Text(
                  'Puntos clave',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                ...q.puntosClave.map(
                  (p) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 3, right: 8),
                          child: Icon(
                            Icons.check_circle_outline_rounded,
                            size: 18,
                            color: CRColors.brand,
                          ),
                        ),
                        Expanded(
                          child: Text(p, style: const TextStyle(height: 1.4)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
