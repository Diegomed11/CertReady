import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

class _Avance {
  _Avance(this.cert, this.hechos, this.total, this.pct);
  final Certificacion cert;
  final int hechos;
  final int total;
  final int pct;
}

class _PanelData {
  _PanelData(this.cuenta, this.avances);
  final Cuenta cuenta;
  final List<_Avance> avances;
}

/// Student home: greeting + enrolled certifications with their progress.
class PanelScreen extends ConsumerStatefulWidget {
  const PanelScreen({super.key});

  @override
  ConsumerState<PanelScreen> createState() => _PanelScreenState();
}

class _PanelScreenState extends ConsumerState<PanelScreen> {
  late Future<_PanelData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_PanelData> _load() async {
    final api = ref.read(apiProvider);
    final cuenta = await api.getMe();
    final enr = await api.listMyEnrollments();
    final avances = <_Avance>[];
    for (final i in enr.data.where((e) => e.tipoObjetivo == 'certificacion')) {
      final cert = await api.getCertification(i.objetivoId);
      if (cert == null) continue;
      final prog = await api.getMyProgress(cert.slug);
      final temas = await api.listTopics(cert.id);
      final aprob = prog.temasAprobados;
      final total = temas.length;
      final hechos = temas.where((t) => aprob.contains(t.slug)).length;
      avances.add(
        _Avance(
          cert,
          hechos,
          total,
          total == 0 ? 0 : ((hechos / total) * 100).round(),
        ),
      );
    }
    return _PanelData(cuenta, avances);
  }

  void _reload() => setState(() {
    _future = _load();
  });

  @override
  Widget build(BuildContext context) {
    // Recarga cuando cambian las inscripciones (inscribir/cancelar en el detalle).
    ref.listen(enrollmentsRevProvider, (_, _) => _reload());
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inicio'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: DataView<_PanelData>(
          future: _future,
          onRetry: _reload,
          builder: (context, d) {
            final nombre = d.cuenta.nombre ?? d.cuenta.email.split('@').first;
            final hayInscripciones = d.avances.isNotEmpty;
            final promedio = hayInscripciones
                ? (d.avances.map((a) => a.pct).reduce((x, y) => x + y) /
                          d.avances.length)
                      .round()
                : 0;
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Hola, $nombre 👋',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                  ),
                ).crScaleIn(),
                const SizedBox(height: 4),
                Text(
                  hayInscripciones
                      ? 'Retoma tu ruta de estudio.'
                      : 'Elige una certificación para armar tu ruta de estudio.',
                  style: const TextStyle(color: Colors.black54),
                ).crEnter(index: 1),

                // Resumen rápido de un vistazo (solo con inscripciones).
                if (hayInscripciones) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      CRChip('${d.avances.length} en curso'),
                      CRChip('$promedio% promedio', color: CRColors.good),
                    ],
                  ).crEnter(index: 2),
                ],

                const SizedBox(height: 20),
                _PerfilTile(
                  cuenta: d.cuenta,
                  onTap: () async {
                    await context.push('/perfil');
                    if (mounted) _reload();
                  },
                ).crScaleIn(index: 3),

                const SizedBox(height: 22),
                _MiCaminoTile(onTap: () => context.push('/recomendaciones'))
                    .crScaleIn(index: 4)
                    .animate(onPlay: (controller) => controller.repeat())
                    .shimmer(
                      delay: 2000.ms,
                      duration: 1500.ms,
                      color: Colors.white24,
                    ),
                const SizedBox(height: 12),
                _PreparacionTile(
                  onTap: () => context.push('/preparacion'),
                ).crScaleIn(index: 5),

                const SizedBox(height: 24),
                if (hayInscripciones) ...[
                  const _SeccionTitulo(
                    'Continúa donde lo dejaste',
                  ).crEnter(index: 6),
                  const SizedBox(height: 10),
                  ...d.avances.asMap().entries.map(
                    (e) =>
                        _AvanceCard(avance: e.value).crEnter(index: e.key + 7),
                  ),
                ] else
                  _VacioInscripciones(
                    onExplorar: () => context.go('/certs'),
                  ).crEnter(index: 6),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _AvanceCard extends StatelessWidget {
  const _AvanceCard({required this.avance});

  final _Avance avance;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Monograma(avance.cert.proveedor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    avance.cert.nombre,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  '${avance.pct}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: CRColors.brand,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TweenAnimationBuilder<double>(
              tween: Tween(
                begin: 0,
                end: avance.total == 0 ? 0 : avance.hechos / avance.total,
              ),
              duration: 1200.ms,
              curve: Curves.elasticOut,
              builder: (_, v, _) => ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: v,
                  minHeight: 10,
                  backgroundColor: CRColors.brand.withValues(alpha: 0.12),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${avance.hechos} de ${avance.total} temas',
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
                TextButton(
                  onPressed: () =>
                      context.push('/estudiar/${avance.cert.slug}'),
                  child: const Text('Seguir'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Small bold section heading used across the home screen.
class _SeccionTitulo extends StatelessWidget {
  const _SeccionTitulo(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Text(
      texto,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.2,
      ),
    );
  }
}

/// Account entry on the home: avatar + name + email; opens `/perfil`.
class _PerfilTile extends StatelessWidget {
  const _PerfilTile({required this.cuenta, required this.onTap});

  final Cuenta cuenta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final nombre = (cuenta.nombre?.trim().isNotEmpty ?? false)
        ? cuenta.nombre!.trim()
        : cuenta.email.split('@').first;
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Monograma(nombre),
        title: Text(
          nombre,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          cuenta.email,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.black54),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

class _VacioInscripciones extends StatelessWidget {
  const _VacioInscripciones({required this.onExplorar});

  final VoidCallback onExplorar;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
        child: Column(
          children: [
            const Icon(
              Icons.rocket_launch_rounded,
              size: 48,
              color: CRColors.brand,
            ),
            const SizedBox(height: 12),
            const Text(
              'Aún no tienes inscripciones',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onExplorar,
              child: const Text('Explorar catálogo'),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Mi camino" entry: opens the CV-based recommender.
class _MiCaminoTile extends StatelessWidget {
  const _MiCaminoTile({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: CRColors.brandGradient,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            const Icon(Icons.auto_awesome_rounded, color: Colors.white),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mi camino',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Pega tu CV y te recomendamos certificaciones',
                    style: TextStyle(color: Colors.white70, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }
}

/// "Preparación por puesto" entry: opens the combined job-readiness view.
class _PreparacionTile extends StatelessWidget {
  const _PreparacionTile({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: CRColors.brand.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: CRColors.brand.withValues(alpha: 0.30)),
        ),
        child: Row(
          children: [
            const Icon(Icons.rocket_launch_rounded, color: CRColors.brand),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Preparación por puesto',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  SizedBox(height: 2),
                  Text(
                    '¿Qué tan listo estás? Combina exámenes, código y entrevista',
                    style: TextStyle(color: Colors.black54, fontSize: 12.5),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: CRColors.brand),
          ],
        ),
      ),
    );
  }
}
