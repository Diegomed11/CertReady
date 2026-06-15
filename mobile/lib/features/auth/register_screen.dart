import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import 'auth_widgets.dart';

/// Registro nativo: nombre + email + contraseña → crea la cuenta en el IdP y entra.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _crear() async {
    final email = _email.text.trim();
    final pass = _password.text;
    if (email.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Escribe tu email y contraseña');
      return;
    }
    if (pass.length < 8) {
      setState(() => _error = 'La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(authProvider.notifier)
          .register(email: email, password: pass, name: _name.text.trim());
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = authErrorMsg(e);
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      subtitle: 'Crea tu cuenta',
      child: Column(
        children: [
          AuthField(
            controller: _name,
            label: 'Nombre',
            icon: Icons.person_outline,
            textInputAction: TextInputAction.next,
          ),
          AuthField(
            controller: _email,
            label: 'Email',
            icon: Icons.alternate_email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          AuthField(
            controller: _password,
            label: 'Contraseña (mín. 8)',
            icon: Icons.lock_outline,
            obscure: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _crear(),
          ),
          FilledButton(
            onPressed: _loading ? null : _crear,
            child: _loading
                ? const SizedBox(
                    height: 22,
                    width: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Crear cuenta'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: 14),
          TextButton(
            onPressed: _loading ? null : () => context.pop(),
            child: const Text('¿Ya tienes cuenta? Inicia sesión'),
          ),
        ],
      ),
    );
  }
}
