import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'api/client.dart';
import 'theme.dart';

/// Animación de entrada estándar (fade + slide), con escalonado opcional por
/// índice. Reutilizable en listas y tarjetas para un pulido consistente.
extension CREntrance on Widget {
  Widget crEnter({int index = 0, double delayMs = 70}) => animate()
      .fadeIn(delay: (index * delayMs).ms, duration: 380.ms)
      .slideY(
        begin: 0.18,
        end: 0,
        delay: (index * delayMs).ms,
        duration: 380.ms,
        curve: Curves.easeOutCubic,
      );

  Widget crScaleIn({int index = 0, double delayMs = 70}) => animate()
      .scale(
        begin: const Offset(0.9, 0.9),
        end: const Offset(1, 1),
        delay: (index * delayMs).ms,
        duration: 400.ms,
        curve: Curves.easeOutBack,
      )
      .fadeIn(delay: (index * delayMs).ms, duration: 300.ms);

  Widget crSlideIn({
    int index = 0,
    double delayMs = 70,
    bool fromLeft = true,
  }) => animate()
      .slideX(
        begin: fromLeft ? -0.2 : 0.2,
        end: 0,
        delay: (index * delayMs).ms,
        duration: 400.ms,
        curve: Curves.easeOutCubic,
      )
      .fadeIn(delay: (index * delayMs).ms, duration: 300.ms);
}

/// Spanish label + tone for a certification level.
({String label, Color color}) nivelInfo(String nivel) {
  switch (nivel) {
    case 'foundational':
      return (label: 'Fundamental', color: const Color(0xFF2563EB));
    case 'associate':
      return (label: 'Asociado', color: CRColors.brand);
    case 'professional':
      return (label: 'Profesional', color: const Color(0xFF7C3AED));
    case 'specialty':
      return (label: 'Especialidad', color: const Color(0xFFDB2777));
    default:
      return (label: nivel, color: CRColors.brand);
  }
}

/// Small rounded chip (level, domain, provider…).
class CRChip extends StatelessWidget {
  const CRChip(this.texto, {super.key, this.color});

  final String texto;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? CRColors.brand;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        texto,
        style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

/// FutureBuilder wrapper with consistent loading / error states.
class DataView<T> extends StatelessWidget {
  const DataView({
    super.key,
    required this.future,
    required this.builder,
    this.onRetry,
  });

  final Future<T> future;
  final Widget Function(BuildContext, T) builder;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: CircularProgressIndicator(),
            ),
          );
        }
        if (snap.hasError) {
          return ErrorView(error: snap.error!, onRetry: onRetry);
        }
        return builder(context, snap.data as T);
      },
    );
  }
}

/// Friendly error state with an optional retry.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final msg = error is ApiError
        ? (error as ApiError).mensaje
        : 'No se pudo cargar';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 44,
              color: Colors.black26,
            ),
            const SizedBox(height: 10),
            Text(
              msg,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.black54),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 14),
              OutlinedButton(
                onPressed: onRetry,
                child: const Text('Reintentar'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Trademark disclaimer (regla de marcas) — shown discreetly in footers.
class DisclaimerMarcas extends StatelessWidget {
  const DisclaimerMarcas({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Text(
        'CertReady no está afiliada, avalada ni patrocinada por AWS, Google, Microsoft '
        'u otros. Las marcas pertenecen a sus respectivos dueños.',
        style: TextStyle(
          fontSize: 11,
          color: Colors.black.withValues(alpha: 0.40),
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
