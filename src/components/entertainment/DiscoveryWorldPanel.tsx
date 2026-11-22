import React, { useState } from 'react';
import { CheckCircle2, Globe2, Volume2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { LocalizedText } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

interface DiscoveryTheme {
  id: string;
  emoji: string;
  title: LocalizedText;
  fact: LocalizedText;
  question: LocalizedText;
  options: Array<{ id: string; ar: string; en: string; emoji: string }>;
  correctId: string;
}

const DISCOVERY_THEMES: DiscoveryTheme[] = [
  {
    id: 'animals',
    emoji: '🦁',
    title: { ar: 'الحيوانات ومواطنها', en: 'Animals & Habitats' },
    fact: { ar: 'البطريق يعيش في القطب المتجمد ويسبح بمهارة في الماء البارد!', en: 'Penguins live in snowy icy regions and swim gracefully in cold oceans!' },
    question: { ar: 'أي حيوان يعيش في الماء طوال وقته؟', en: 'Which animal lives in water full-time?' },
    options: [
      { id: 'dolphin', ar: 'الدلفين', en: 'Dolphin', emoji: '🐬' },
      { id: 'camel', ar: 'الجمل', en: 'Camel', emoji: '🐪' },
      { id: 'eagle', ar: 'النسر', en: 'Eagle', emoji: '🦅' },
    ],
    correctId: 'dolphin',
  },
  {
    id: 'space',
    emoji: '🪐',
    title: { ar: 'الفضاء والكواكب', en: 'Space & Planets' },
    fact: { ar: 'تدور كواكب المجموعة الشمسية حول نجم واحد مضيء هو الشمس!', en: 'Planets in our solar system orbit one bright star called the Sun!' },
    question: { ar: 'ما النجم الذي يعطينا الضوء والدفء نهاراً؟', en: 'Which star gives us daytime light and warmth?' },
    options: [
      { id: 'sun', ar: 'الشمس', en: 'The Sun', emoji: '☀️' },
      { id: 'saturn', ar: 'زحل', en: 'Saturn', emoji: '🪐' },
      { id: 'comet', ar: 'المذنب', en: 'Comet', emoji: '☄️' },
    ],
    correctId: 'sun',
  },
  {
    id: 'nature',
    emoji: '🌿',
    title: { ar: 'الطبيعة والنباتات', en: 'Nature & Plants' },
    fact: { ar: 'تحتاج النباتات إلى الماء والهواء وضوء الشمس لتنمو وتزهر!', en: 'Plants need water, air, and sunlight to grow tall and bloom!' },
    question: { ar: 'ما الجزء الذي يمتص الماء من التربة؟', en: 'Which plant part absorbs water from soil?' },
    options: [
      { id: 'roots', ar: 'الجذور', en: 'Roots', emoji: '🌱' },
      { id: 'flower', ar: 'البتلات', en: 'Petals', emoji: '🌸' },
      { id: 'fruit', ar: 'الثمرة', en: 'Fruit', emoji: '🍎' },
    ],
    correctId: 'roots',
  },
  {
    id: 'weather',
    emoji: '🌦️',
    title: { ar: 'الطقس والفصول', en: 'Weather & Seasons' },
    fact: { ar: 'عندما تجتمع أشعة الشمس مع قطرات المطر يتكوّن قوس قزح بسبعة ألوان!', en: 'When sunlight meets raindrops in the sky, a 7-color rainbow appears!' },
    question: { ar: 'ماذا نلبس في يوم ممطر وبارد؟', en: 'What do we carry on a rainy day?' },
    options: [
      { id: 'umbrella', ar: 'مظلة ومعطف مطر', en: 'Umbrella & Raincoat', emoji: '☂️' },
      { id: 'swimsuit', ar: 'نظارة شاطئ', en: 'Beach Goggles', emoji: '🥽' },
      { id: 'fan', ar: 'مروحة صيفية', en: 'Summer Fan', emoji: '🪭' },
    ],
    correctId: 'umbrella',
  },
  {
    id: 'body',
    emoji: '🫀',
    title: { ar: 'جسم الإنسان والحواس', en: 'Human Body & Senses' },
    fact: { ar: 'لنا خمس حواس رائعة: البصر، السمع، الشم، التذوق، واللمس!', en: 'We explore the world with 5 senses: sight, hearing, smell, taste, and touch!' },
    question: { ar: 'بأي عضو نسمع الموسيقى وصوت العصافير؟', en: 'Which body part helps us hear music and birds?' },
    options: [
      { id: 'ears', ar: 'الأذنان', en: 'Ears', emoji: '👂' },
      { id: 'eyes', ar: 'العينان', en: 'Eyes', emoji: '👀' },
      { id: 'nose', ar: 'الأنف', en: 'Nose', emoji: '👃' },
    ],
    correctId: 'ears',
  },
  {
    id: 'geography',
    emoji: '🗺️',
    title: { ar: 'الجغرافيا وعالمنا', en: 'World Geography' },
    fact: { ar: 'كوكب الأرض يضم قارات واسعة ومحيطات زرقاء وأنهاراً وجبالاً عالية!', en: 'Planet Earth has big continents, blue oceans, flowing rivers, and tall mountains!' },
    question: { ar: 'أيهما يغطي مساحة أكبر على كوكب الأرض؟', en: 'Which covers more of Earth’s surface?' },
    options: [
      { id: 'oceans', ar: 'البحار والمحيطات', en: 'Oceans & Seas', emoji: '🌊' },
      { id: 'deserts', ar: 'الصحاري فقط', en: 'Deserts Only', emoji: '🏜️' },
      { id: 'cities', ar: 'المدن فقط', en: 'Cities Only', emoji: '🏙️' },
    ],
    correctId: 'oceans',
  },
];

export const DiscoveryWorldPanel: React.FC = () => {
  const { activeChild, language, saveEntertainmentCreation } = useNonoLand();
  const [selectedId, setSelectedId] = useState(DISCOVERY_THEMES[0].id);
  const [statusMsg, setStatusMsg] = useState('');

  if (!activeChild) return null;

  const theme = DISCOVERY_THEMES.find((d) => d.id === selectedId) || DISCOVERY_THEMES[0];
  const completed = activeChild.completedDiscoveryThemes || [];

  const answerMiniCheck = async (optId: string) => {
    if (optId === theme.correctId) {
      const res = await saveEntertainmentCreation({
        kind: 'discovery',
        payload: { themeId: theme.id },
      });
      setStatusMsg(
        language === 'ar'
          ? `رائع! أتممت استكشاف "${theme.title.ar}" (+${res.starsAdded} نجوم) 🌍✨`
          : `Awesome! Explored "${theme.title.en}" (+${res.starsAdded} stars) 🌍✨`,
      );
    } else {
      soundEngine.playEncourage();
      setStatusMsg(
        language === 'ar' ? 'فكّر مرة أخرى في الحقيقة العلمية أعلاه!' : 'Re-read the science fact above and try again!',
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {DISCOVERY_THEMES.map((item) => {
          const done = completed.includes(item.id);
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.playPop();
                setSelectedId(item.id);
                setStatusMsg('');
              }}
              className={`p-3 rounded-2xl border-2 text-center space-y-1 cursor-pointer ${
                active ? 'bg-[#E5F6FF] border-[#39BDF2]' : 'bg-white border-[#27345C]/10'
              }`}
            >
              <div className="text-2xl">{item.emoji}</div>
              <p className="text-xs font-extrabold text-[#27345C] leading-snug">{item.title[language]}</p>
              {done && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] mx-auto" />}
            </button>
          );
        })}
      </div>

      <div className="nono-card p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Globe2 className="w-6 h-6 text-[#39BDF2]" />
            <span>
              {theme.emoji} {theme.title[language]}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => soundEngine.speak(theme.fact[language], language)}
            className="min-h-[40px] px-4 rounded-xl bg-[#F3ECFF] text-[#8054D9] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'استمع للمعلومة' : 'Hear Fact'}</span>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#FFD84D] text-sm font-bold text-[#27345C]">
          {theme.fact[language]}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-extrabold text-[#27345C]">{theme.question[language]}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {theme.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => void answerMiniCheck(opt.id)}
                className="min-h-[60px] p-3 rounded-2xl bg-[#F8FAFC] hover:bg-[#E5F6FF] border-2 border-[#27345C]/12 flex items-center justify-center gap-2 text-sm font-extrabold text-[#27345C] cursor-pointer"
              >
                <span className="text-2xl">{opt.emoji}</span>
                <span>{opt[language]}</span>
              </button>
            ))}
          </div>
        </div>

        {statusMsg && <p className="text-xs sm:text-sm font-extrabold text-[#16A34A]">{statusMsg}</p>}
      </div>
    </div>
  );
};
