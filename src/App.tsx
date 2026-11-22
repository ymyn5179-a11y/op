import React from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AppShell } from './components/AppShell';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentHomeworkSection } from './components/StudentHomeworkSection';
import { NonoLandProvider, useNonoLand } from './context/NonoLandContext';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { AcademyScreen } from './screens/AcademyScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { AdventureMapScreen, WorldDetailScreen } from './screens/AdventureMapScreen';
import { AssessmentResultsScreen, DiscoveryLabScreen } from './screens/DiscoveryLabScreen';
import { EntertainmentHubScreen } from './screens/EntertainmentHubScreen';
import { ExamsScreen } from './screens/ExamsScreen';
import { FamilyActivitiesScreen } from './screens/FamilyActivitiesScreen';
import { FunZoneScreen } from './screens/FunZoneScreen';
import { GameArenaScreen, GameResultsScreen } from './screens/GameArenaScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MonthlyReportScreen } from './screens/MonthlyReportScreen';
import { MyAvatarScreen } from './screens/MyAvatarScreen';
import { MyPetScreen } from './screens/MyPetScreen';
import { MyRoomScreen } from './screens/MyRoomScreen';
import { NonoAiScreen } from './screens/NonoAiScreen';
import { BrainGamesScreen } from './screens/BrainGamesScreen';
import { CreativeStudioScreen } from './screens/CreativeStudioScreen';
import { ReadingAdventureScreen } from './screens/ReadingAdventureScreen';
import { RewardShopScreen } from './screens/RewardShopScreen';
import { ParentDashboardScreen } from './screens/ParentDashboardScreen';
import { QuranWorldScreen } from './screens/QuranWorldScreen';
import { TeacherDashboardScreen } from './screens/TeacherDashboardScreen';
import {
  ChildWelcomeScreen,
  CreateChildScreen,
  OnboardingScreen,
  ParentAuthScreen,
  SplashScreen,
} from './screens/SplashAndOnboarding';
import { StoriesScreen, StoryReaderScreen } from './screens/StoriesScreen';

const ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'content_admin',
  'curriculum_manager',
  'finance_admin',
  'support_agent',
]);

const VALID_USER_ROLES = new Set([
  'parent',
  'child',
  'student',
  'teacher',
  ...ADMIN_ROLES,
]);

const ScreenRouter: React.FC = () => {
  const {
    screen,
    parentSettings,
    language,
    navigate,
    authSession,
    authResolved,
    activeChild,
  } = useNonoLand();

  const fullBleedScreens = [
    'splash',
    'onboarding',
    'parent-auth',
    'create-child',
    'child-welcome',
  ];

  const rawRole = authSession.authenticated ? authSession.user?.role ?? null : null;
  const role = rawRole && VALID_USER_ROLES.has(rawRole) ? rawRole : null;
  const isChildOrStudent = role === 'child' || role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role !== null && ADMIN_ROLES.has(role);
  const isParent = authSession.authenticated && role === 'parent';

  const allowedUnauthNoChildScreens = new Set([
    'splash',
    'onboarding',
    'parent-auth',
  ]);

  const computeEffectiveScreen = () => {
    if (!authResolved && screen !== 'splash' && screen !== 'onboarding' && screen !== 'parent-auth') {
      return screen;
    }
    if (isChildOrStudent) {
      if (
        screen === 'parent-dashboard' ||
        screen === 'teacher-dashboard' ||
        screen === 'admin-dashboard' ||
        screen === 'create-child' ||
        screen === 'parent-auth'
      ) {
        return role === 'student' ? 'exams' : 'home';
      }
      if (!activeChild) return 'home';
      return screen;
    }
    if (isTeacher) {
      return 'teacher-dashboard';
    }
    if (isAdmin) {
      if (screen === 'splash' || screen === 'parent-auth' || screen === 'teacher-dashboard') {
        return 'admin-dashboard';
      }
      if (!activeChild && screen !== 'admin-dashboard' && screen !== 'parent-dashboard' && screen !== 'create-child') {
        return 'admin-dashboard';
      }
      return screen;
    }
    if (isParent) {
      if (screen === 'admin-dashboard' || screen === 'teacher-dashboard') {
        return 'parent-dashboard';
      }
      if (screen === 'splash' || screen === 'parent-auth') {
        return 'parent-dashboard';
      }
      if (
        !activeChild &&
        screen !== 'parent-dashboard' &&
        screen !== 'create-child'
      ) {
        return 'parent-dashboard';
      }
      return screen;
    }
    // Unauthenticated
    if (!activeChild && !allowedUnauthNoChildScreens.has(screen)) {
      return 'parent-auth';
    }
    return screen;
  };

  const effectiveScreen = computeEffectiveScreen();

  React.useEffect(() => {
    if (authResolved && effectiveScreen !== screen) {
      navigate(effectiveScreen);
    }
  }, [authResolved, effectiveScreen, screen, navigate]);

  const renderScreen = () => {
    switch (effectiveScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'onboarding':
        return <OnboardingScreen />;
      case 'parent-auth':
        return <ParentAuthScreen />;
      case 'create-child':
        return <CreateChildScreen />;
      case 'child-welcome':
        return <ChildWelcomeScreen />;
      case 'baseline-assessment':
        return <DiscoveryLabScreen isBaseline />;
      case 'home':
        return <HomeScreen />;
      case 'academy':
        return <AcademyScreen />;
      case 'exams':
        return <ExamsScreen />;
      case 'homework':
        return <StudentHomeworkSection />;
      case 'fun-zone':
        return <FunZoneScreen />;
      case 'map':
        return <AdventureMapScreen />;
      case 'world-detail':
        return <WorldDetailScreen />;
      case 'game':
        return <GameArenaScreen />;
      case 'game-results':
        return <GameResultsScreen />;
      case 'discovery-lab':
        return <DiscoveryLabScreen />;
      case 'assessment-results':
        return <AssessmentResultsScreen />;
      case 'stories':
        return <StoriesScreen />;
      case 'story-reader':
        return <StoryReaderScreen />;
      case 'my-room':
        return <MyRoomScreen />;
      case 'my-avatar':
        return <MyAvatarScreen />;
      case 'my-pet':
        return <MyPetScreen />;
      case 'brain-games':
        return <BrainGamesScreen />;
      case 'creative-studio':
        return <CreativeStudioScreen />;
      case 'reward-shop':
        return <RewardShopScreen />;
      case 'achievements':
        return <AchievementsScreen />;
      case 'monthly-report':
        return <MonthlyReportScreen />;
      case 'parent-dashboard':
        return <ParentDashboardScreen />;
      case 'teacher-dashboard':
        return <TeacherDashboardScreen />;
      case 'admin-dashboard':
        return <AdminDashboardScreen />;
      case 'nono-ai':
        return <NonoAiScreen />;
      case 'reading-adventure':
        return <ReadingAdventureScreen />;
      case 'family-activities':
        return <FamilyActivitiesScreen />;
      case 'entertainment-hub':
        return <EntertainmentHubScreen />;
      case 'quran-world':
        return <QuranWorldScreen />;
      default:
        return <ParentAuthScreen />;
    }
  };

  if (fullBleedScreens.includes(effectiveScreen)) {
    return (
      <MotionConfig reducedMotion={parentSettings.reducedMotion ? 'always' : 'user'}>
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveScreen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion={parentSettings.reducedMotion ? 'always' : 'user'}>
      <AppShell>
        <ErrorBoundary
          language={language}
          onResetHome={() => navigate(isParent ? 'parent-dashboard' : isTeacher ? 'teacher-dashboard' : isAdmin ? 'admin-dashboard' : 'home')}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={effectiveScreen}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
        <CelebrationOverlay />
      </AppShell>
    </MotionConfig>
  );
};

export default function App() {
  return (
    <NonoLandProvider>
      <ScreenRouter />
    </NonoLandProvider>
  );
}
