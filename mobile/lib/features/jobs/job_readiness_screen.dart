import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Job readiness: pick a role and see a combined readiness score (exams + code +
/// Q&A) with a per-signal breakdown. The DSS is optional; degrades to "sin datos".
class JobReadinessScreen extends ConsumerStatefulWidget {
  const JobReadinessScreen({super.key});

  @override
  ConsumerState<JobReadinessScreen> createState() => _JobReadinessScreenState();
}

class _JobReadinessScreenState extends ConsumerState<JobReadinessScreen> {
  late Future<List<PuestoResumen>> _future;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listPuestos();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Preparación por puesto')),
      body: DataView<List<PuestoResumen>>(
        future: _future,
        onRetry: () => setState(() {
          _future = ref.read(apiProvider).listPuestos();
        }),
        builder: (context, puestos) {
          if (puestos.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'El análisis por puesto no está disponible. Inténtalo más tarde.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.black54),
                ),
              ),
            );
          }
          return _PuestoView(puestos: puestos);
        },
      ),
    );
  }
}

/// Holds the selected role and (re)loads its readiness when it changes.
class _PuestoView extends ConsumerStatefulWidget {
  const _PuestoView({required this.puestos});
  final List<PuestoResumen> puestos;

  @override
  ConsumerState<_PuestoView> createState() => _PuestoViewState();
}

class _PuestoViewState extends ConsumerState<_PuestoView> {
  late String _sel;
  late Future<JobReadiness?> _future;

  @override
  void initState() {
    super.initState();
    _sel = widget.puestos.first.slug;
    _future = _load();
  }

  Future<JobReadiness?> _load() {
    // El `sub` lo saca el backend del JWT; ya no se manda en la ruta.
    return ref.read(apiProvider).getJobReadiness(_sel);
  }

  void _select(String slug) {
    if (slug == _sel) return;
    setState(() {
      _sel = slug;
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final activo = widget.puestos.firstWhere((p) => p.slug == _sel);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          '¿Qué tan listo estás?',
          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        const Text(
          'Combinamos tus simulacros, los problemas de código que resuelves y tu '
          'autoevaluación en preguntas de entrevista.',
          style: TextStyle(color: Colors.black54),
        ),
        const SizedBox(height: 14),

        // Selector de puesto
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            for (final p in widget.puestos)
              ChoiceChip(
                label: Text(p.nombre),
                selected: p.slug == _sel,
                showCheckmark: false,
                onSelected: (_) => _select(p.slug),
              ),
          ],
        ),
        const SizedBox(height: 14),

        Text(activo.descripcion, style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 16),

        FutureBuilder<JobReadiness?>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            final d = snap.data;
            if (d == null) {
              return const Text(
                'Aún no hay datos para este puesto. Haz un simulacro, resuelve '
                'problemas de código y autoevalúa preguntas de entrevista para verlo crecer.',
                style: TextStyle(color: Colors.black45),
              );
            }
            return _Readiness(datos: d);
          },
        ),
      ],
    );
  }
}

/// Combined gauge-like header + per-signal breakdown.
class _Readiness extends StatelessWidget {
  const _Readiness({required this.datos});
  final JobReadiness datos;

  @override
  Widget build(BuildContext context) {
    final pct = datos.readinessPct;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: (pct ?? 0).toDouble()),
                      duration: const Duration(milliseconds: 900),
                      curve: Curves.easeOutCubic,
                      builder: (_, v, _) => Text(
                        pct == null ? '—' : '${v.round()}%',
                        style: const TextStyle(
                          fontSize: 44,
                          fontWeight: FontWeight.w800,
                          color: CRColors.brand,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    CRChip(datos.nivel),
                  ],
                ),
                const Text(
                  'preparación estimada para el puesto',
                  style: TextStyle(color: Colors.black54),
                ),
                if (datos.enfoque != null) ...[
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
                            'Dónde enfocarte: ${datos.enfoque} — es la señal con menor avance hoy.',
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
        ),
        const SizedBox(height: 14),
        const Text(
          'Desglose por señal',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
        ),
        const SizedBox(height: 4),
        const Text(
          'Cada señal aporta según su peso. Las señales sin datos no cuentan en el total.',
          style: TextStyle(color: Colors.black54, fontSize: 13),
        ),
        const SizedBox(height: 12),
        ...datos.senales.map((s) => _BarraSenal(senal: s)),
      ],
    );
  }
}

/// One signal bar: label + weight, score (or "sin datos"), and detail line.
class _BarraSenal extends StatelessWidget {
  const _BarraSenal({required this.senal});
  final SenalPreparacion senal;

  @override
  Widget build(BuildContext context) {
    final pct = senal.scorePct;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${senal.etiqueta}  ·  peso ${(senal.peso * 100).round()}%',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                pct == null ? 'sin datos' : '${pct.round()}%',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: pct == null ? Colors.black38 : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          TweenAnimationBuilder<double>(
            tween: Tween(
              begin: 0,
              end: ((pct ?? 0) / 100).clamp(0, 1).toDouble(),
            ),
            duration: const Duration(milliseconds: 750),
            curve: Curves.easeOutCubic,
            builder: (_, v, _) => ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: v,
                minHeight: 7,
                backgroundColor: CRColors.brand.withValues(alpha: 0.10),
                color: (pct ?? 0) >= 70 ? CRColors.good : CRColors.brand,
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            senal.detalle,
            style: const TextStyle(color: Colors.black45, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
