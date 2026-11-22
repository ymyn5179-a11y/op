import React from 'react';
import {
  Award,
  BookOpen,
  ClipboardCheck,
  Compass,
  FlaskConical,
  GraduationCap,
  Home,
  Languages,
  Lock,
  LogOut,
  Palette,
  Shield,
  Sparkles,
  Star,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { DEFAULT_AVATAR_CONFIG } from '../data/worldCatalog';
import { formatNumber, t, UI_COPY } from '../i18n/translations';
import { AppScreen } from '../types/nonoland';
import { getHeaderChildSelectorLabel, UNIFIED_STAGE_BADGE } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';
import { ChildAvatarPreview } from './CharacterCast';
import { LegalDocumentsModal } from './LegalDocumentsModal';
import { NonoLandLogo } from './NonoLandLogo';

const ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'content_admin',
  'curriculum_manager',
  'finance_admin',
  'support_agent',
]);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    screen,
    navigate,
    language,
    setLanguage,
    activeChild,
    childrenList,
    selectChild,
    isOnline,
    pendingSyncCount,
    authSession,
    isChildSession,
    exitChildMode,
    logoutParent,
  } = useNonoLand();

  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [legalDocOpen, setLegalDocOpen] = React.useState<'privacy' | 'terms' | null>(null);

  const isDashboardScreen =
    screen === 'parent-dashboard' ||
    screen === 'teacher-dashboard' ||
    screen === 'admin-dashboard';
  const role = authSession.authenticated ? authSession.user?.role || '' : '';
  const isAdmin = ADMIN_ROLES.has(role);
  const isTeacher = role === 'teacher';
  const hideChildWorldChrome = isDashboardScreen || isTeacher || isAdmin;

  const navItems: Array<{ id: AppScreen; label: { ar: string; en: string }; icon: React.ReactNode; mobile?: boolean }> = [
    { id: 'home', label: UI_COPY.nav.home, icon: <Home className="w-4 h-4" />, mobile: true },
    { id: 'academy', label: UI_COPY.nav.academy, icon: <GraduationCap className="w-4 h-4" />, mobile: true },
    { id: 'exams', label: UI_COPY.nav.exams, icon: <ClipboardCheck className="w-4 h-4" />, mobile: true },
    { id: 'fun-zone', label: UI_COPY.nav.funZone, icon: <Sparkles className="w-4 h-4" />, mobile: true },
    { id: 'map', label: UI_COPY.nav.map, icon: <Compass className="w-4 h-4" />, mobile: true },
    { id: 'discovery-lab', label: UI_COPY.nav.lab, icon: <FlaskConical className="w-4 h-4" /> },
    { id: 'stories', label: UI_COPY.nav.stories, icon: <BookOpen className="w-4 h-4" /> },
    { id: 'my-room', label: UI_COPY.nav.room, icon: <Palette className="w-4 h-4" />, mobile: true },
    { id: 'achievements', label: UI_COPY.nav.achievements, icon: <Award className="w-4 h-4" /> },
  ];

  const handleConfirmLogout = async () => {
    setLogoutModalOpen(false);
    if (isChildSession) {
      await exitChildMode();
    } else {
      await logoutParent();
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-gradient-to-b from-[#E5F6FF] via-[#FFF8E9] to-[#FFF2D9] text-[#27345C] overflow-x-hidden">
      {/* Layered animated storybook sky backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute top-12 start-[6%] w-40 h-16 rounded-full bg-white/75 blur-[1px] animate-drift-cloud" />
        <div
          className="absolute top-28 end-[10%] w-52 h-20 rounded-full bg-white/65 blur-[1px] animate-drift-cloud"
          style={{ animationDelay: '-4s' }}
        />
        <div className="hidden lg:block absolute top-56 start-[22%] w-3 h-3 rounded-full bg-[#FFD84D]/70 animate-twinkle" />
        <div
          className="hidden lg:block absolute top-40 end-[28%] w-4 h-4 rounded-full bg-[#FF78B7]/40 animate-twinkle"
          style={{ animationDelay: '-1.5s' }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FFF8E9]/90 backdrop-blur-md border-b border-[#27345C]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              if (isTeacher) navigate('teacher-dashboard');
              else if (isAdmin) navigate('admin-dashboard');
              else if (screen === 'parent-dashboard') navigate('parent-dashboard');
              else navigate('home');
            }}
            className="flex items-center whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8054D9] rounded-xl px-1"
          >
            <NonoLandLogo variant="compact" size="md" language={language} />
          </button>

          {/* Zone 2: Desktop Child Navigation Links (Hidden on Parent/Teacher/Admin Dashboards) */}
          {!hideChildWorldChrome && (
            <nav className="hidden xl:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  screen === item.id ||
                  (item.id === 'map' && (screen === 'world-detail' || screen === 'game' || screen === 'game-results')) ||
                  (item.id === 'fun-zone' &&
                    (screen === 'brain-games' || screen === 'creative-studio' || screen === 'entertainment-hub')) ||
                  (item.id === 'my-room' && (screen === 'my-avatar' || screen === 'my-pet')) ||
                  (item.id === 'achievements' && screen === 'reward-shop') ||
                  (item.id === 'stories' && (screen === 'story-reader' || screen === 'reading-adventure'));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#8054D9] text-white shadow-sm'
                        : 'text-[#27345C]/80 hover:bg-white hover:text-[#27345C]'
                    }`}
                  >
                    {item.icon}
                    <span>{t(item.label, language)}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Zone 3: Child Profile, Stars, Language & Role Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!isOnline && (
              <span
                title={language === 'ar' ? 'وضع عدم الاتصال' : 'Offline mode'}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#FF9360] px-2 py-1 rounded-lg bg-[#FF9360]/15"
              >
                <WifiOff className="w-3.5 h-3.5" />
                {pendingSyncCount > 0 && <span className="tabular-nums">{pendingSyncCount}</span>}
              </span>
            )}

            {/* Child Profile Header Area */}
            {!hideChildWorldChrome && activeChild && (
              isChildSession ? (
                <div
                  title={UNIFIED_STAGE_BADGE[language]}
                  className="h-10 ps-1.5 pe-3 rounded-xl bg-white border border-[#8054D9]/30 text-xs sm:text-sm font-extrabold text-[#27345C] flex items-center gap-2 max-w-[200px]"
                >
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 pointer-events-none">
                    <div className="scale-[0.65] origin-center">
                      <ChildAvatarPreview
                        avatar={activeChild.avatarConfig || DEFAULT_AVATAR_CONFIG}
                        size="sm"
                        animated={false}
                      />
                    </div>
                  </div>
                  <span className="truncate">{activeChild.displayName}</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      navigate('my-avatar');
                    }}
                    title={language === 'ar' ? 'تخصيص صورتي الرمزية' : 'Customize My Avatar'}
                    aria-label={language === 'ar' ? 'صورتي الرمزية' : 'My Avatar'}
                    className="w-10 h-10 rounded-xl bg-white border border-[#27345C]/15 flex items-center justify-center overflow-hidden hover:border-[#8054D9] cursor-pointer shrink-0"
                  >
                    <div className="scale-75 origin-center pointer-events-none">
                      <ChildAvatarPreview
                        avatar={activeChild.avatarConfig || DEFAULT_AVATAR_CONFIG}
                        size="sm"
                        animated={false}
                      />
                    </div>
                  </button>
                  <div className="relative">
                    <select
                      aria-label={language === 'ar' ? 'اختر ملف الطفل' : 'Switch child profile'}
                      title={UNIFIED_STAGE_BADGE[language]}
                      value={activeChild.id}
                      onChange={(e) => selectChild(e.target.value)}
                      className="h-10 max-w-[165px] sm:max-w-[260px] truncate ps-3 pe-7 rounded-xl bg-white border border-[#27345C]/15 text-xs sm:text-sm font-bold text-[#27345C] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8054D9]"
                    >
                      {childrenList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {getHeaderChildSelectorLabel(c, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )
            )}

            {/* Stars count (only in child world with activeChild) */}
            {!hideChildWorldChrome && activeChild && (
              <button
                type="button"
                onClick={() => navigate('achievements')}
                className="h-10 px-3 rounded-xl bg-[#FFD84D]/35 border border-[#FFD84D] flex items-center gap-1.5 font-extrabold text-sm text-[#27345C] tabular-nums whitespace-nowrap shrink-0 cursor-pointer hover:bg-[#FFD84D]/55 transition-colors"
              >
                <Star className="w-4 h-4 fill-[#FFD84D] text-[#FF9360]" />
                <span>{formatNumber(activeChild.stars, language)}</span>
              </button>
            )}

            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              aria-label="Toggle Arabic/English"
              className="h-10 px-2.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] flex items-center gap-1 hover:border-[#8054D9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Languages className="w-4 h-4 text-[#8054D9]" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* Role-Aware Portal Shortcut & Visible Logout */}
            {isChildSession ? (
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                title={language === 'ar' ? 'تسجيل الخروج من جلسة الطفل' : 'Log out of child session'}
                className="h-10 px-3 rounded-xl bg-[#FF9360] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-[#f07d47] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'خروج' : 'Exit'}</span>
              </button>
            ) : authSession.authenticated && isTeacher ? (
              <>
                {screen !== 'teacher-dashboard' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      navigate('teacher-dashboard');
                    }}
                    className="h-10 px-3 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-[#6d42c7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#FFD84D]" />
                    <span className="hidden sm:inline">
                      {language === 'ar' ? 'بوابة المعلم' : 'Teacher Portal'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(true)}
                  className="h-10 px-3 rounded-xl bg-[#FF4D6D]/12 text-[#B91C1C] border border-[#FF4D6D]/30 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 hover:bg-[#FF4D6D]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
                </button>
              </>
            ) : authSession.authenticated && isAdmin ? (
              <>
                {screen !== 'admin-dashboard' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      navigate('admin-dashboard');
                    }}
                    className="h-10 px-3 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-[#1d2746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#FFD84D]" />
                    <span className="hidden sm:inline">
                      {language === 'ar' ? 'لوحة الإدارة' : 'Admin Portal'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(true)}
                  className="h-10 px-3 rounded-xl bg-[#FF4D6D]/12 text-[#B91C1C] border border-[#FF4D6D]/30 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 hover:bg-[#FF4D6D]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
                </button>
              </>
            ) : authSession.authenticated ? (
              <>
                {screen !== 'parent-dashboard' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      navigate('parent-dashboard');
                    }}
                    className="h-10 px-3 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-[#1d2746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#FFD84D]" />
                    <span className="hidden sm:inline">{t(UI_COPY.parentArea, language)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(true)}
                  className="h-10 px-3 rounded-xl bg-[#FF4D6D]/12 text-[#B91C1C] border border-[#FF4D6D]/30 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 hover:bg-[#FF4D6D]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Log Out'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  navigate('parent-dashboard');
                }}
                className="h-10 px-3 rounded-xl bg-[#27345C] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 hover:bg-[#1d2746] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#FFD84D]" />
                <span className="hidden sm:inline">{t(UI_COPY.parentArea, language)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Quick-Launch Strip (Hidden on Parent/Teacher/Admin Dashboards) */}
        {!hideChildWorldChrome && (
          <div className="bg-white/75 backdrop-blur-sm border-b border-[#27345C]/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(
                [
                  {
                    id: 'quran-world' as AppScreen,
                    emoji: '🌙',
                    ar: 'عالم القرآن الكريم',
                    en: 'Quran World',
                    activeCls: 'bg-[#047857] text-white',
                  },
                  {
                    id: 'nono-ai' as AppScreen,
                    emoji: '🤖',
                    ar: 'مساعد نونو الذكي',
                    en: 'Nono AI',
                    activeCls: 'bg-[#8054D9] text-white',
                  },
                  {
                    id: 'reading-adventure' as AppScreen,
                    emoji: '📖',
                    ar: 'مغامرة القراءة (٨ مراحل)',
                    en: 'Reading (8 Stages)',
                    activeCls: 'bg-[#FF9360] text-white',
                  },
                  {
                    id: 'entertainment-hub' as AppScreen,
                    emoji: '🎭',
                    ar: 'مركز الترفيه والإبداع',
                    en: 'Entertainment Hub',
                    activeCls: 'bg-[#FF78B7] text-white',
                  },
                  {
                    id: 'family-activities' as AppScreen,
                    emoji: '👨‍👩‍👧',
                    ar: 'أنشطة الأهل والطفل',
                    en: 'Family Co-Play',
                    activeCls: 'bg-[#55D98B] text-[#14532D]',
                  },
                  {
                    id: 'discovery-lab' as AppScreen,
                    emoji: '🔬',
                    ar: 'المختبر والتقييم الذكي',
                    en: 'Smart Lab',
                    activeCls: 'bg-[#39BDF2] text-white',
                  },
                ] as const
              ).map((hub) => {
                const isActive = screen === hub.id;
                return (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      soundEngine.playPop();
                      navigate(hub.id);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      isActive
                        ? `${hub.activeCls} shadow-sm`
                        : 'bg-[#FFF8E9] text-[#27345C] border border-[#27345C]/10 hover:border-[#8054D9]/40'
                    }`}
                  >
                    <span>{hub.emoji}</span>
                    <span>{language === 'ar' ? hub.ar : hub.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Page Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-4">
        {children}
      </main>

      {/* Accessible Legal & Attribution Footer */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-24 lg:pb-8">
        <div className="pt-3 border-t border-[#27345C]/10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#27345C]/70">
          <span>Quran data provided by Quran.Foundation. · Sheikh Mahmoud Khalil Al-Husary</span>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setLegalDocOpen('privacy')}
              className="underline hover:text-[#047857] cursor-pointer"
            >
              {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
            <button
              type="button"
              onClick={() => setLegalDocOpen('terms')}
              className="underline hover:text-[#047857] cursor-pointer"
            >
              {language === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile & Tablet Bottom Tab Bar (Hidden on Parent/Teacher/Admin Dashboards) */}
      {!hideChildWorldChrome && (
        <nav
          aria-label="Mobile Navigation"
          className="xl:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#27345C]/10 px-1 py-1.5"
        >
          <div className="grid grid-cols-6 gap-1 max-w-2xl mx-auto">
            {navItems
              .filter((item) => item.mobile)
              .map((item) => {
                const isActive =
                  screen === item.id ||
                  (item.id === 'map' && (screen === 'world-detail' || screen === 'game'));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-0.5 px-1 transition-colors cursor-pointer ${
                      isActive ? 'text-[#8054D9] bg-[#8054D9]/10' : 'text-[#27345C]/65'
                    }`}
                  >
                    {item.icon}
                    <span className="text-[10px] font-bold leading-tight truncate max-w-full">
                      {t(item.label, language)}
                    </span>
                  </button>
                );
              })}
          </div>
        </nav>
      )}

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#27345C]/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm nono-card rounded-3xl bg-white p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-[#FF4D6D]/15 text-[#B91C1C] flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar' ? 'تأكيد تسجيل الخروج' : 'Confirm Log Out'}
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
              {isChildSession
                ? language === 'ar'
                  ? 'هل تريد الخروج من جلسة الطفل والعودة لشاشة تسجيل الدخول؟'
                  : 'Exit your learning session and return to the login screen?'
                : language === 'ar'
                  ? 'هل تريد تسجيل الخروج من حسابك ومسح الجلسة الحالية على هذا المتصفح؟'
                  : 'Are you sure you want to log out and end your active session?'}
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="flex-1 h-11 rounded-2xl bg-slate-100 text-[#27345C] text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLogout()}
                className="flex-1 h-11 rounded-2xl bg-[#DC2626] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                {language === 'ar' ? 'نعم، تسجيل الخروج' : 'Yes, Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
      <LegalDocumentsModal
        open={legalDocOpen !== null}
        activeDoc={legalDocOpen || 'privacy'}
        language={language}
        onChangeDoc={(doc) => setLegalDocOpen(doc)}
        onClose={() => setLegalDocOpen(null)}
      />
    </div>
  );
};
