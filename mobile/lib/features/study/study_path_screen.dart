import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

class _Ruta {
  _Ruta(this.cert, this.temas, this.aprobados);
  final Certificacion cert;
  final List<Tema> temas;
  final Set<String> aprobados;

  /// Index of the first not-yet-approved topic (the "available" node).
  int get disponible {
    final i = temas.indexWhere((t) => !aprobados.contains(t.slug));
    return i < 0 ? temas.length : i;
  }
}

enum _Estado { completado, disponible, bloqueado }

/// Study path (Duolingo-style): topics gated by quiz approval.
class StudyPathScreen extends ConsumerStatefulWidget {
  const StudyPathScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<StudyPathScreen> createState() => _StudyPathScreenState();
}

class _StudyPathScreenState extends ConsumerState<StudyPathScreen> {
  late Future<_Ruta> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_Ruta> _load() async {
    final api = ref.read(apiProvider);
    final cert = await api.getCertification(widget.slug);
    if (cert == null) throw ApiError(404);
    final temas = await api.listTopics(cert.id);
    final prog = await api.getMyProgress(cert.slug);
    return _Ruta(cert, temas, prog.temasAprobados);
  }

  void _abrir(_Ruta r, Tema t, _Estado estado) {
    if (estado == _Estado.bloqueado) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Aprueba el tema anterior para desbloquear este'),
        ),
      );
      return;
    }
    context.push('/estudiar/${r.cert.slug}/${t.slug}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Estudiar')),
      body: DataView<_Ruta>(
        future: _future,
        onRetry: () => setState(() => _future = _load()),
        builder: (context, r) {
          final disp = r.disponible;
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              Text(
                r.cert.nombre,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${r.aprobados.length} de ${r.temas.length} temas completados',
                style: const TextStyle(color: Colors.black54),
              ),
              const SizedBox(height: 20),
              for (var i = 0; i < r.temas.length; i++)
                _NodoTema(
                  tema: r.temas[i],
                  estado: r.aprobados.contains(r.temas[i].slug)
                      ? _Estado.completado
                      : (i == disp ? _Estado.disponible : _Estado.bloqueado),
                  ultimo: i == r.temas.length - 1,
                  onTap: (estado) => _abrir(r, r.temas[i], estado),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _NodoTema extends StatelessWidget {
  const _NodoTema({
    required this.tema,
    required this.estado,
    required this.ultimo,
    required this.onTap,
  });

  final Tema tema;
  final _Estado estado;
  final bool ultimo;
  final void Function(_Estado) onTap;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (estado) {
      _Estado.completado => (CRColors.good, Icons.check_rounded),
      _Estado.disponible => (CRColors.brand, Icons.play_arrow_rounded),
      _Estado.bloqueado => (Colors.black26, Icons.lock_rounded),
    };
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => onTap(estado),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: estado == _Estado.disponible
                        ? color
                        : color.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    icon,
                    color: estado == _Estado.disponible ? Colors.white : color,
                    size: 24,
                  ),
                ),
                if (!ultimo)
                  Container(
                    width: 3,
                    height: 26,
                    color: Colors.black.withValues(alpha: 0.06),
                  ),
              ],
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tema.nombre,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: estado == _Estado.bloqueado
                            ? Colors.black38
                            : Colors.black87,
                      ),
                    ),
                    if (tema.dominio != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          tema.dominio!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: Colors.black45,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (estado != _Estado.bloqueado)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Icon(Icons.chevron_right, color: Colors.black26),
              ),
          ],
        ),
      ),
    );
  }
}
