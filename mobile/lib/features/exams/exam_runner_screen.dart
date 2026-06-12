import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/ui.dart';
import '../common/examen_widgets.dart';

/// Simulacro runner: creates a real-format exam, collects answers, grades it.
class ExamRunnerScreen extends ConsumerStatefulWidget {
  const ExamRunnerScreen({super.key, required this.slug});
  final String slug;

  @override
  ConsumerState<ExamRunnerScreen> createState() => _ExamRunnerScreenState();
}

class _ExamRunnerScreenState extends ConsumerState<ExamRunnerScreen> {
  bool _loading = true;
  Object? _error;
  SesionConPreguntas? _sesion;
  final Map<String, Set<String>> _sel = {};
  bool _enviando = false;
  ResultadoExamen? _resultado;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _loading = true;
      _error = null;
      _resultado = null;
      _sel.clear();
    });
    try {
      final s = await ref
          .read(apiProvider)
          .createSimulacro(certificacion: widget.slug);
      setState(() {
        _sesion = s;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _toggle(PreguntaPublica q, String opt) {
    setState(() {
      final set = _sel.putIfAbsent(q.ref, () => <String>{});
      if (q.esMultiple) {
        set.contains(opt) ? set.remove(opt) : set.add(opt);
      } else {
        _sel[q.ref] = {opt};
      }
    });
  }

  bool get _todasRespondidas =>
      _sesion != null &&
      _sesion!.preguntas.every((q) => (_sel[q.ref]?.isNotEmpty ?? false));

  Future<void> _enviar() async {
    final s = _sesion!;
    setState(() => _enviando = true);
    try {
      final respuestas = s.preguntas
          .map(
            (q) => {
              'ref': q.ref,
              'seleccion': (_sel[q.ref] ?? const {}).toList(),
            },
          )
          .toList();
      final res = await ref.read(apiProvider).submitExam(s.id, respuestas);
      setState(() {
        _resultado = res;
        _enviando = false;
      });
    } catch (_) {
      setState(() => _enviando = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo calificar el examen')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Simulacro')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorView(error: _error!, onRetry: _cargar);
    if (_resultado != null) {
      return Column(
        children: [
          Expanded(child: ResultadoExamenView(resultado: _resultado!)),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: FilledButton(
                onPressed: () => context.go('/examenes/${widget.slug}'),
                child: const Text('Volver'),
              ),
            ),
          ),
        ],
      );
    }

    final preguntas = _sesion!.preguntas;
    if (preguntas.isEmpty) {
      return const Center(
        child: Text('Esta certificación aún no tiene preguntas.'),
      );
    }
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            itemCount: preguntas.length,
            itemBuilder: (context, i) => PreguntaCard(
              indice: i + 1,
              pregunta: preguntas[i],
              seleccion: _sel[preguntas[i].ref] ?? const {},
              onToggle: (opt) => _toggle(preguntas[i], opt),
            ),
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: FilledButton(
              onPressed: (_todasRespondidas && !_enviando) ? _enviar : null,
              child: _enviando
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      _todasRespondidas
                          ? 'Entregar examen'
                          : 'Responde todas (${_sel.values.where((s) => s.isNotEmpty).length}/${preguntas.length})',
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
