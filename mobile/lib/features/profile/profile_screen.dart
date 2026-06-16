import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// Profile: view own account (name editable, email read-only, role, member since)
/// and sign out. Mirror of the web `/perfil` page.
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late Future<Cuenta> _future;
  final _ctrl = TextEditingController();
  String _guardado = ''; // last saved name (to detect changes)
  bool _sembrado = false; // controller seeded from the loaded account
  bool _guardando = false;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).getMe();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final nombre = _ctrl.text.trim();
    if (nombre.isEmpty) return;
    setState(() => _guardando = true);
    try {
      await ref.read(apiProvider).updateMe(nombre: nombre);
      if (!mounted) return;
      setState(() {
        _guardado = nombre;
        _guardando = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Cambios guardados')));
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() => _guardando = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tu perfil')),
      body: DataView<Cuenta>(
        future: _future,
        onRetry: () =>
            setState(() => _future = ref.read(apiProvider).getMe()),
        builder: (context, cuenta) {
          if (!_sembrado) {
            _ctrl.text = cuenta.nombre ?? '';
            _guardado = (cuenta.nombre ?? '').trim();
            _sembrado = true;
          }
          final nombreActual = _ctrl.text.trim();
          final puedeGuardar =
              nombreActual.isNotEmpty &&
              nombreActual != _guardado &&
              !_guardando;
          final display = _guardado.isNotEmpty
              ? _guardado
              : cuenta.email.split('@').first;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Center(
                child: Column(
                  children: [
                    Monograma(display, size: 84).crScaleIn(),
                    const SizedBox(height: 12),
                    Text(
                      display,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _Etiqueta('Nombre'),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _ctrl,
                        onChanged: (_) => setState(() {}),
                        maxLength: 120,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          hintText: 'Tu nombre',
                          isDense: true,
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 16),
                      const _Etiqueta('Email'),
                      const SizedBox(height: 6),
                      _SoloLectura(cuenta.email),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 20,
                        runSpacing: 8,
                        children: [
                          _Meta(
                            'Rol',
                            cuenta.rol == 'admin'
                                ? 'Administrador'
                                : 'Estudiante',
                          ),
                          if (cuenta.creadoEn.isNotEmpty)
                            _Meta('Miembro desde', _fechaLarga(cuenta.creadoEn)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: puedeGuardar ? _guardar : null,
                child: Text(_guardando ? 'Guardando…' : 'Guardar cambios'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => ref.read(authProvider.notifier).logout(),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Cerrar sesión'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 52),
                  foregroundColor: const Color(0xFFDC2626),
                  side: const BorderSide(color: Color(0xFFFCA5A5)),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Long Spanish date ("15 de junio de 2026"); avoids adding the `intl` package.
String _fechaLarga(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return '${d.day} de ${meses[d.month - 1]} de ${d.year}';
}

/// Small bold field label.
class _Etiqueta extends StatelessWidget {
  const _Etiqueta(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Text(
    texto,
    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
  );
}

/// Read-only value box (e.g. email).
class _SoloLectura extends StatelessWidget {
  const _SoloLectura(this.valor);
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(valor, style: const TextStyle(color: Colors.black54)),
          ),
          const Text(
            'No editable',
            style: TextStyle(fontSize: 11, color: Colors.black38),
          ),
        ],
      ),
    );
  }
}

/// Inline "label: value" metadata.
class _Meta extends StatelessWidget {
  const _Meta(this.etiqueta, this.valor);
  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          etiqueta,
          style: const TextStyle(fontSize: 12, color: Colors.black45),
        ),
        const SizedBox(height: 2),
        Text(
          valor,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
        ),
      ],
    );
  }
}
