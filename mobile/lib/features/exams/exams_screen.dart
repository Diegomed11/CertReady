import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../common/enrolled_certs.dart';

/// Exámenes tab: pick an enrolled certification to take a simulacro / see history.
class ExamsScreen extends StatelessWidget {
  const ExamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exámenes')),
      body: EnrolledCertsList(
        vacioMsg: 'Inscríbete en una certificación para hacer simulacros.',
        onTap: (c) => context.push('/examenes/${c.slug}'),
      ),
    );
  }
}
