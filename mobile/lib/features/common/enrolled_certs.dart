import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Reusable list of the user's enrolled certifications (used by Exámenes and
/// Progreso to pick a cert). Calls [onTap] with the chosen certification.
class EnrolledCertsList extends ConsumerStatefulWidget {
  const EnrolledCertsList({super.key, required this.onTap, this.vacioMsg});

  final void Function(Certificacion) onTap;
  final String? vacioMsg;

  @override
  ConsumerState<EnrolledCertsList> createState() => _EnrolledCertsListState();
}

class _EnrolledCertsListState extends ConsumerState<EnrolledCertsList> {
  late Future<List<Certificacion>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Certificacion>> _load() async {
    final api = ref.read(apiProvider);
    final enr = await api.listMyEnrollments();
    final certs = <Certificacion>[];
    for (final i in enr.data.where((e) => e.tipoObjetivo == 'certificacion')) {
      final c = await api.getCertification(i.objetivoId);
      if (c != null) certs.add(c);
    }
    return certs;
  }

  @override
  Widget build(BuildContext context) {
    return DataView<List<Certificacion>>(
      future: _future,
      onRetry: () => setState(() => _future = _load()),
      builder: (context, certs) {
        if (certs.isEmpty) {
          return _Vacio(
            msg: widget.vacioMsg ?? 'Inscríbete en una certificación primero.',
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: certs
              .asMap()
              .entries
              .map(
                (e) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Monograma(e.value.proveedor),
                    title: Text(
                      e.value.nombre,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(e.value.proveedor),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => widget.onTap(e.value),
                  ),
                ).crEnter(index: e.key),
              )
              .toList(),
        );
      },
    );
  }
}

class _Vacio extends StatelessWidget {
  const _Vacio({required this.msg});
  final String msg;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inbox_rounded, size: 44, color: Colors.black26),
            const SizedBox(height: 10),
            Text(
              msg,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: () => context.go('/certs'),
              child: const Text('Ir al catálogo'),
            ),
          ],
        ),
      ),
    );
  }
}
