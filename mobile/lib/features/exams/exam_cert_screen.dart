import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

class _Datos {
  _Datos(this.cert, this.sesiones);
  final Certificacion cert;
  final List<SesionExamen> sesiones;
}

/// Per-certification exams: start a simulacro + history of finished sessions.
class ExamCertScreen extends ConsumerStatefulWidget {
  const ExamCertScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<ExamCertScreen> createState() => _ExamCertScreenState();
}

class _ExamCertScreenState extends ConsumerState<ExamCertScreen> {
  late Future<_Datos> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Datos> _load() async {
    final api = ref.read(apiProvider);
    final cert = await api.getCertification(widget.slug);
    if (cert == null) throw ApiError(404);
    final exams = await api.listMyExams(limit: 100);
    final sesiones = exams.data
        .where((s) => s.certificacion == widget.slug && s.modo == 'simulacro')
        .toList();
    return _Datos(cert, sesiones);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Simulacro')),
      body: DataView<_Datos>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, d) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                d.cert.nombre,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Examen con formato real: preguntas mezcladas y calificación al final.',
                style: TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => context.push('/examenes/${widget.slug}/run'),
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Iniciar simulacro'),
              ),
              const SizedBox(height: 24),
              Text(
                'Historial (${d.sesiones.length})',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 8),
              if (d.sesiones.isEmpty)
                const Text(
                  'Aún no has hecho simulacros de esta certificación.',
                  style: TextStyle(color: Colors.black45),
                )
              else
                ...d.sesiones.map(
                  (s) => _SesionTile(slug: widget.slug, sesion: s),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SesionTile extends StatelessWidget {
  const _SesionTile({required this.slug, required this.sesion});
  final String slug;
  final SesionExamen sesion;

  @override
  Widget build(BuildContext context) {
    final finalizada = sesion.estado == 'finalizada' && sesion.puntaje != null;
    final pct = sesion.puntaje?.round() ?? 0;
    final aprobado = pct >= 72;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (aprobado ? CRColors.good : CRColors.brand)
              .withValues(alpha: 0.12),
          child: Text(
            finalizada ? '$pct' : '–',
            style: TextStyle(
              color: aprobado ? CRColors.good : CRColors.brand,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ),
        title: Text(finalizada ? 'Puntaje $pct%' : 'En curso'),
        subtitle: Text(sesion.iniciadoEn.split('T').first),
        trailing: finalizada ? const Icon(Icons.chevron_right) : null,
        onTap: finalizada
            ? () => context.push('/examenes/$slug/review/${sesion.id}')
            : null,
      ),
    );
  }
}
