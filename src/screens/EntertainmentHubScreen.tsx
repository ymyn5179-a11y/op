import React, { useState } from 'react';
import { Blocks, ChefHat, Globe2, Music, Palette, Sparkles, Theater } from 'lucide-react';
import { BuildAndCreatePanel } from '../components/entertainment/BuildAndCreatePanel';
import { DiscoveryWorldPanel } from '../components/entertainment/DiscoveryWorldPanel';
import { LittleChefPanel } from '../components/entertainment/LittleChefPanel';
import { MusicWorldPanel } from '../components/entertainment/MusicWorldPanel';
import { NonoTheaterPanel } from '../components/entertainment/NonoTheaterPanel';
import { NonoLandLogo } from '../components/NonoLandLogo';
import { useNonoLand } from '../context/NonoLandContext';
import { CreativeStudioScreen } from './CreativeStudioScreen';
import { soundEngine } from '../utils/soundEngine';

type HubMode = 'music' | 'chef' | 'build' | 'art' | 'theater' | 'discovery';

export const EntertainmentHubScreen: React.FC = () => {
  const { language, navigate } = useNonoLand();
  const [mode, setMode] = useState<HubMode>('music');

  const MODES: Array<{ id: HubMode; ar: string; en: string; icon: React.ReactNode }> = [
    { id: 'music', ar: 'عالم الموسيقى', en: 'Music World', icon: <Music className="w-4 h-4" /> },
    { id: 'chef', ar: 'الشيف الصغير', en: 'Little Chef', icon: <ChefHat className="w-4 h-4" /> },
    { id: 'build', ar: 'ابنِ وأبدع', en: 'Build & Create', icon: <Blocks className="w-4 h-4" /> },
    { id: 'art', ar: 'استوديو الرسم', en: 'Art & Coloring', icon: <Palette className="w-4 h-4" /> },
    { id: 'theater', ar: 'مسرح نونو', en: 'Nono Theater', icon: <Theater className="w-4 h-4" /> },
    { id: 'discovery', ar: 'عالم الاكتشاف', en: 'Discovery World', icon: <Globe2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="nono-card p-5 sm:p-6 bg-gradient-to-r from-[#FFF8E9] via-[#FCE7F3] to-[#E5F6FF] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <NonoLandLogo variant="compact" size="md" showWordmark={false} language={language} />
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-[#FF78B7]" />
              <span>{language === 'ar' ? 'مركز الإبداع والترفيه التعليمي' : 'Creative & Entertainment Universe'}</span>
            </h1>
            <p className="text-xs sm:text-sm font-bold text-[#27345C]/75">
              {language === 'ar'
                ? '٦ عوالم تفاعلية حقيقية: موسيقى، طبخ صحي، بناء هندسي، رسم، مسرح، واكتشاف العلوم!'
                : '6 hands-on worlds: Music Composer, Little Chef, Build & Create, Art Studio, Nono Theater & Discovery World!'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('fun-zone')}
          className="min-h-[42px] px-4 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] cursor-pointer"
        >
          {language === 'ar' ? 'الألعاب الحركية واليوتيوب الآمن ←' : 'Mini-Games & Safe Videos →'}
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              soundEngine.stopAllAudio();
              soundEngine.playPop();
              setMode(m.id);
            }}
            className={`min-h-[44px] px-4 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer transition-all ${
              mode === m.id
                ? 'bg-[#8054D9] text-white border-[#8054D9] shadow-sm'
                : 'bg-white text-[#27345C] border-[#27345C]/12 hover:border-[#8054D9]/50'
            }`}
          >
            {m.icon}
            <span>{m[language]}</span>
          </button>
        ))}
      </div>

      {mode === 'music' && <MusicWorldPanel />}
      {mode === 'chef' && <LittleChefPanel />}
      {mode === 'build' && <BuildAndCreatePanel />}
      {mode === 'art' && <CreativeStudioScreen />}
      {mode === 'theater' && <NonoTheaterPanel />}
      {mode === 'discovery' && <DiscoveryWorldPanel />}
    </div>
  );
};
