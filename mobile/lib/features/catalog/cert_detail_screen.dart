import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

class _Detalle {
  _Detalle(this.cert, this.temas, this.inscripcion);
  final Certificacion cert;
  final List<Tema> temas;
  final Inscripcion? inscripcion;
}

/// Certification detail: description, topic list, and enroll / cancel + Estudiar.
class CertDetailScreen extends ConsumerStatefulWidget {
  const CertDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<CertDetailScreen> createState() => _CertDetailScreenState();
}

class _CertDetailScreenState extends ConsumerState<CertDetailScreen> {
  late Future<_Detalle> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Detalle> _load() async {
    final api = ref.read(apiProvider);
    final cert = await api.getCertification(widget.slug);
    if (cert == null) throw ApiError(404);
    final temas = await api.listTopics(cert.id);
    final enr = await api.listMyEnrollments();
    final matches = enr.data
        .where(
          (i) => i.tipoObjetivo == 'certificacion' && i.objetivoId == cert.id,
        )
        .toList();
    return _Detalle(cert, temas, matches.isEmpty ? null : matches.first);
  }

  void _reload() => setState(() {
    _future = _load();
  });

  Future<void> _toggleInscripcion(_Detalle d) async {
    setState(() => _busy = true);
    try {
      final api = ref.read(apiProvider);
      if (d.inscripcion == null) {
        await api.createEnrollment(
          tipoObjetivo: 'certificacion',
          objetivoId: d.cert.id,
        );
      } else {
        await api.deleteEnrollment(d.inscripcion!.id);
      }
      ref.read(enrollmentsRevProvider.notifier).bump(); // refresca Inicio
      _reload();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo actualizar la inscripción')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Certificación')),
      body: DataView<_Detalle>(
        future: _future,
        onRetry: _reload,
        builder: (context, d) {
          final nivel = nivelInfo(d.cert.nivel);
          final inscrito = d.inscripcion != null;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Row(
                children: [
                  Hero(
                    tag: 'mono-${d.cert.slug}',
                    child: Monograma(d.cert.proveedor, size: 52),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          d.cert.nombre,
                          style: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          children: [
                            CRChip(d.cert.proveedor),
                            CRChip(nivel.label, color: nivel.color),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (d.cert.descripcion != null &&
                  d.cert.descripcion!.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text(
                  d.cert.descripcion!,
                  style: const TextStyle(height: 1.5, color: Colors.black87),
                ),
              ],
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: _busy ? null : () => _toggleInscripcion(d),
                      child: Text(
                        inscrito ? 'Cancelar inscripción' : 'Inscribirme',
                      ),
                    ),
                  ),
                  if (inscrito) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () =>
                            context.push('/estudiar/${d.cert.slug}'),
                        child: const Text('Estudiar'),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 24),
              Text(
                'Temario (${d.temas.length})',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 8),
              ...d.temas.map(
                (t) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: CRColors.brand.withValues(alpha: 0.12),
                      child: Text(
                        '${t.orden}',
                        style: const TextStyle(
                          color: CRColors.brand,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    title: Text(t.nombre),
                    subtitle: t.dominio != null ? Text(t.dominio!) : null,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
