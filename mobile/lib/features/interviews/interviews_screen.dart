import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/ui.dart';

({String label, Color color}) dificultadInfo(String d) {
  switch (d) {
    case 'facil':
      return (label: 'Fácil', color: const Color(0xFF16A34A));
    case 'dificil':
      return (label: 'Difícil', color: const Color(0xFFDC2626));
    default:
      return (label: 'Media', color: const Color(0xFFD97706));
  }
}

/// Entrevistas tab: coding problems (editor + judge) and interview Q&A.
class InterviewsScreen extends StatelessWidget {
  const InterviewsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Entrevistas'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Problemas'),
              Tab(text: 'Preguntas'),
            ],
          ),
        ),
        body: const TabBarView(children: [_ProblemsTab(), _QATab()]),
      ),
    );
  }
}

class _ProblemsTab extends ConsumerStatefulWidget {
  const _ProblemsTab();
  @override
  ConsumerState<_ProblemsTab> createState() => _ProblemsTabState();
}

class _ProblemsTabState extends ConsumerState<_ProblemsTab> {
  late Future<PaginatedList<Problema>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listProblems(limit: 100);
  }

  @override
  Widget build(BuildContext context) {
    return DataView<PaginatedList<Problema>>(
      future: _future,
      onRetry: () => setState(
        () => _future = ref.read(apiProvider).listProblems(limit: 100),
      ),
      builder: (context, page) {
        if (page.data.isEmpty) {
          return const Center(
            child: Text(
              'Aún no hay problemas.',
              style: TextStyle(color: Colors.black45),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: page.data.map((p) {
            final dif = dificultadInfo(p.dificultad);
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(
                  p.titulo,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(
                    spacing: 6,
                    children: [
                      CRChip(dif.label, color: dif.color),
                      if (p.area.isNotEmpty) CRChip(p.area),
                    ],
                  ),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/entrevistas/problema/${p.id}'),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class _QATab extends ConsumerStatefulWidget {
  const _QATab();
  @override
  ConsumerState<_QATab> createState() => _QATabState();
}

class _QATabState extends ConsumerState<_QATab> {
  late Future<PaginatedList<PreguntaQA>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listQA(limit: 100);
  }

  @override
  Widget build(BuildContext context) {
    return DataView<PaginatedList<PreguntaQA>>(
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
          children: page.data.map((q) {
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
            );
          }).toList(),
        );
      },
    );
  }
}
