import React, { useEffect, useState } from 'react';
import { Music, Play, Save, Sparkles, Square, Trash2, Volume2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { MusicNoteEvent } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

const NOTE_LABELS = ['Do 🔴', 'Re 🟠', 'Mi 🟡', 'Fa 🟢', 'Sol 🔵', 'La 🟣'];
const NOTE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6'];
const RHYTHM_PATTERN = [0, 2, 4, 2];

export const MusicWorldPanel: React.FC = () => {
  const { activeChild, language, saveEntertainmentCreation } = useNonoLand();
  const [instrument, setInstrument] = useState<'xylophone' | 'drum' | 'flute' | 'bell'>('xylophone');
  const [melody, setMelody] = useState<MusicNoteEvent[]>([]);
  const [melodyTitle, setMelodyTitle] = useState('');
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rhythmInputs, setRhythmInputs] = useState<number[]>([]);
  const [rhythmFeedback, setRhythmFeedback] = useState<string>('');
  const [quizTarget, setQuizTarget] = useState<'drum' | 'bell' | 'flute'>('drum');
  const [quizFeedback, setQuizFeedback] = useState<string>('');
  const [saveNotice, setSaveNotice] = useState<string>('');

  useEffect(() => {
    return () => {
      soundEngine.stopAllAudio();
    };
  }, []);

  if (!activeChild) return null;

  const tapKey = (noteIdx: number) => {
    soundEngine.playInstrument(instrument, noteIdx);
    setActiveNote(noteIdx);
    window.setTimeout(() => setActiveNote(null), 220);

    if (melody.length < 16) {
      setMelody((prev) => [...prev, { noteIdx, instrument, step: prev.length }]);
    }

    // Check rhythm match
    const nextRhythm = [...rhythmInputs, noteIdx].slice(-RHYTHM_PATTERN.length);
    setRhythmInputs(nextRhythm);
    if (
      nextRhythm.length === RHYTHM_PATTERN.length &&
      RHYTHM_PATTERN.every((expected, i) => nextRhythm[i] === expected)
    ) {
      soundEngine.playCelebration();
      setRhythmFeedback(
        language === 'ar' ? 'أحسنت! عزفت الإيقاع الصحيح تماماً 🎵' : 'Bravo! You matched the exact rhythm! 🎵',
      );
    }
  };

  const playComposedMelody = (notesToPlay: MusicNoteEvent[]) => {
    if (notesToPlay.length === 0) return;
    setIsPlaying(true);
    soundEngine.playMelodySequence(
      notesToPlay.map((n, idx) => ({
        noteIdx: n.noteIdx,
        instrument: n.instrument,
        delayMs: idx * 340,
      })),
      (stepIdx) => setActiveNote(notesToPlay[stepIdx]?.noteIdx ?? null),
      () => {
        setIsPlaying(false);
        setActiveNote(null);
      },
    );
  };

  const handleSaveMelody = async () => {
    if (melody.length < 3) return;
    const title = melodyTitle.trim() || (language === 'ar' ? `لحن نونو #${(activeChild.musicCompositions?.length || 0) + 1}` : `Nono Melody #${(activeChild.musicCompositions?.length || 0) + 1}`);
    const res = await saveEntertainmentCreation({
      kind: 'music',
      payload: { title, notes: melody },
    });
    setMelodyTitle('');
    setSaveNotice(
      language === 'ar'
        ? `تم حفظ لحنك الجميل (+${res.starsAdded} نجوم)! 🎶`
        : `Melody saved safely (+${res.starsAdded} stars)! 🎶`,
    );
  };

  const playMysterySound = () => {
    const options: Array<'drum' | 'bell' | 'flute'> = ['drum', 'bell', 'flute'];
    const chosen = options[Math.floor(Math.random() * options.length)];
    setQuizTarget(chosen);
    setQuizFeedback('');
    soundEngine.playInstrument(chosen, 2);
  };

  const guessSound = (guess: 'drum' | 'bell' | 'flute') => {
    if (guess === quizTarget) {
      soundEngine.playSuccess();
      setQuizFeedback(language === 'ar' ? 'إجابة صحيحة! أذن موسيقية ذكية 👂✨' : 'Correct! Sharp musical ears! 👂✨');
    } else {
      soundEngine.playEncourage();
      setQuizFeedback(language === 'ar' ? 'جرّب الاستماع مجدداً والمحاولة!' : 'Listen again and try another instrument!');
    }
  };

  return (
    <div className="space-y-5">
      {/* Instrument Picker + Keyboard Composer */}
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <Music className="w-6 h-6 text-[#8054D9]" />
              <span>{language === 'ar' ? 'عالم الموسيقى وتأليف الألحان' : 'Music World & Melody Composer'}</span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70">
              {language === 'ar' ? 'اختر الآلة، اعزف النغمات، وألّف لحنك الخاص!' : 'Pick an instrument, tap notes, and compose your own melody!'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'xylophone' as const, ar: 'إكسيلوفون', en: 'Xylophone', emoji: '🎹' },
              { id: 'drum' as const, ar: 'طبلة', en: 'Drum', emoji: '🥁' },
              { id: 'flute' as const, ar: 'ناي', en: 'Flute', emoji: '🪈' },
              { id: 'bell' as const, ar: 'أجراس', en: 'Bells', emoji: '🔔' },
            ].map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  soundEngine.playInstrument(inst.id, 3);
                  setInstrument(inst.id);
                }}
                className={`min-h-[42px] px-3.5 rounded-xl text-xs font-extrabold border-2 flex items-center gap-1.5 cursor-pointer ${
                  instrument === inst.id ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-[#FFF8E9]/60 text-[#27345C] border-[#27345C]/10'
                }`}
              >
                <span>{inst.emoji}</span>
                <span>{inst[language]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Musical Keys */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {NOTE_LABELS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => tapKey(idx)}
              style={{
                backgroundColor: activeNote === idx ? NOTE_COLORS[idx] : `${NOTE_COLORS[idx]}20`,
                borderColor: NOTE_COLORS[idx],
              }}
              className={`min-h-[82px] rounded-2xl border-2 font-extrabold text-sm flex flex-col items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95 ${
                activeNote === idx ? 'text-white scale-105' : 'text-[#27345C]'
              }`}
            >
              <span className="text-lg">🎵</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Recorded Notes + Save */}
        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#27345C]">
              {language === 'ar' ? `لحنك المسجّل (${melody.length} نغمات):` : `Your Composed Melody (${melody.length} notes):`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={melody.length === 0 || isPlaying}
                onClick={() => playComposedMelody(melody)}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#39BDF2] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'تشغيل' : 'Play'}</span>
              </button>
              {isPlaying && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.stopAllAudio();
                    setIsPlaying(false);
                    setActiveNote(null);
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-[#EF4444] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  <span>{language === 'ar' ? 'إيقاف' : 'Stop'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMelody([]);
                  setSaveNotice('');
                }}
                className="min-h-[38px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-extrabold text-[#27345C] flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'مسح' : 'Clear'}</span>
              </button>
            </div>
          </div>

          {melody.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {melody.map((n, idx) => (
                <span
                  key={idx}
                  style={{ backgroundColor: NOTE_COLORS[n.noteIdx] }}
                  className="px-2.5 py-1 rounded-lg text-white text-xs font-extrabold"
                >
                  {NOTE_LABELS[n.noteIdx].split(' ')[0]}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={melodyTitle}
              onChange={(e) => setMelodyTitle(e.target.value)}
              placeholder={language === 'ar' ? 'اسم مقطوعتك الموسيقية...' : 'Name your melody...'}
              className="flex-1 min-w-[180px] min-h-[42px] px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold"
            />
            <button
              type="button"
              disabled={melody.length < 3}
              onClick={() => void handleSaveMelody()}
              className="min-h-[42px] px-4 rounded-xl bg-[#55D98B] text-[#27345C] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'ar' ? 'حفظ المقطوعة (٣+ نغمات)' : 'Save Melody (3+ notes)'}</span>
            </button>
          </div>
          {saveNotice && <p className="text-xs font-extrabold text-[#15803D]">{saveNotice}</p>}
        </div>
      </div>

      {/* Rhythm Challenge + Sound Recognition Quiz */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="nono-card p-5 bg-white space-y-3">
          <h3 className="text-base font-extrabold text-[#27345C] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#FF9360]" />
            <span>{language === 'ar' ? 'تحدي الإيقاع المتتابع' : 'Rhythm Mirror Challenge'}</span>
          </h3>
          <p className="text-xs font-bold text-[#27345C]/75">
            {language === 'ar'
              ? 'اسمع النغمات الأربع ثم اعزفها بالترتيب: Do → Mi → Sol → Mi'
              : 'Hear the 4-note pattern, then replay it: Do → Mi → Sol → Mi'}
          </p>
          <button
            type="button"
            onClick={() =>
              soundEngine.playMelodySequence(
                RHYTHM_PATTERN.map((n, i) => ({ noteIdx: n, instrument: 'xylophone', delayMs: i * 420 })),
                (stepIdx) => setActiveNote(RHYTHM_PATTERN[stepIdx]),
                () => setActiveNote(null),
              )
            }
            className="min-h-[42px] px-4 rounded-xl bg-[#FFF8E9] border border-[#FFD84D] text-xs font-extrabold text-[#27345C] flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4 text-[#D97706]" />
            <span>{language === 'ar' ? 'اسمع الإيقاع المطلوب' : 'Hear Target Rhythm'}</span>
          </button>
          {rhythmFeedback && <p className="text-xs font-extrabold text-[#16A34A]">{rhythmFeedback}</p>}
        </div>

        <div className="nono-card p-5 bg-white space-y-3">
          <h3 className="text-base font-extrabold text-[#27345C]">
            {language === 'ar' ? 'لغز تمييز صوت الآلة' : 'Guess the Instrument Sound'}
          </h3>
          <button
            type="button"
            onClick={playMysterySound}
            className="min-h-[42px] px-4 rounded-xl bg-[#E5F6FF] text-[#0369A1] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'شغّل صوتاً سرياً' : 'Play Mystery Sound'}</span>
          </button>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'drum' as const, label: { ar: 'طبلة 🥁', en: 'Drum 🥁' } },
              { id: 'bell' as const, label: { ar: 'أجراس 🔔', en: 'Bell 🔔' } },
              { id: 'flute' as const, label: { ar: 'ناي 🪈', en: 'Flute 🪈' } },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => guessSound(opt.id)}
                className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 hover:bg-[#F3ECFF] text-xs font-extrabold text-[#27345C] cursor-pointer"
              >
                {opt.label[language]}
              </button>
            ))}
          </div>
          {quizFeedback && <p className="text-xs font-extrabold text-[#8054D9]">{quizFeedback}</p>}
        </div>
      </div>

      {/* Saved Child Compositions */}
      {(activeChild.musicCompositions?.length || 0) > 0 && (
        <div className="nono-card p-5 bg-white space-y-3">
          <h3 className="text-base font-extrabold text-[#27345C]">
            {language === 'ar' ? 'ألحاني المحفوظة' : 'My Saved Melodies'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeChild.musicCompositions!.map((comp) => (
              <div key={comp.id} className="p-3 rounded-2xl bg-[#FFF8E9]/70 border border-[#27345C]/10 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-[#27345C]">{comp.title}</p>
                  <p className="text-[11px] font-bold text-[#27345C]/65">
                    {comp.notes.length} {language === 'ar' ? 'نغمات' : 'notes'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => playComposedMelody(comp.notes)}
                  className="min-h-[36px] px-3 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>{language === 'ar' ? 'اسمع' : 'Play'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
