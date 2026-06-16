import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/catalog/catalog_screen.dart';
import '../features/catalog/cert_detail_screen.dart';
import '../features/exams/exam_cert_screen.dart';
import '../features/exams/exam_review_screen.dart';
import '../features/exams/exam_runner_screen.dart';
import '../features/exams/exams_screen.dart';
import '../features/interviews/interviews_screen.dart';
import '../features/interviews/qa_screen.dart';
import '../features/jobs/job_readiness_screen.dart';
import '../features/panel/panel_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/progress/progress_dash_screen.dart';
import '../features/progress/progress_screen.dart';
import '../features/recommender/recommender_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/study/lesson_screen.dart';
import '../features/study/quiz_screen.dart';
import '../features/study/study_path_screen.dart';
import 'providers.dart';

/// App router with an auth guard driven by [authProvider]. The five bottom-nav
/// tabs are shell branches; detail / runner / editor screens are full-screen
/// top-level routes pushed over the shell.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  String slugOf(GoRouterState s) => s.pathParameters['slug']!;
  String idOf(GoRouterState s) => s.pathParameters['id']!;

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      if (auth.isLoading || !auth.hasValue) {
        return loc == '/splash' ? null : '/splash';
      }
      final loggedIn = auth.value != null;
      if (!loggedIn) {
        return (loc == '/login' || loc == '/registro') ? null : '/login';
      }
      if (loc == '/login' || loc == '/registro' || loc == '/splash') {
        return '/panel';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const _Splash()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/registro', builder: (_, _) => const RegisterScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navShell) => AppShell(navShell: navShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/panel', builder: (_, _) => const PanelScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/certs',
                builder: (_, _) => const CatalogScreen(),
                routes: [
                  GoRoute(
                    path: ':slug',
                    builder: (_, s) => CertDetailScreen(slug: slugOf(s)),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/examenes',
                builder: (_, _) => const ExamsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/entrevistas',
                builder: (_, _) => const InterviewsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/progreso',
                builder: (_, _) => const ProgressScreen(),
              ),
            ],
          ),
        ],
      ),

      // --- Estudiar (full-screen) ---
      GoRoute(
        path: '/estudiar/:slug',
        builder: (_, s) => StudyPathScreen(slug: slugOf(s)),
      ),
      GoRoute(
        path: '/estudiar/:slug/:tema',
        builder: (_, s) =>
            LessonScreen(slug: slugOf(s), tema: s.pathParameters['tema']!),
      ),
      GoRoute(
        path: '/estudiar/:slug/:tema/quiz',
        builder: (_, s) =>
            QuizScreen(slug: slugOf(s), tema: s.pathParameters['tema']!),
      ),

      // --- Exámenes (full-screen) ---
      GoRoute(
        path: '/examenes/:slug',
        builder: (_, s) => ExamCertScreen(slug: slugOf(s)),
      ),
      GoRoute(
        path: '/examenes/:slug/run',
        builder: (_, s) => ExamRunnerScreen(slug: slugOf(s)),
      ),
      GoRoute(
        path: '/examenes/:slug/review/:id',
        builder: (_, s) => ExamReviewScreen(slug: slugOf(s), sesionId: idOf(s)),
      ),

      // --- Entrevistas (full-screen) ---
      GoRoute(
        path: '/entrevistas/qa/:id',
        builder: (_, s) => QAScreen(id: idOf(s)),
      ),

      // --- Progreso (full-screen) ---
      GoRoute(
        path: '/progreso/:slug',
        builder: (_, s) => ProgressDashScreen(slug: slugOf(s)),
      ),

      // --- Recomendador / Mi camino ---
      GoRoute(
        path: '/recomendaciones',
        builder: (_, _) => const RecommenderScreen(),
      ),

      // --- Preparación por puesto ---
      GoRoute(
        path: '/preparacion',
        builder: (_, _) => const JobReadinessScreen(),
      ),

      // --- Perfil ---
      GoRoute(path: '/perfil', builder: (_, _) => const ProfileScreen()),
    ],
  );
});

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset('assets/icon-shield.png', height: 110),
          const SizedBox(height: 24),
          const CircularProgressIndicator(),
        ],
      ),
    ),
  );
}
