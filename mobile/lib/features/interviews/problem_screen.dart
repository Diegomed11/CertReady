import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';
import 'interviews_screen.dart' show dificultadInfo;

/// Coding problem: statement + a monospace editor + run against the judge.
class ProblemScreen extends ConsumerStatefulWidget {
  const ProblemScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ProblemScreen> createState() => _ProblemScreenState();
}

class _ProblemScreenState extends ConsumerState<ProblemScreen> {
  late Future<Problema?> _future;
  final _code = TextEditingController();
  String? _lenguaje;
  bool _corriendo = false;
  ResultadoJuez? _resultado;
  String? _errorRun;

  @override
  void initState() {
    super.initState();
    _future = ref.read(apiProvider).getProblem(widget.id);
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _initEditor(Problema p) {
    if (_lenguaje != null) {
      return;
    }
    _lenguaje = p.lenguajesPermitidos.isNotEmpty
        ? p.lenguajesPermitidos.first
        : 'python';
    _code.text = p.plantillas[_lenguaje] ?? '';
  }

  Future<void> _ejecutar(Problema p) async {
    setState(() {
      _corriendo = true;
      _resultado = null;
      _errorRun = null;
    });
    try {
      final r = await ref
          .read(apiProvider)
          .submitJudge(
            problemaRef: p.id,
            lenguaje: _lenguaje ?? 'python',
            fuente: _code.text,
          );
      setState(() {
        _resultado = r.resultado;
        _corriendo = false;
      });
    } catch (e) {
      setState(() {
        _errorRun = e is ApiError
            ? e.mensaje
            : 'No se pudo ejecutar (¿Docker encendido para el juez?)';
        _corriendo = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Problema')),
      body: DataView<Problema?>(
        future: _future,
        builder: (context, p) {
          if (p == null) {
            return const Center(child: Text('Problema no encontrado.'));
          }
          _initEditor(p);
          final dif = dificultadInfo(p.dificultad);
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                p.titulo,
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                children: [
                  CRChip(dif.label, color: dif.color),
                  if (p.area.isNotEmpty) CRChip(p.area),
                ],
              ),
              const SizedBox(height: 14),
              MarkdownBody(data: p.enunciado),
              const SizedBox(height: 18),
              if (p.lenguajesPermitidos.length > 1)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: DropdownButtonFormField<String>(
                    initialValue: _lenguaje,
                    decoration: const InputDecoration(
                      labelText: 'Lenguaje',
                      border: OutlineInputBorder(),
                    ),
                    items: p.lenguajesPermitidos
                        .map((l) => DropdownMenuItem(value: l, child: Text(l)))
                        .toList(),
                    onChanged: (l) => setState(() {
                      _lenguaje = l;
                      _code.text = p.plantillas[l] ?? _code.text;
                    }),
                  ),
                ),
              TextField(
                controller: _code,
                maxLines: 14,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 13,
                  height: 1.4,
                ),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '// tu solución',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _corriendo ? null : () => _ejecutar(p),
                icon: _corriendo
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.play_arrow_rounded),
                label: Text(_corriendo ? 'Ejecutando…' : 'Ejecutar'),
              ),
              if (_errorRun != null) ...[
                const SizedBox(height: 12),
                Text(
                  _errorRun!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              if (_resultado != null) ...[
                const SizedBox(height: 16),
                _JuezResultado(resultado: _resultado!),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _JuezResultado extends StatelessWidget {
  const _JuezResultado({required this.resultado});
  final ResultadoJuez resultado;

  static const _labels = {
    'accepted': 'Aceptado',
    'wrong_answer': 'Respuesta incorrecta',
    'time_limit_exceeded': 'Tiempo excedido',
    'memory_limit_exceeded': 'Memoria excedida',
    'runtime_error': 'Error en ejecución',
    'compile_error': 'Error de compilación',
  };

  @override
  Widget build(BuildContext context) {
    final ok = resultado.aceptado;
    final color = ok ? CRColors.good : Theme.of(context).colorScheme.error;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                ok ? Icons.check_circle_rounded : Icons.cancel_rounded,
                color: color,
              ),
              const SizedBox(width: 8),
              Text(
                _labels[resultado.veredicto] ?? resultado.veredicto,
                style: TextStyle(fontWeight: FontWeight.w800, color: color),
              ),
              const Spacer(),
              Text('${resultado.casosPasados}/${resultado.casosTotal} casos'),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${resultado.duracionMs} ms',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}
