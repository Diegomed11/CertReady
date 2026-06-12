import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/ui.dart';
import '../common/examen_widgets.dart';

/// Review of a finished simulacro (score + per-question explanation).
class ExamReviewScreen extends ConsumerStatefulWidget {
  const ExamReviewScreen({
    super.key,
    required this.slug,
    required this.sesionId,
  });
  final String slug;
  final String sesionId;

  @override
  ConsumerState<ExamReviewScreen> createState() => _ExamReviewScreenState();
}

class _ExamReviewScreenState extends ConsumerState<ExamReviewScreen> {
  late Future<ResultadoExamen?> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).getExamResultado(widget.sesionId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Repaso')),
      body: DataView<ResultadoExamen?>(
        future: _future,
        builder: (context, res) {
          if (res == null) {
            return const Center(
              child: Text('No se pudo cargar el repaso de este examen.'),
            );
          }
          return ResultadoExamenView(resultado: res);
        },
      ),
    );
  }
}
