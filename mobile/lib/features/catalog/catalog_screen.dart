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
  final _ctrl = TextEditingController();
  String? _nivel; // null = todos
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).listCertifications(limit: 100);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
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
          final q = _norm(_query);
          final certs = page.data.where((c) {
            final okNivel = _nivel == null || c.nivel == _nivel;
            final okTexto = q.isEmpty || _coincide(c, q);
            return okNivel && okTexto;
          }).toList();

          // Agrupar por proveedor (orden alfabético).
          final porProveedor = <String, List<Certificacion>>{};
          for (final c in certs) {
            (porProveedor[c.proveedor] ??= []).add(c);
          }
          final proveedores = porProveedor.keys.toList()..sort();

          return ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              _Buscador(
                controller: _ctrl,
                onChanged: (v) => setState(() => _query = v),
                onClear: () => setState(() {
                  _ctrl.clear();
                  _query = '';
                }),
              ),
              _FiltroNiveles(
                seleccionado: _nivel,
                onSelect: (n) => setState(() => _nivel = n),
              ),
              if (certs.isEmpty)
                _SinResultados(query: _query)
              else ...[
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
            ],
          );
        },
      ),
    );
  }
}

/// Lowercases + strips accents for diacritic-insensitive matching.
String _norm(String s) {
  const from = 'áàäâãéèëêíìïîóòöôõúùüûñç';
  const to = 'aaaaaeeeeiiiiooooouuuunc';
  final sb = StringBuffer();
  for (final ch in s.toLowerCase().split('')) {
    final i = from.indexOf(ch);
    sb.write(i == -1 ? ch : to[i]);
  }
  return sb.toString();
}

/// True if the query (already normalized) matches the cert's name, provider or slug.
bool _coincide(Certificacion c, String q) =>
    _norm(c.nombre).contains(q) ||
    _norm(c.proveedor).contains(q) ||
    _norm(c.slug).contains(q);

/// Search field for the catalog (filters by name / provider / slug as you type).
class _Buscador extends StatelessWidget {
  const _Buscador({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Buscar certificación…',
          prefixIcon: const Icon(Icons.search_rounded),
          suffixIcon: controller.text.isEmpty
              ? null
              : IconButton(
                  icon: const Icon(Icons.close_rounded),
                  tooltip: 'Limpiar',
                  onPressed: onClear,
                ),
          filled: true,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

/// Friendly empty state when no certification matches the active filters.
class _SinResultados extends StatelessWidget {
  const _SinResultados({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    final q = query.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 56, 24, 24),
      child: Column(
        children: [
          const Icon(Icons.search_off_rounded, size: 44, color: Colors.black26),
          const SizedBox(height: 12),
          Text(
            q.isEmpty
                ? 'No hay certificaciones para este filtro.'
                : 'Sin resultados para “$q”.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.black54),
          ),
        ],
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
          child: Monograma(cert.proveedor)
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(
                delay: (indice * 100).ms,
                duration: 2000.ms,
                begin: const Offset(1, 1),
                end: const Offset(1.05, 1.05),
                curve: Curves.easeInOut,
              ),
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
    ).crSlideIn(index: indice, fromLeft: indice % 2 == 0);
  }
}
