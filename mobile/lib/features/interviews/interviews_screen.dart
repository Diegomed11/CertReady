import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/ui.dart';

/// Entrevistas: banco de preguntas (Q&A) por puesto/área para autoestudio.
/// (Los problemas de código se quitaron del móvil: codear en celular es incómodo.)
class InterviewsScreen extends ConsumerStatefulWidget {
  const InterviewsScreen({super.key});

  @override
  ConsumerState<InterviewsScreen> createState() => _InterviewsScreenState();
}

class _InterviewsScreenState extends ConsumerState<InterviewsScreen> {
  late Future<PaginatedList<PreguntaQA>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listQA(limit: 100);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entrevistas')),
      body: DataView<PaginatedList<PreguntaQA>>(
        future: _future,
        onRetry: () =>
            setState(() => _future = ref.read(apiProvider).listQA(limit: 100)),
        builder: (context, page) {
          if (page.data.isEmpty) {
            return const Center(
              child: Text(
                'Aún no hay preguntas.',
                style: TextStyle(color: Colors.black45),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Padding(
                padding: EdgeInsets.only(left: 4, bottom: 8),
                child: Text(
                  'Practica preguntas de entrevista: escribe tu respuesta y '
                  'compárala con la respuesta modelo.',
                  style: TextStyle(color: Colors.black54, height: 1.4),
                ),
              ),
              ...page.data.asMap().entries.map((e) {
                final q = e.value;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      q.enunciado,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Wrap(
                        spacing: 6,
                        children: [
                          if (q.area.isNotEmpty) CRChip(q.area),
                          if (q.categoria.isNotEmpty) CRChip(q.categoria),
                        ],
                      ),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/entrevistas/qa/${q.id}'),
                  ),
                ).crEnter(index: e.key);
              }),
            ],
          );
        },
      ),
    );
  }
}
