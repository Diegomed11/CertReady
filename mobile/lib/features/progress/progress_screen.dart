import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../common/enrolled_certs.dart';

/// Progreso tab: pick an enrolled certification to see its dashboard.
class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Progreso')),
      body: EnrolledCertsList(
        vacioMsg: 'Inscríbete en una certificación para ver tu progreso.',
        onTap: (c) => context.push('/progreso/${c.slug}'),
      ),
    );
  }
}
