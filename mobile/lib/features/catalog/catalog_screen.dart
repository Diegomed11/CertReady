import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Catalog: certifications grouped by provider, filterable by level. Tapping a
/// card opens the detail (enroll + topics). Visible key = slug (no UUIDs).
class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key});

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  late Future<PaginatedList<Certificacion>> _future;
  String? _nivel; // null = todos

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listCertifications(limit: 100);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Catálogo')),
      body: DataView<PaginatedList<Certificacion>>(
        future: _future,
        onRetry: () => setState(() {
          _future = ref.read(apiProvider).listCertifications(limit: 100);
        }),
        builder: (context, page) {
          final certs = _nivel == null
              ? page.data
              : page.data.where((c) => c.nivel == _nivel).toList();

          // Agrupar por proveedor (orden alfabético).
          final porProveedor = <String, List<Certificacion>>{};
          for (final c in certs) {
            (porProveedor[c.proveedor] ??= []).add(c);
          }
          final proveedores = porProveedor.keys.toList()..sort();

          return ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              _FiltroNiveles(
                seleccionado: _nivel,
                onSelect: (n) => setState(() => _nivel = n),
              ),
              for (final prov in proveedores) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                  child: Text(
                    prov,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                for (final e in porProveedor[prov]!.asMap().entries)
                  _CertCard(cert: e.value, indice: e.key),
              ],
              const DisclaimerMarcas(),
            ],
          );
        },
      ),
    );
  }
}

class _FiltroNiveles extends StatelessWidget {
  const _FiltroNiveles({required this.seleccionado, required this.onSelect});

  final String? seleccionado;
  final ValueChanged<String?> onSelect;

  static const _niveles = [
    'foundational',
    'associate',
    'professional',
    'specialty',
  ];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          ChoiceChip(
            label: const Text('Todos'),
            selected: seleccionado == null,
            onSelected: (_) => onSelect(null),
          ),
          const SizedBox(width: 8),
          for (final n in _niveles) ...[
            ChoiceChip(
              label: Text(nivelInfo(n).label),
              selected: seleccionado == n,
              onSelected: (_) => onSelect(n),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _CertCard extends StatelessWidget {
  const _CertCard({required this.cert, this.indice = 0});

  final Certificacion cert;
  final int indice;

  @override
  Widget build(BuildContext context) {
    final nivel = nivelInfo(cert.nivel);
    return Card(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Hero(
          tag: 'mono-${cert.slug}',
          child: Monograma(cert.proveedor),
        ),
        title: Text(
          cert.nombre,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Wrap(
            spacing: 6,
            children: [CRChip(nivel.label, color: nivel.color)],
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/certs/${cert.slug}'),
      ),
    ).animate().fadeIn(delay: (indice * 70).ms, duration: 420.ms).slideX(
      begin: 0.18,
      end: 0,
      delay: (indice * 70).ms,
      duration: 420.ms,
      curve: Curves.easeOutCubic,
    );
  }
}
