import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FastForward,
  Languages,
  Lock,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { UNIFIED_STAGE_AGE_RANGE, UNIFIED_STAGE_NAME } from '../utils/ageAdaptation';
import { cinematicSound } from '../utils/cinematicSound';
import { soundEngine } from '../utils/soundEngine';
import { NonoLandLogo } from './NonoLandLogo';
import { CinematicBook3D } from './intro/CinematicBook3D';
import { CinematicFantasyWorld } from './intro/CinematicFantasyWorld';
import { NonoBoyMascot3D } from './intro/NonoBoyMascot3D';

export const INTRO_SKIP_STORAGE_KEY = 'nonoland_skip_intro_v1';

type IntroScene = 1 | 2 | 3 | 4 | 5 | 6;

const SCENE_DURATIONS_MS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1500, // 0.0 - 1.5s: First Spark
  2: 1650, // 1.5 - 3.15s: Book Comes Alive
  3: 1850, // 3.15 - 5.0s: Portal Explosion
  4: 2000, // 5.0 - 7.0s: Nono's Grand Entrance
  5: 2200, // 7.0 - 9.2s: World & Logo Reveal -> settles cleanly into Scene 6
};

const AMBIENT_STARS = [
  { top: '10%', left: '10%', size: 13, color: '#FFD84D', delay: '0s' },
  { top: '16%', left: '84%', size: 15, color: '#39BDF2', delay: '-0.8s' },
  { top: '30%', left: '48%', size: 10, color: '#FFD84D', delay: '-1.6s' },
  { top: '70%', left: '8%', size: 12, color: '#FF78B7', delay: '-1.2s' },
  { top: '76%', left: '91%', size: 14, color: '#55D98B', delay: '-0.4s' },
  { top: '52%', left: '94%', size: 9, color: '#FFD84D', delay: '-2.1s' },
];

const ORBITING_STARS = [
  { angle: 0, color: '#FFD84D', glyph: '★' },
  { angle: 60, color: '#39BDF2', glyph: '✦' },
  { angle: 120, color: '#FF78B7', glyph: '★' },
  { angle: 180, color: '#55D98B', glyph: '✦' },
  { angle: 240, color: '#FFD84D', glyph: '★' },
  { angle: 300, color: '#FF9360', glyph: '✦' },
];

export const CinematicWelcomeIntro: React.FC = () => {
  const {
    navigate,
    language,
    setLanguage,
    parentSettings,
    updateParentSettings,
    authSession,
  } = useNonoLand();

  const osReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = Boolean(parentSettings.reducedMotion) || osReducedMotion;

  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INTRO_SKIP_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [scene, setScene] = useState<IntroScene>(() => {
    if (reduced) return 6;
    try {
      if (localStorage.getItem(INTRO_SKIP_STORAGE_KEY) === 'true') return 6;
    } catch {
      // ignore
    }
    return 1;
  });

  const [autoPlaying, setAutoPlaying] = useState<boolean>(() => {
    if (reduced) return false;
    try {
      return localStorage.getItem(INTRO_SKIP_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  // Web audio starts only after explicit user interaction (respecting browser autoplay rules)
  const [cinematicAudioActive, setCinematicAudioActive] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const ArrowIcon = language === 'ar' ? ArrowLeft : ArrowRight;

  const persistSkipPreferenceIfChecked = useCallback(() => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(INTRO_SKIP_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
    }
  }, [dontShowAgain]);

  const goToLoginOrHome = useCallback(() => {
    cinematicSound.stopAll();
    persistSkipPreferenceIfChecked();
    soundEngine.playPop();
    if (authSession.authenticated && authSession.user) {
      const role = authSession.user.role;
      if (role === 'teacher') return navigate('teacher-dashboard');
      if (role === 'student') return navigate('exams');
      if (role === 'child') return navigate('home');
      if (
        role === 'super_admin' ||
        role === 'admin' ||
        role === 'content_admin' ||
        role === 'curriculum_manager' ||
        role === 'finance_admin' ||
        role === 'support_agent'
      ) {
        return navigate('admin-dashboard');
      }
      return navigate('parent-dashboard');
    }
    navigate('parent-auth');
  }, [authSession, navigate, persistSkipPreferenceIfChecked]);

  // Immediate session restoration redirect when authenticated
  useEffect(() => {
    if (authSession.authenticated) {
      goToLoginOrHome();
    }
  }, [authSession.authenticated, goToLoginOrHome]);

  // Force Scene 6 when reduced motion becomes active
  useEffect(() => {
    if (reduced && scene < 6) {
      setAutoPlaying(false);
      setScene(6);
    }
  }, [reduced, scene]);

  // Scene progression scheduler with clean timer cleanup
  useEffect(() => {
    if (reduced || !autoPlaying || scene === 6) return;
    const duration = SCENE_DURATIONS_MS[scene];
    const timer = window.setTimeout(() => {
      setScene((prev) => (prev < 6 ? ((prev + 1) as IntroScene) : 6));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [scene, autoPlaying, reduced]);

  // Trigger scene audio cues when user explicitly enabled intro sound & is not muted
  useEffect(() => {
    if (!parentSettings.muted && cinematicAudioActive) {
      cinematicSound.playCueForScene(scene, false);
    }
  }, [scene, cinematicAudioActive, parentSettings.muted]);

  // Clean up all timers, rAFs & audio nodes on unmount
  useEffect(() => {
    return () => {
      cinematicSound.stopAll();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleToggleSound = () => {
    const nextMuted = !parentSettings.muted;
    updateParentSettings({ muted: nextMuted });
    if (nextMuted) {
      cinematicSound.setMuted(true);
      setCinematicAudioActive(false);
    } else {
      const ok = cinematicSound.unlockAndEnable(false);
      setCinematicAudioActive(ok);
      if (ok) {
        cinematicSound.playCueForScene(scene, false);
      }
    }
  };

  const handleSkipToInvitation = () => {
    setAutoPlaying(false);
    setScene(6);
    if (!parentSettings.muted && cinematicAudioActive) {
      cinematicSound.playCueForScene(6, false);
    }
  };

  const handleReplaySequence = () => {
    if (reduced) {
      setScene(6);
      return;
    }
    setAutoPlaying(true);
    setScene(1);
    if (!parentSettings.muted && cinematicAudioActive) {
      cinematicSound.playCueForScene(1, false);
    }
  };

  const jumpToScene = (target: IntroScene) => {
    setAutoPlaying(target < 6 && !reduced);
    setScene(target);
  };

  const toggleDontShow = (checked: boolean) => {
    setDontShowAgain(checked);
    try {
      if (checked) localStorage.setItem(INTRO_SKIP_STORAGE_KEY, 'true');
      else localStorage.removeItem(INTRO_SKIP_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || scene < 5 || e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => {
      setParallax({
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      });
    });
  };

  const sceneCaption: Record<IntroScene, { ar: string; en: string }> = {
    1: { ar: 'شرارة خيال توقظ الصفحات السحرية...', en: 'A golden spark awakens the enchanted pages...' },
    2: { ar: 'تنبض الصفحات بالحروف والألوان والنجوم...', en: 'The pages come alive with letters, colors & light...' },
    3: { ar: 'تُفتح البوابة نحو عالم العجائب!', en: 'The portal opens into NonoLand...' },
    4: { ar: 'أهلاً بكم! نونو يرحّب بكل مستكشف صغير', en: 'Say hello to Nono, your joyful guide!' },
    5: { ar: 'المستكشفون الصغار · عالم ينتظركم', en: 'Little Explorers · A World Awaits You' },
    6: { ar: '', en: '' },
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      className="min-h-screen relative overflow-hidden text-white flex flex-col justify-between px-4 sm:px-8 lg:px-12 py-4 sm:py-6 select-none"
    >
      {/* Multi-Plane 3D Parallax Fantasy Universe Layer */}
      <CinematicFantasyWorld scene={scene} reduced={reduced} parallax={parallax} />

      {/* Ambient Twinkling Sky Stars (GPU Opacity/Transform Only) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[2]" aria-hidden="true">
        {AMBIENT_STARS.map((st, idx) => (
          <svg
            key={idx}
            viewBox="0 0 24 24"
            className="absolute animate-twinkle"
            style={{
              top: st.top,
              left: st.left,
              width: st.size,
              height: st.size,
              animationDelay: st.delay,
              opacity: scene === 1 ? 0.45 : 0.85,
            }}
          >
            <path
              d="M12 1.5 L14.4 9.6 L22.5 12 L14.4 14.4 L12 22.5 L9.6 14.4 L1.5 12 L9.6 9.6 Z"
              fill={st.color}
            />
          </svg>
        ))}
      </div>

      {/* Top Navigation & Controls — Immediately Accessible From Frame 0 */}
      <header className="relative z-30 max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <NonoLandLogo variant="compact" size="md" tone="dark" language={language} />
        </div>

        {/* Interactive Scene Stepper (Desktop/Tablet) */}
        {!reduced && (
          <nav
            aria-label={language === 'ar' ? 'مشاهد المقدمة' : 'Intro scenes'}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0C1335]/55 backdrop-blur-md border border-white/15"
          >
            {([1, 2, 3, 4, 5, 6] as IntroScene[]).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => jumpToScene(num)}
                aria-label={`Scene ${num}`}
                aria-current={scene === num ? 'step' : undefined}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] ${
                  scene === num ? 'w-7 bg-[#FFD84D]' : 'w-2.5 bg-white/35 hover:bg-white/70'
                }`}
              />
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Enable / Mute Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={
              parentSettings.muted || !cinematicAudioActive
                ? language === 'ar'
                  ? 'تشغيل الصوت السحري'
                  : 'Enable magical audio'
                : language === 'ar'
                  ? 'كتم الصوت'
                  : 'Mute audio'
            }
            className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D] ${
              cinematicAudioActive && !parentSettings.muted
                ? 'bg-[#FFD84D]/20 border-[#FFD84D]/55 text-[#FFD84D]'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
          >
            {parentSettings.muted || !cinematicAudioActive ? (
              <VolumeX className="w-4 h-4 text-[#FF9360]" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#FFD84D]" />
            )}
            <span className="hidden sm:inline">
              {parentSettings.muted
                ? language === 'ar'
                  ? 'صامت'
                  : 'Muted'
                : cinematicAudioActive
                  ? language === 'ar'
                    ? 'الصوت مفعل'
                    : 'Audio On'
                  : language === 'ar'
                    ? 'تشغيل الصوت'
                    : 'Audio'}
            </span>
          </button>

          {/* Language Toggle (Arabic RTL <-> English LTR) */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            aria-label="Toggle Arabic/English"
            className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]"
          >
            <Languages className="w-4 h-4 text-[#FFD84D]" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Skip Intro (Scenes 1-5) OR Replay (Scene 6) */}
          {scene < 6 ? (
            <button
              type="button"
              onClick={handleSkipToInvitation}
              className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-white/16 hover:bg-white/28 border border-white/30 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]"
            >
              <FastForward className="w-4 h-4 text-[#FFD84D]" />
              <span>{language === 'ar' ? 'تخطي المقدمة' : 'Skip Intro'}</span>
            </button>
          ) : (
            !reduced && (
              <button
                type="button"
                onClick={handleReplaySequence}
                className="min-h-[44px] px-3.5 rounded-xl bg-white/12 hover:bg-white/22 border border-white/20 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#FFD84D]" />
                <span className="hidden sm:inline">{language === 'ar' ? 'إعادة المشهد' : 'Replay'}</span>
              </button>
            )
          )}

          {/* Immediate Login / Sign Up Access From Frame 0 */}
          <button
            type="button"
            onClick={goToLoginOrHome}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#FFD84D] hover:bg-[#ffe16e] text-[#1A2447] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'دخول' : 'Sign In'}</span>
          </button>
        </div>
      </header>

      {/* MAIN DIRECTED CINEMATIC STAGE */}
      <main className="relative z-10 max-w-7xl w-full mx-auto my-auto py-4 sm:py-6 flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* ===============================================================
              SCENES 1–5: DIRECTED CINEMATIC SEQUENCE (0s – 9.2s)
             =============================================================== */}
          {scene < 6 && (
            <motion.div
              key="cinematic-sequence"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              transition={{ duration: 0.45 }}
              className="relative flex flex-col items-center justify-center min-h-[460px] sm:min-h-[540px] text-center"
            >
              {/* SCENE 1: THE MYSTERIOUS FIRST SPARK */}
              {scene === 1 && (
                <div className="relative w-full max-w-3xl h-[380px] sm:h-[440px] flex flex-col items-center justify-center">
                  {/* Curved Spark Flight Path + Glowing Trail */}
                  <svg
                    viewBox="0 0 600 260"
                    className="pointer-events-none absolute inset-x-0 top-0 w-full h-56 overflow-visible"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="sparkTrailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#39BDF2" stopOpacity="0" />
                        <stop offset="55%" stopColor="#FFD84D" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      d="M40 40 Q210 -15 300 170"
                      fill="none"
                      stroke="url(#sparkTrailGrad)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0.2 }}
                      animate={{ pathLength: 1, opacity: [0.3, 1, 0.7] }}
                      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>

                  {/* Travelling Golden Comet Spark */}
                  <motion.div
                    aria-hidden="true"
                    initial={{ x: -210, y: -110, scale: 0.6, opacity: 0 }}
                    animate={{
                      x: [-210, -40, 0],
                      y: [-110, -135, 16],
                      scale: [0.6, 1.45, 0.2],
                      opacity: [0, 1, 0],
                    }}
                    transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                    className="relative z-20 w-7 h-7 rounded-full bg-[#FFF7C2] shadow-[0_0_28px_10px_#FFD84D]"
                  />

                  {/* Book Awakening on Spark Impact */}
                  <motion.div
                    initial={{ opacity: 0.45, scale: 0.85 }}
                    animate={{ opacity: 1, scale: [0.85, 0.96, 1] }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                    className="relative z-10 mt-6"
                  >
                    <CinematicBook3D scene={1} reduced={reduced} onBookTap={handleSkipToInvitation} />
                  </motion.div>
                </div>
              )}

              {/* SCENE 2: DRAMATIC CLOSE-UP — THE BOOK COMES ALIVE */}
              {scene === 2 && (
                <motion.div
                  key="scene-2-book"
                  initial={{ scale: 0.9, opacity: 0.7 }}
                  animate={{ scale: 1.16, opacity: 1 }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className="relative py-12 flex flex-col items-center justify-center"
                >
                  <CinematicBook3D scene={2} reduced={reduced} onBookTap={handleSkipToInvitation} />
                </motion.div>
              )}

              {/* SCENE 3: THE PORTAL EXPLOSION -> FANTASY WORLD */}
              {scene === 3 && (
                <motion.div
                  key="scene-3-portal"
                  initial={{ scale: 0.82, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className="relative py-8 flex flex-col items-center justify-center gap-6"
                >
                  <motion.div
                    initial={{ scale: 0.3, opacity: 1 }}
                    animate={{ scale: 1.85, opacity: 0 }}
                    transition={{ duration: 1.25, ease: 'easeOut' }}
                    className="pointer-events-none absolute w-56 h-56 rounded-full bg-radial from-[#FFF8D6] via-[#FFD84D]/60 to-transparent blur-xl"
                  />
                  <CinematicBook3D scene={3} reduced={reduced} onBookTap={handleSkipToInvitation} />
                </motion.div>
              )}

              {/* SCENE 4: NONO'S GRAND ENTRANCE + LIGHT TRAIL TO CASTLE */}
              {scene === 4 && (
                <motion.div
                  key="scene-4-nono"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="relative flex flex-col items-center justify-center gap-3 py-4"
                >
                  {/* Swirling Golden Light Trail Leading Toward Castle */}
                  <svg
                    viewBox="0 0 640 240"
                    className="pointer-events-none absolute -top-8 w-[340px] sm:w-[580px] h-auto overflow-visible"
                    aria-hidden="true"
                  >
                    <motion.path
                      d="M110 190 C160 40, 420 20, 560 95"
                      fill="none"
                      stroke="#FFD84D"
                      strokeWidth="4"
                      strokeDasharray="10 8"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.85 }}
                      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </svg>

                  <NonoBoyMascot3D
                    mood="entering"
                    reduced={reduced}
                    onTap={() => soundEngine.playCelebration()}
                  />
                  <div className="scale-75 -mt-6 opacity-85">
                    <CinematicBook3D scene={4} reduced={reduced} />
                  </div>
                </motion.div>
              )}

              {/* SCENE 5: THE WORLD REVEAL + OFFICIAL APPROVED LOGO REVEAL */}
              {scene === 5 && (
                <motion.div
                  key="scene-5-reveal"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex flex-col items-center justify-center gap-4 py-4"
                >
                  {/* Orbiting Golden Star Ring Behind Approved Logo */}
                  <motion.div
                    aria-hidden="true"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                    className="pointer-events-none absolute w-72 h-72 sm:w-[26rem] sm:h-[26rem] flex items-center justify-center"
                  >
                    {ORBITING_STARS.map((st, idx) => (
                      <span
                        key={idx}
                        className="absolute text-lg sm:text-xl font-bold drop-shadow-[0_0_10px_rgba(255,216,77,0.9)]"
                        style={{
                          color: st.color,
                          transform: `rotate(${st.angle}deg) translateY(-148px)`,
                        }}
                      >
                        {st.glyph}
                      </span>
                    ))}
                  </motion.div>

                  {/* Official Approved NonoLand Logo Reveal (Sharp & Visually Unchanged) */}
                  <div className="relative z-10 rounded-[2rem] p-2 sm:p-3 bg-white/10 backdrop-blur-md border border-[#FFD84D]/55 shadow-[0_24px_70px_-10px_rgba(255,216,77,0.45)]">
                    <NonoLandLogo
                      variant="main"
                      size="xl"
                      tone="dark"
                      showWordmark={false}
                      language={language}
                      className="[&>div]:w-64 sm:[&>div]:w-88 md:[&>div]:w-[26rem]"
                    />
                  </div>

                  {/* Floating Foreground Magical Book */}
                  <div className="-mt-7 scale-75 sm:scale-85 relative z-20">
                    <CinematicBook3D scene={5} reduced={reduced} />
                  </div>
                </motion.div>
              )}

              {/* Subtle Storytelling Subtitle & Mobile Progress Bar */}
              <div className="relative z-20 mt-4 space-y-2">
                <p className="text-sm sm:text-base font-extrabold text-[#FFE999] drop-shadow">
                  {sceneCaption[scene][language]}
                </p>
                <div className="flex items-center justify-center gap-1.5">
                  {([1, 2, 3, 4, 5] as const).map((s) => (
                    <span
                      key={s}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        scene === s ? 'w-8 bg-[#FFD84D]' : scene > s ? 'w-3 bg-[#55D98B]' : 'w-3 bg-white/25'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              SCENE 6: THE INVITATION — PREMIUM LIVING LANDING EXPERIENCE
             =============================================================== */}
          {scene === 6 && (
            <motion.div
              key="scene-6-invitation"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center py-2 sm:py-4"
            >
              {/* RIGHT / CONTENT AREA (in RTL Arabic) | LEFT (in LTR English) */}
              <section className="lg:col-span-6 space-y-5 text-center lg:text-start order-2 lg:order-1">
                <p className="text-xs sm:text-sm font-extrabold text-[#FFD84D]">
                  {language === 'ar'
                    ? 'عالم تعليمي تفاعلي للأطفال من سنة إلى ٤ سنوات'
                    : 'Interactive Educational World for Ages 1 to 4'}
                </p>

                <h1 className="text-3xl sm:text-5xl xl:text-[3.35rem] font-extrabold leading-[1.24] text-balance text-white drop-shadow-sm">
                  {language === 'ar'
                    ? 'كل طفل جواه عالم من الخيال!'
                    : 'Every Child Holds a World of Imagination!'}
                </h1>

                <p className="text-base sm:text-xl text-white/90 max-w-xl mx-auto lg:mx-0 leading-relaxed font-semibold">
                  {language === 'ar'
                    ? 'في NonoLand، كل يوم مغامرة جديدة للتعلم واللعب والاكتشاف.'
                    : 'At NonoLand, every day is a new adventure to learn, play, and discover.'}
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-3 gap-y-1 text-sm font-extrabold text-[#8CE7FF]">
                  <span>
                    {UNIFIED_STAGE_NAME[language]} · {UNIFIED_STAGE_AGE_RANGE[language]}
                  </span>
                </div>

                {/* Primary & Secondary CTAs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <motion.button
                    type="button"
                    onClick={goToLoginOrHome}
                    whileHover={reduced ? undefined : { scale: 1.03 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                    className="relative nono-btn-tactile min-h-[54px] px-8 rounded-2xl bg-[#FFD84D] hover:bg-[#ffe16e] text-[#1A2447] text-base sm:text-lg font-extrabold flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-[0_0_28px_rgba(255,216,77,0.45)]"
                  >
                    <Sparkles className="w-5 h-5 shrink-0" />
                    <span>{language === 'ar' ? 'هيا نكتشف!' : "Let's Explore!"}</span>
                    <ArrowIcon className="w-5 h-5 shrink-0" />
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => {
                      cinematicSound.stopAll();
                      soundEngine.playPop();
                      navigate('onboarding');
                    }}
                    className="min-h-[54px] px-6 rounded-2xl bg-white/12 hover:bg-white/22 border border-white/30 text-white text-base font-extrabold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD84D]"
                  >
                    <Compass className="w-5 h-5 text-[#39BDF2] shrink-0" />
                    <span>{language === 'ar' ? 'جولة تعريفية' : 'Guided Tour'}</span>
                  </button>
                </div>

                {/* Clean Learning Highlights (Unboxed Typography) */}
                <div className="pt-4 border-t border-white/12 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1 text-xs sm:text-sm font-bold text-white/75">
                  <span>{language === 'ar' ? 'حروف وأصوات' : 'Letters & Phonics'}</span>
                  <span aria-hidden="true" className="text-[#FFD84D]">·</span>
                  <span>{language === 'ar' ? 'ألوان وأرقام' : 'Colors & Counting'}</span>
                  <span aria-hidden="true" className="text-[#FFD84D]">·</span>
                  <span>{language === 'ar' ? 'قصص ومختبر نونو' : "Stories & Nono's Lab"}</span>
                </div>
              </section>

              {/* LEFT / VISUAL AREA (in RTL Arabic) | RIGHT (in LTR English): Living Logo + Magical Book */}
              <section
                className="lg:col-span-6 order-1 lg:order-2 flex flex-col items-center justify-center"
                style={{
                  transform: reduced
                    ? undefined
                    : `translate3d(${parallax.x * -10}px, ${parallax.y * -6}px, 0)`,
                }}
              >
                <div className="relative w-full max-w-[32rem] mx-auto flex flex-col items-center pt-2">
                  {/* Soft Living World Glow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-4 top-4 bottom-8 rounded-[3rem] bg-gradient-to-tr from-[#39BDF2]/35 via-[#FFD84D]/30 to-[#FF78B7]/30 blur-2xl animate-magical-glow"
                  />

                  {/* Sharp, Approved Official NonoLand Logo */}
                  <div className="animate-float-slow relative z-10 w-full flex justify-center">
                    <div className="rounded-[2rem] p-2 sm:p-2.5 bg-white/10 backdrop-blur-md border border-white/25 shadow-[0_24px_60px_-14px_rgba(9,15,44,0.65)]">
                      <NonoLandLogo
                        variant="main"
                        size="xl"
                        tone="dark"
                        showWordmark={false}
                        language={language}
                        className="[&>div]:w-full [&>div]:max-w-[24rem] sm:[&>div]:max-w-[27rem]"
                      />
                    </div>
                  </div>

                  {/* Interactive 3D Floating Magical Book Pedestal Below Artwork */}
                  <div className="-mt-6 scale-[0.78] sm:scale-[0.86] relative z-20">
                    <CinematicBook3D
                      scene={6}
                      reduced={reduced}
                      onBookTap={() => soundEngine.playMusicNote(Math.floor(Math.random() * 5))}
                    />
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quiet Accessible Footer */}
      <footer className="relative z-30 max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-white/75 pt-2.5 border-t border-white/12">
        <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => toggleDontShow(e.target.checked)}
            className="w-4 h-4 accent-[#FFD84D] rounded"
          />
          <span>
            {language === 'ar' ? 'لا تعرض هذه المقدمة مرة أخرى' : "Don't show this intro again"}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <span>
            {language === 'ar'
              ? 'مساحة آمنة للأطفال (١–٤ سنوات) · بدون إعلانات'
              : 'Child-Safe Space (Ages 1–4) · Zero Ads'}
          </span>
          <button
            type="button"
            onClick={goToLoginOrHome}
            className="min-h-[44px] inline-flex items-center gap-1.5 font-bold text-white/90 hover:text-[#FFD84D] underline cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'دخول الأهل' : 'Parent Sign In'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
