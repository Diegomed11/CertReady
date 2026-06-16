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

/// Fuentes de marca (empaquetadas en `fonts/`, declaradas en pubspec).
const String kFontDisplay = 'Fredoka'; // títulos
const String kFontBody = 'Nunito'; // texto

/// Aplica Fredoka a los estilos de título/encabezado; el resto hereda Nunito.
TextTheme _applyBrandFonts(TextTheme t) {
  TextStyle? d(TextStyle? s, FontWeight w) =>
      s?.copyWith(fontFamily: kFontDisplay, fontWeight: w);
  return t.copyWith(
    displayLarge: d(t.displayLarge, FontWeight.w700),
    displayMedium: d(t.displayMedium, FontWeight.w700),
    displaySmall: d(t.displaySmall, FontWeight.w700),
    headlineLarge: d(t.headlineLarge, FontWeight.w700),
    headlineMedium: d(t.headlineMedium, FontWeight.w700),
    headlineSmall: d(t.headlineSmall, FontWeight.w700),
    titleLarge: d(t.titleLarge, FontWeight.w700),
    titleMedium: d(t.titleMedium, FontWeight.w600),
    titleSmall: d(t.titleSmall, FontWeight.w600),
  );
}

/// buildTheme returns the app's Material 3 theme seeded from the brand color.
ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: CRColors.brand,
    brightness: Brightness.light,
  );
  final base = ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    fontFamily: kFontBody,
  );
  return base.copyWith(
    scaffoldBackgroundColor: const Color(0xFFFBFAFF),
    textTheme: _applyBrandFonts(base.textTheme),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(
        fontFamily: kFontDisplay,
        fontWeight: FontWeight.w700,
        fontSize: 20,
        color: CRColors.ink,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 2,
      shadowColor: CRColors.brand.withValues(alpha: 0.1),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(20),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 54),
        elevation: 2,
        shadowColor: CRColors.brand.withValues(alpha: 0.3),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(
          fontFamily: kFontDisplay,
          fontWeight: FontWeight.w700,
          fontSize: 16,
        ),
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
