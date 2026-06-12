import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme.dart';

/// Login: brand splash + a single "Iniciar sesión" that runs the OIDC flow.
/// In dev the issuer auto-approves; the email field lets you sign in as any
/// identity for testing.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController(text: 'dev@local');

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _login() {
    final email = _email.text.trim();
    ref
        .read(authProvider.notifier)
        .login(email: email.isEmpty ? 'dev@local' : email);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final cargando = auth.isLoading;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: CRColors.brandGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Monograma('CertReady', size: 76),
                  const SizedBox(height: 20),
                  const Text(
                    'CertReady',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tu ruta a la certificación',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 34),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Correo (dev)',
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.alternate_email),
                            ),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: cargando ? null : _login,
                            child: cargando
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Iniciar sesión'),
                          ),
                          if (auth.hasError) ...[
                            const SizedBox(height: 12),
                            Text(
                              'No se pudo iniciar sesión. ¿El stack local está arriba?',
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                                fontSize: 13,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
