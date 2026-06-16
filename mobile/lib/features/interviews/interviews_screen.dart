import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/ui.dart';

/// Entrevistas: banco de preguntas (Q&A) navegable por **especialidad**. Elegir
/// una especialidad filtra por sus áreas (que pueden compartirse entre varias).
/// (Los problemas de código se quitaron del móvil: codear en celular es incómodo.)
class InterviewsScreen extends ConsumerStatefulWidget {
  const InterviewsScreen({super.key});

  @override
  ConsumerState<InterviewsScreen> createState() => _InterviewsScreenState();
}

class _InterviewsScreenState extends ConsumerState<InterviewsScreen> {
  late Future<List<PuestoResumen>> _puestos;
  late Future<PaginatedList<PreguntaQA>> _future;
  String? _sel; // slug de la especialidad elegida (null = todas)

  @override
  void initState() {
    super.initState();
    _puestos = ref.read(apiProvider).listPuestos();
    _future = _load();
  }

  Future<PaginatedList<PreguntaQA>> _load() async {
    final api = ref.read(apiProvider);
    if (_sel == null) return api.listQA(limit: 100);
    final puestos = await _puestos;
    final esp = puestos.cast<PuestoResumen?>().firstWhere(
      (p) => p?.slug == _sel,
      orElse: () => null,
    );
    return api.listQA(areas: esp?.qaAreas, limit: 100);
  }

  void _select(String? slug) {
    if (slug == _sel) return;
    setState(() {
      _sel = slug;
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entrevistas')),
      body: Column(
        children: [
          // Filtro por especialidad (degrada a nada si el DSS no responde).
          FutureBuilder<List<PuestoResumen>>(
            future: _puestos,
            builder: (context, snap) {
              final puestos = snap.data ?? const <PuestoResumen>[];
              if (puestos.isEmpty) return const SizedBox.shrink();
              return SizedBox(
                height: 56,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  children: [
                    _chip('Todas', _sel == null, () => _select(null)),
                    for (final p in puestos)
                      _chip(p.nombre, _sel == p.slug, () => _select(p.slug)),
                  ],
                ),
              );
            },
          ),
          Expanded(
            child: DataView<PaginatedList<PreguntaQA>>(
              future: _future,
              onRetry: () => setState(() => _future = _load()),
              builder: (context, page) {
                if (page.data.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'No hay preguntas para esta especialidad.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.black45),
                      ),
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
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, bool sel, VoidCallback onTap) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: sel,
      onSelected: (_) => onTap(),
    ),
  );
}
