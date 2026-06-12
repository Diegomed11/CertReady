import 'package:flutter/material.dart';
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

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
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
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Hola, $nombre 👋',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  d.avances.isEmpty
                      ? 'Elige una certificación para armar tu ruta de estudio.'
                      : 'Retoma tu ruta de estudio.',
                  style: const TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 16),
                _MiCaminoTile(onTap: () => context.push('/recomendaciones')),
                const SizedBox(height: 20),
                if (d.avances.isEmpty)
                  _VacioInscripciones(onExplorar: () => context.go('/certs'))
                else
                  ...d.avances.map((a) => _AvanceCard(avance: a)),
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
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: avance.total == 0 ? 0 : avance.hechos / avance.total,
                minHeight: 8,
                backgroundColor: CRColors.brand.withValues(alpha: 0.12),
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
