import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// App shell: bottom navigation across the main branches. Detail / runner /
/// editor screens are pushed full-screen on top of this shell.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navShell});

  final StatefulNavigationShell navShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navShell.currentIndex,
        onDestinationSelected: (i) =>
            navShell.goBranch(i, initialLocation: i == navShell.currentIndex),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school_rounded),
            label: 'Catálogo',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment_rounded),
            label: 'Exámenes',
          ),
          NavigationDestination(
            icon: Icon(Icons.code_outlined),
            selectedIcon: Icon(Icons.code_rounded),
            label: 'Entrevistas',
          ),
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights_rounded),
            label: 'Progreso',
          ),
        ],
      ),
    );
  }
}
