import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../../core/ui.dart';

/// "Mi camino": sube tu CV (PDF/DOC/TXT) o pega el texto y obtén recomendaciones
/// de certificación (embeddings del DSS).
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
  String? _archivo; // nombre del archivo subido (si se usó esa vía)

  @override
  void dispose() {
    _cv.dispose();
    super.dispose();
  }

  Future<void> _subirArchivo() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'doc', 'docx', 'txt'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final f = result.files.first;
    final bytes = f.bytes;
    if (bytes == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudo leer el archivo.')),
        );
      }
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _rec = null;
      _archivo = f.name;
    });
    try {
      final r = await ref
          .read(apiProvider)
          .getRecommendationsFile(bytes: bytes, filename: f.name);
      setState(() {
        _rec = r;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e is ApiError
            ? e.mensaje
            : 'No se pudo analizar el archivo (¿el DSS está arriba?)';
        _loading = false;
      });
    }
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
      _archivo = null;
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
            'Sube tu CV (PDF, DOC o TXT) o pega un resumen (experiencia, área, '
            'skills, certificaciones) y te recomendamos las mejores certificaciones.',
            style: TextStyle(color: Colors.black54, height: 1.4),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _loading ? null : _subirArchivo,
            icon: const Icon(Icons.upload_file_rounded),
            label: const Text('Subir CV (PDF, DOC, TXT)'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          ),
          if (_archivo != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(
                  Icons.description_rounded,
                  size: 16,
                  color: CRColors.brand,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _archivo!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Colors.black54,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Expanded(child: Divider()),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    'o pega el texto',
                    style: TextStyle(fontSize: 12, color: Colors.black45),
                  ),
                ),
                Expanded(child: Divider()),
              ],
            ),
          ),
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
            label: Text(_loading ? 'Analizando…' : 'Analizar texto'),
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
            ..._rec!.recomendaciones
                .take(8)
                .toList()
                .asMap()
                .entries
                .map((e) => _PasoCard(paso: e.value).crEnter(index: e.key)),
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
