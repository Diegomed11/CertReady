import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

class _Dash {
  _Dash({
    required this.cert,
    required this.hechos,
    required this.total,
    this.analitica,
    this.readiness,
  });
  final Certificacion cert;
  final int hechos;
  final int total;
  final Analitica? analitica;
  final Readiness? readiness;
}

/// Progress dashboard for one cert: study progress + (if available) the DSS
/// analytics (accuracy by topic) and readiness (pass probability).
class ProgressDashScreen extends ConsumerStatefulWidget {
  const ProgressDashScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<ProgressDashScreen> createState() => _ProgressDashScreenState();
}

class _ProgressDashScreenState extends ConsumerState<ProgressDashScreen> {
  late Future<_Dash> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Dash> _load() async {
    final api = ref.read(apiProvider);
    final cert = await api.getCertification(widget.slug);
    if (cert == null) throw ApiError(404);
    final prog = await api.getMyProgress(widget.slug);
    final temas = await api.listTopics(cert.id);
    final aprob = prog.temasAprobados;
    final hechos = temas.where((t) => aprob.contains(t.slug)).length;

    // DSS: keyed by JWT subject; degrades to null if off / no data.
    final sub = jwtSubject(ref.read(tokenStoreProvider).accessToken);
    Analitica? analitica;
    Readiness? readiness;
    if (sub != null) {
      analitica = await api.getAnalytics(sub, widget.slug);
      readiness = await api.getReadiness(sub, widget.slug);
    }
    return _Dash(
      cert: cert,
      hechos: hechos,
      total: temas.length,
      analitica: analitica,
      readiness: readiness,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Progreso')),
      body: DataView<_Dash>(
        future: _future,
        onRetry: () => setState(() {
          _future = _load();
        }),
        builder: (context, d) {
          final tieneAnalitica = d.analitica != null && d.analitica!.total > 0;
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
              const SizedBox(height: 16),

              // Estudio (siempre disponible)
              _Card(
                titulo: 'Estudio',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${d.hechos} de ${d.total} temas aprobados',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    TweenAnimationBuilder<double>(
                      tween: Tween(
                        begin: 0,
                        end: d.total == 0 ? 0 : d.hechos / d.total,
                      ),
                      duration: const Duration(milliseconds: 700),
                      curve: Curves.easeOutCubic,
                      builder: (_, v, _) => ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: v,
                          minHeight: 8,
                          backgroundColor: CRColors.brand.withValues(
                            alpha: 0.12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Readiness (si el DSS respondió)
              if (d.readiness != null)
                _Card(
                  titulo: 'Preparación estimada',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TweenAnimationBuilder<double>(
                        tween: Tween(
                          begin: 0,
                          end: d.readiness!.probabilidadAprobar * 100,
                        ),
                        duration: const Duration(milliseconds: 900),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, _) => Text(
                          '${v.round()}%',
                          style: const TextStyle(
                            fontSize: 40,
                            fontWeight: FontWeight.w800,
                            color: CRColors.brand,
                          ),
                        ),
                      ),
                      const Text(
                        'probabilidad de aprobar (estimación)',
                        style: TextStyle(color: Colors.black54),
                      ),
                      if (d.readiness!.siguienteAccion != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: CRColors.brand.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.tips_and_updates_rounded,
                                color: CRColors.brand,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Siguiente: ${d.readiness!.siguienteAccion!.tema} — ${d.readiness!.siguienteAccion!.motivo}',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

              // Acierto por tema (analítica de simulacros)
              if (tieneAnalitica)
                _Card(
                  titulo: 'Acierto por tema (simulacros)',
                  child: Column(
                    children: d.analitica!.porTema
                        .map(
                          (t) =>
                              _BarraTema(label: t.tema, pct: t.pct.toDouble()),
                        )
                        .toList(),
                  ),
                ),

              if (!tieneAnalitica && d.readiness == null)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'Aún no hay analítica: haz un simulacro para generar datos. (Si el motor de '
                    'analítica está apagado, se mostrará cuando esté disponible.)',
                    style: TextStyle(color: Colors.black45),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.titulo, required this.child});
  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              titulo,
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _BarraTema extends StatelessWidget {
  const _BarraTema({required this.label, required this.pct});
  final String label;
  final double pct; // 0-100

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                '${pct.round()}%',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 4),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: (pct / 100).clamp(0, 1).toDouble()),
            duration: const Duration(milliseconds: 750),
            curve: Curves.easeOutCubic,
            builder: (_, v, _) => ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: v,
                minHeight: 7,
                backgroundColor: CRColors.brand.withValues(alpha: 0.10),
                color: pct >= 70 ? CRColors.good : CRColors.brand,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
