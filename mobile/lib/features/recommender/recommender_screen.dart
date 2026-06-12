import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// "Mi camino": paste a CV/summary and get certification recommendations (DSS
/// embeddings). Pastes text instead of uploading a file to avoid a native plugin.
class RecommenderScreen extends ConsumerStatefulWidget {
  const RecommenderScreen({super.key});

  @override
  ConsumerState<RecommenderScreen> createState() => _RecommenderScreenState();
}

class _RecommenderScreenState extends ConsumerState<RecommenderScreen> {
  final _cv = TextEditingController();
  bool _loading = false;
  Recomendaciones? _rec;
  String? _error;

  @override
  void dispose() {
    _cv.dispose();
    super.dispose();
  }

  Future<void> _analizar() async {
    final texto = _cv.text.trim();
    if (texto.length < 30) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pega al menos un par de líneas de tu CV/resumen.'),
        ),
      );
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _rec = null;
    });
    try {
      final r = await ref.read(apiProvider).getRecommendations(texto);
      setState(() {
        _rec = r;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e is ApiError
            ? e.mensaje
            : 'No se pudo analizar (¿el DSS está arriba?)';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mi camino')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Pega un resumen de tu CV (experiencia, área, skills, certificaciones) y te '
            'recomendamos las mejores certificaciones para ti.',
            style: TextStyle(color: Colors.black54, height: 1.4),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _cv,
            maxLines: 8,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText:
                  'Ej. Ingeniero backend con 3 años en AWS, Python, Docker, Kubernetes…',
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _loading ? null : _analizar,
            icon: _loading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.auto_awesome_rounded),
            label: Text(_loading ? 'Analizando…' : 'Analizar'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_rec != null) ...[
            const SizedBox(height: 20),
            _Perfil(perfil: _rec!.perfil),
            const SizedBox(height: 16),
            const Text(
              'Recomendaciones',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
            const SizedBox(height: 8),
            ..._rec!.recomendaciones.take(8).map((p) => _PasoCard(paso: p)),
            const DisclaimerMarcas(),
          ],
        ],
      ),
    );
  }
}

class _Perfil extends StatelessWidget {
  const _Perfil({required this.perfil});
  final PerfilCV perfil;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tu perfil',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            if (perfil.resumen.isNotEmpty)
              Text(perfil.resumen, style: const TextStyle(height: 1.4)),
            if (perfil.areas.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: perfil.areas.map((a) => CRChip(a)).toList(),
              ),
            ],
            if (perfil.skills.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: perfil.skills
                    .take(12)
                    .map((s) => CRChip(s, color: Colors.black54))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PasoCard extends StatelessWidget {
  const _PasoCard({required this.paso});
  final PasoCamino paso;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Monograma(paso.proveedor, size: 38),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    paso.nombre,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  '${paso.matchPct.round()}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: CRColors.brand,
                  ),
                ),
              ],
            ),
            if (paso.porQue.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                paso.porQue,
                style: const TextStyle(
                  fontSize: 13,
                  color: Colors.black54,
                  height: 1.4,
                ),
              ),
            ],
            if (paso.tieneContenido && paso.slugEstudio != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () =>
                      context.push('/estudiar/${paso.slugEstudio}'),
                  icon: const Icon(Icons.menu_book_rounded, size: 18),
                  label: const Text('Estudiar'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
