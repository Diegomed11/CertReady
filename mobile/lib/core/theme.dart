import 'package:flutter/material.dart';

/// Brand identity: blue→purple gradient, own visual identity (no official
/// provider logos — see `marcas-certificaciones.md`).
class CRColors {
  const CRColors._();

  static const Color brand = Color(0xFF6D5EF6); // azul-morado (seed)
  static const Color brandStart = Color(0xFF4F46E5);
  static const Color brandEnd = Color(0xFF9C8CFA);
  static const Color ink = Color(0xFF1B1830);
  static const Color good = Color(0xFF16A34A);
  static const Color warn = Color(0xFFD97706);

  static const LinearGradient brandGradient = LinearGradient(
    colors: [brandStart, brandEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

/// buildTheme returns the app's Material 3 theme seeded from the brand color.
ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: CRColors.brand,
    brightness: Brightness.light,
  );
  final base = ThemeData(colorScheme: scheme, useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: const Color(0xFFFBFAFF),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: scheme.outlineVariant),
        borderRadius: BorderRadius.circular(18),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}

/// Monogram avatar for a provider/cert — own identity, never an official logo.
class Monograma extends StatelessWidget {
  const Monograma(this.texto, {super.key, this.size = 44});

  final String texto;
  final double size;

  @override
  Widget build(BuildContext context) {
    final iniciales = texto.trim().isEmpty
        ? '?'
        : texto
              .trim()
              .split(RegExp(r'\s+'))
              .take(2)
              .map((p) => p.isEmpty ? '' : p[0].toUpperCase())
              .join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: CRColors.brandGradient,
        shape: BoxShape.circle,
      ),
      child: Text(
        iniciales,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: size * 0.36,
        ),
      ),
    );
  }
}
