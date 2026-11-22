import React, { useState } from 'react';
import { Sparkles, Theater, Volume2 } from 'lucide-react';
import { CharacterActor } from '../CharacterCast';
import { useNonoLand } from '../../context/NonoLandContext';
import { LocalizedText, OfficialCharacterId } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

interface TheaterShow {
  id: string;
  title: LocalizedText;
  cast: OfficialCharacterId[];
  scenes: Array<{
    id: string;
    speaker: OfficialCharacterId;
    line: LocalizedText;
    choices: Array<{ id: string; ar: string; en: string; nextSceneIdx: number }>;
  }>;
}

const THEATER_SHOWS: TheaterShow[] = [
  {
    id: 'picnic-surprise',
    title: { ar: 'مفاجأة النزهة الموسيقية', en: 'The Musical Picnic Surprise' },
    cast: ['nono', 'lolo', 'leo'],
    scenes: [
      {
        id: 's0',
        speaker: 'nono',
        line: {
          ar: 'أهلاً بكم على مسرح نونو لاند! اليوم سنُعدّ حفلة صغيرة. ماذا نبدأ به؟',
          en: 'Welcome to Nono Theater! Today we are preparing a happy garden show. What comes first?',
        },
        choices: [
          { id: 'c1', ar: 'نعزف لحناً مرحاً مع لولو 🎵', en: 'Play a cheerful song with Lolo 🎵', nextSceneIdx: 1 },
          { id: 'c2', ar: 'نروي نكتة ذكية مع ليو 🦁', en: 'Tell a clever joke with Leo 🦁', nextSceneIdx: 2 },
        ],
      },
      {
        id: 's1',
        speaker: 'lolo',
        line: {
          ar: 'ترا لا لا! عندما نتشارك الغناء، تصبح الحديقة مليئة بالبهجة والنجوم!',
          en: 'Tra la la! When friends sing together, the whole garden sparkles with joy!',
        },
        choices: [
          { id: 'finish', ar: 'التحية الختامية والتصفيق 👏', en: 'Take a Happy Bow 👏', nextSceneIdx: 3 },
        ],
      },
      {
        id: 's2',
        speaker: 'leo',
        line: {
          ar: 'ما الحرف الذي يحب الفضاء؟ حرف القاف لأنه يشبه القمر 🌙! هاها!',
          en: 'Why did the math book smile? Because it loved counting stars ⭐! Haha!',
        },
        choices: [
          { id: 'finish', ar: 'التحية الختامية والتصفيق 👏', en: 'Take a Happy Bow 👏', nextSceneIdx: 3 },
        ],
      },
      {
        id: 's3',
        speaker: 'nono',
        line: {
          ar: 'رائع! شكراً لجمهور نونو المبدع على اختيار مجرى القصة!',
          en: 'Bravo! Thank you for directing our Nono Theater performance!',
        },
        choices: [],
      },
    ],
  },
  {
    id: 'moon-rocket',
    title: { ar: 'رحلة إيلي وتيتي إلى القمر', en: 'Ellie & Titi Moon Adventure' },
    cast: ['ellie', 'titi', 'bobo'],
    scenes: [
      {
        id: 'm0',
        speaker: 'ellie',
        line: {
          ar: 'مرحباً! تيتي وأنا نركب صاروخ الورق نحو القمر. هل نأخذ التلسكوب أم الخريطة؟',
          en: 'Hello! Titi and I are boarding our cardboard rocket. Should we pack a telescope or a star map?',
        },
        choices: [
          { id: 't', ar: 'نأخذ التلسكوب لرؤية النجوم 🔭', en: 'Pack the Telescope 🔭', nextSceneIdx: 1 },
          { id: 'm', ar: 'نأخذ خريطة الكواكب 🗺️', en: 'Pack the Star Map 🗺️', nextSceneIdx: 2 },
        ],
      },
      {
        id: 'm1',
        speaker: 'titi',
        line: {
          ar: 'رائع! بالتلسكوب رأينا كوكب زحل بحلقاته الذهبية الجميلة 🪐!',
          en: 'Awesome! Through the telescope we spotted Saturn’s golden rings 🪐!',
        },
        choices: [{ id: 'end', ar: 'هبوط آمن واحتفال 🚀', en: 'Safe Landing Celebration 🚀', nextSceneIdx: 3 }],
      },
      {
        id: 'm2',
        speaker: 'bobo',
        line: {
          ar: 'الخريطة ساعدتنا أن نحسب المسافة بدقة ونعود للمنزل بسلام!',
          en: 'The star map helped us count every planet on the way home!',
        },
        choices: [{ id: 'end', ar: 'هبوط آمن واحتفال 🚀', en: 'Safe Landing Celebration 🚀', nextSceneIdx: 3 }],
      },
      {
        id: 'm3',
        speaker: 'ellie',
        line: {
          ar: 'عمل جماعي رائع بين كل الشخصيات! إلى عرض مسرحي جديد قريباً!',
          en: 'What wonderful teamwork! See you at the next theater show!',
        },
        choices: [],
      },
    ],
  },
];

export const NonoTheaterPanel: React.FC = () => {
  const { activeChild, language, saveEntertainmentCreation } = useNonoLand();
  const [showIdx, setShowIdx] = useState(0);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [status, setStatus] = useState('');

  if (!activeChild) return null;

  const show = THEATER_SHOWS[showIdx];
  const scene = show.scenes[sceneIdx];

  const handleChoice = async (nextIdx: number) => {
    soundEngine.playPop();
    setSceneIdx(nextIdx);
    const nextScene = show.scenes[nextIdx];
    if (nextScene) {
      soundEngine.speak(nextScene.line[language], language);
      if (nextScene.choices.length === 0) {
        const res = await saveEntertainmentCreation({
          kind: 'theater',
          payload: { sceneId: show.id },
        });
        setStatus(
          language === 'ar'
            ? `أكملت العرض المسرحي بنجاح! (+${res.starsAdded} نجوم) 🎭`
            : `Theater performance complete! (+${res.starsAdded} stars) 🎭`,
        );
      }
    }
  };

  return (
    <div className="nono-card p-6 bg-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Theater className="w-6 h-6 text-[#EC4899]" />
            <span>{language === 'ar' ? 'مسرح نونو التفاعلي' : 'Interactive Nono Theater'}</span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? `عروض مكتملة: ${activeChild.completedTheaterScenes?.length || 0}`
              : `Shows Completed: ${activeChild.completedTheaterScenes?.length || 0}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {THEATER_SHOWS.map((sh, idx) => (
            <button
              key={sh.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setShowIdx(idx);
                setSceneIdx(0);
                setStatus('');
              }}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                showIdx === idx ? 'bg-[#EC4899] text-white' : 'bg-slate-100 text-[#27345C]'
              }`}
            >
              {sh.title[language]}
            </button>
          ))}
        </div>
      </div>

      {/* Stage Backdrop */}
      <div className="rounded-3xl p-6 bg-gradient-to-b from-[#312E81] via-[#4C1D95] to-[#1E1B4B] text-white space-y-5 border-4 border-[#FFD84D]">
        <div className="flex flex-wrap justify-center gap-6 py-2">
          {show.cast.map((cid) => (
            <div
              key={cid}
              className={`p-2 rounded-2xl transition-transform ${
                scene.speaker === cid ? 'bg-white/20 scale-110 ring-2 ring-[#FFD84D]' : 'opacity-80'
              }`}
            >
              <CharacterActor
                characterId={cid}
                mood={scene.speaker === cid ? 'celebrating' : 'idle'}
                size="sm"
              />
            </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-white text-[#27345C] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#8054D9] uppercase">
              {scene.speaker}
            </span>
            <button
              type="button"
              onClick={() => soundEngine.speak(scene.line[language], language)}
              className="px-3 py-1 rounded-lg bg-[#F3ECFF] text-xs font-extrabold text-[#8054D9] flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'استمع للحوار' : 'Speak Line'}</span>
            </button>
          </div>
          <p className="text-base font-extrabold">{scene.line[language]}</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {scene.choices.length > 0 ? (
              scene.choices.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => void handleChoice(ch.nextSceneIdx)}
                  className="min-h-[44px] px-4 rounded-xl bg-[#FFD84D] hover:bg-[#FACC15] text-[#27345C] text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  {ch[language]}
                </button>
              ))
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSceneIdx(0);
                  setStatus('');
                }}
                className="min-h-[44px] px-5 rounded-xl bg-[#55D98B] text-[#27345C] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{language === 'ar' ? 'إعادة المسرحية' : 'Replay Theater Show'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {status && <p className="text-sm font-extrabold text-[#16A34A]">{status}</p>}
    </div>
  );
};
