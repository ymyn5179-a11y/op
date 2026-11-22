import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eraser,
  HelpCircle,
  Music,
  RotateCcw,
  Save,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { NonoCharacter } from '../NonoCharacter';
import { t, UI_COPY } from '../../i18n/translations';
import { GameActivity, Language, NonoMood } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

interface GameEngineRouterProps {
  activity: GameActivity;
  language: Language;
  scarfColor: string;
  onComplete: (result: { score: number; maxScore: number; durationSeconds: number }) => void;
  onSaveDrawing?: (dataUrl: string, title: string) => void;
}

export const GameEngineRouter: React.FC<GameEngineRouterProps> = ({
  activity,
  language,
  scarfColor,
  onComplete,
  onSaveDrawing,
}) => {
  const startTimeRef = useRef<number>(Date.now());
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [nonoMood, setNonoMood] = useState<NonoMood>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const questions = activity.questions;
  const currentQ = questions[qIndex];

  useEffect(() => {
    startTimeRef.current = Date.now();
    setQIndex(0);
    setScore(0);
    setShowHint(false);
    setNonoMood('waving');
    setFeedbackMsg('');
    if (activity.instructions) {
      soundEngine.speak(t(activity.instructions, language), language);
    }
  }, [activity.id]);

  const finishActivity = (finalScore: number, maxScore: number) => {
    const durationSeconds = Math.max(12, Math.round((Date.now() - startTimeRef.current) / 1000));
    onComplete({ score: finalScore, maxScore, durationSeconds });
  };

  const advanceOrFinish = (nextScore: number, totalSteps: number) => {
    setTimeout(() => {
      setShowHint(false);
      setFeedbackMsg('');
      setNonoMood('idle');
      if (qIndex + 1 < questions.length) {
        setQIndex((prev) => prev + 1);
      } else {
        finishActivity(nextScore, totalSteps);
      }
    }, 850);
  };

  // ============================================
  // MECHANIC 1: VISUAL TAP / MULTIPLE CHOICE
  // ============================================
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  useEffect(() => {
    setWrongIds([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'visual-tap' && currentQ) {
    const handleOptionTap = (optId: string, isCorrect?: boolean) => {
      if (isCorrect) {
        soundEngine.playSuccess();
        setNonoMood('celebrating');
        setFeedbackMsg(t(UI_COPY.games.greatJob, language));
        const nextScore = score + (wrongIds.length === 0 ? 1 : 0.5);
        setScore(nextScore);
        advanceOrFinish(Math.ceil(nextScore), questions.length);
      } else {
        soundEngine.playEncourage();
        setNonoMood('encouraging');
        setShowHint(true);
        setWrongIds((prev) => [...prev, optId]);
        setFeedbackMsg(t(UI_COPY.games.tryAgain, language));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFF8E9] rounded-3xl p-5 border-2 border-[#27345C]/10">
          <div className="space-y-2 text-center sm:text-start">
            <div className="text-xs font-extrabold text-[#8054D9] tabular-nums">
              {language === 'ar'
                ? `التحدي ${qIndex + 1} من ${questions.length}`
                : `Step ${qIndex + 1} of ${questions.length}`}
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#27345C]">
              {t(currentQ.prompt, language)}
            </h3>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => soundEngine.speak(t(currentQ.prompt, language), language)}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#8054D9]" />
                <span>{t(UI_COPY.games.hearPrompt, language)}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="px-3 py-1.5 rounded-xl bg-[#FFD84D]/35 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-[#27345C]" />
                <span>{t(UI_COPY.games.hintBtn, language)}</span>
              </button>
            </div>
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        {currentQ.visualCue && (
          <div className="text-center text-4xl sm:text-5xl py-3 tracking-widest bg-white/80 rounded-2xl border border-[#27345C]/10">
            {currentQ.visualCue}
          </div>
        )}

        {(showHint || feedbackMsg) && (
          <div className="p-3.5 rounded-2xl bg-[#FFD84D]/25 border border-[#FFD84D] text-center font-bold text-sm text-[#27345C]">
            {feedbackMsg || t(currentQ.hint, language)}
            {showHint && feedbackMsg && <span className="block text-xs mt-1">{t(currentQ.hint, language)}</span>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {currentQ.options?.map((opt) => {
            const triedWrong = wrongIds.includes(opt.id);
            return (
              <motion.button
                key={opt.id}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleOptionTap(opt.id, opt.isCorrect)}
                disabled={triedWrong}
                className={`nono-btn-tactile rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[150px] border-2 cursor-pointer transition-opacity ${
                  triedWrong
                    ? 'opacity-45 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-[#27345C]/12 hover:border-[#8054D9]'
                }`}
              >
                {opt.isColorSwatch ? (
                  <div
                    className="w-20 h-20 rounded-full border-4 border-white shadow-md"
                    style={{ backgroundColor: opt.visual }}
                  />
                ) : (
                  <span className="text-5xl font-extrabold text-[#27345C]">{opt.visual}</span>
                )}
                <span className="text-lg font-extrabold text-[#27345C]">{t(opt.label, language)}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 2: INTERACTIVE TAP-TO-COUNT (MATH LAB)
  // ============================================
  const [tappedCountIndices, setTappedCountIndices] = useState<number[]>([]);
  useEffect(() => {
    setTappedCountIndices([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'math-lab' && currentQ) {
    const target = currentQ.targetCount || 3;
    const emoji = currentQ.countEmoji || '🍎';

    const handleCountTap = (idx: number) => {
      if (tappedCountIndices.includes(idx)) return;
      soundEngine.playPop();
      const next = [...tappedCountIndices, idx];
      setTappedCountIndices(next);
      soundEngine.speak(String(next.length), language);
      if (next.length === target) {
        soundEngine.playSuccess();
        setNonoMood('celebrating');
        setFeedbackMsg(t(UI_COPY.games.greatJob, language));
        const nextScore = score + 1;
        setScore(nextScore);
        advanceOrFinish(nextScore, questions.length);
      }
    };

    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFF8E9] rounded-3xl p-5 border-2 border-[#27345C]/10">
          <div className="text-start">
            <h3 className="text-2xl font-extrabold text-[#27345C]">{t(currentQ.prompt, language)}</h3>
            <p className="text-sm font-bold text-[#8054D9] mt-1 tabular-nums">
              {language === 'ar'
                ? `العدد حتى الآن: ${tappedCountIndices.length} / ${target}`
                : `Counted: ${tappedCountIndices.length} / ${target}`}
            </p>
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 py-6">
          {Array.from({ length: target }).map((_, idx) => {
            const tapOrder = tappedCountIndices.indexOf(idx);
            const isTapped = tapOrder !== -1;
            return (
              <motion.button
                key={idx}
                type="button"
                whileTap={{ scale: 0.9 }}
                animate={isTapped ? { scale: [1, 1.15, 1.05] } : undefined}
                onClick={() => handleCountTap(idx)}
                className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 flex items-center justify-center text-5xl cursor-pointer transition-colors ${
                  isTapped
                    ? 'bg-[#FFD84D]/40 border-[#FFD84D] shadow-lg'
                    : 'bg-white border-[#27345C]/15 hover:border-[#8054D9]'
                }`}
              >
                <span>{emoji}</span>
                {isTapped && (
                  <span className="absolute -top-3 -end-3 w-8 h-8 rounded-full bg-[#8054D9] text-white font-extrabold text-base flex items-center justify-center shadow">
                    {tapOrder + 1}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 3: MEMORY MATCH CARDS
  // ============================================
  const pairs = currentQ?.pairs || [];
  const shuffledCards = useMemo(() => {
    const raw: Array<{ uid: string; pairId: string; face: string }> = [];
    pairs.forEach((p, i) => {
      raw.push({ uid: `${p.id}-L-${i}`, pairId: p.id, face: p.left });
      raw.push({ uid: `${p.id}-R-${i}`, pairId: p.id, face: p.right });
    });
    return raw.sort((a, b) => a.uid.localeCompare(b.uid) * -1 + (a.face.charCodeAt(0) % 3) - 1);
  }, [qIndex, activity.id]);

  const [flippedUids, setFlippedUids] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);

  useEffect(() => {
    setFlippedUids([]);
    setMatchedPairIds([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'memory-match' && currentQ) {
    const handleCardClick = (uid: string, pairId: string) => {
      if (flippedUids.includes(uid) || matchedPairIds.includes(pairId) || flippedUids.length >= 2) {
        return;
      }
      soundEngine.playPop();
      const nextFlipped = [...flippedUids, uid];
      setFlippedUids(nextFlipped);

      if (nextFlipped.length === 2) {
        const cardA = shuffledCards.find((c) => c.uid === nextFlipped[0]);
        const cardB = shuffledCards.find((c) => c.uid === nextFlipped[1]);
        if (cardA && cardB && cardA.pairId === cardB.pairId) {
          soundEngine.playSuccess();
          setNonoMood('excited');
          const nextMatched = [...matchedPairIds, cardA.pairId];
          setMatchedPairIds(nextMatched);
          setFlippedUids([]);
          if (nextMatched.length === pairs.length) {
            finishActivity(pairs.length, pairs.length);
          }
        } else {
          setNonoMood('thinking');
          setTimeout(() => setFlippedUids([]), 750);
        }
      }
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between bg-[#FFF8E9] rounded-3xl p-4 border-2 border-[#27345C]/10">
          <div>
            <h3 className="text-xl font-extrabold text-[#27345C]">{t(currentQ.prompt, language)}</h3>
            <p className="text-xs font-bold text-[#8054D9] mt-1 tabular-nums">
              {language === 'ar'
                ? `تمت مطابقة ${matchedPairIds.length} من ${pairs.length}`
                : `Matched ${matchedPairIds.length} of ${pairs.length}`}
            </p>
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {shuffledCards.map((card) => {
            const isOpen = flippedUids.includes(card.uid) || matchedPairIds.includes(card.pairId);
            const isMatched = matchedPairIds.includes(card.pairId);
            return (
              <motion.button
                key={card.uid}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCardClick(card.uid, card.pairId)}
                className={`h-24 sm:h-28 rounded-2xl border-2 text-3xl sm:text-4xl font-extrabold flex items-center justify-center cursor-pointer transition-all ${
                  isMatched
                    ? 'bg-[#55D98B]/25 border-[#55D98B]'
                    : isOpen
                      ? 'bg-white border-[#8054D9] shadow-md'
                      : 'bg-gradient-to-br from-[#8054D9] to-[#39BDF2] text-white border-white shadow'
                }`}
              >
                {isOpen ? card.face : '⭐'}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 4: SEQUENCE BUILDER (Words, Numbers, Life Cycles)
  // ============================================
  const [chosenSeq, setChosenSeq] = useState<string[]>([]);
  useEffect(() => {
    setChosenSeq([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'sequence-builder' && currentQ) {
    const items = currentQ.sequenceItems || [];
    const answer = currentQ.sequenceAnswer || [];

    const handlePickItem = (item: string) => {
      if (chosenSeq.includes(item)) return;
      soundEngine.playPop();
      const next = [...chosenSeq, item];
      setChosenSeq(next);

      if (next.length === answer.length) {
        const isAllCorrect = next.every((val, i) => val === answer[i]);
        if (isAllCorrect) {
          soundEngine.playSuccess();
          setNonoMood('celebrating');
          setFeedbackMsg(t(UI_COPY.games.greatJob, language));
          const nextScore = score + 1;
          setScore(nextScore);
          advanceOrFinish(nextScore, questions.length);
        } else {
          soundEngine.playEncourage();
          setNonoMood('encouraging');
          setShowHint(true);
          setFeedbackMsg(t(UI_COPY.games.tryAgain, language));
          setTimeout(() => setChosenSeq([]), 800);
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-[#FFF8E9] rounded-3xl p-5 border-2 border-[#27345C]/10">
          <div>
            <h3 className="text-xl font-extrabold text-[#27345C]">{t(currentQ.prompt, language)}</h3>
            {showHint && (
              <p className="text-sm font-bold text-[#8054D9] mt-1">{t(currentQ.hint, language)}</p>
            )}
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        {/* Answer Slots */}
        <div className="flex flex-wrap items-center justify-center gap-3 min-h-[76px] p-4 rounded-2xl bg-white border-2 border-dashed border-[#8054D9]/35">
          {answer.map((_, idx) => (
            <div
              key={idx}
              className="min-w-[64px] px-4 h-14 rounded-2xl bg-[#FFF8E9] border-2 border-[#27345C]/15 flex items-center justify-center text-xl font-extrabold text-[#27345C]"
            >
              {chosenSeq[idx] || '?'}
            </div>
          ))}
        </div>

        {feedbackMsg && (
          <p className="text-center font-extrabold text-[#8054D9]">{feedbackMsg}</p>
        )}

        {/* Clickable Tiles */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {items.map((item) => {
            const used = chosenSeq.includes(item);
            return (
              <button
                key={item}
                type="button"
                disabled={used}
                onClick={() => handlePickItem(item)}
                className={`nono-btn-tactile min-w-[74px] px-5 h-16 rounded-2xl text-xl font-extrabold border-2 cursor-pointer transition-opacity ${
                  used
                    ? 'opacity-30 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-[#8054D9]/30 hover:border-[#8054D9]'
                }`}
              >
                {item}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setChosenSeq([])}
            className="px-4 h-12 rounded-xl bg-[#27345C]/10 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{language === 'ar' ? 'إعادة' : 'Reset'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 5: SORT & CLASSIFY INTO BUCKETS
  // ============================================
  const [selectedSortId, setSelectedSortId] = useState<string | null>(null);
  const [sortedIds, setSortedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSortId(null);
    setSortedIds([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'sort-classify' && currentQ) {
    const items = currentQ.sortItems || [];
    const buckets = currentQ.sortBuckets || [];
    const remaining = items.filter((i) => !sortedIds.includes(i.id));

    const handleBucketTap = (bucketId: string) => {
      const activeItem =
        items.find((i) => i.id === selectedSortId) || remaining[0];
      if (!activeItem) return;

      if (activeItem.bucketId === bucketId) {
        soundEngine.playSuccess();
        setNonoMood('excited');
        const nextSorted = [...sortedIds, activeItem.id];
        setSortedIds(nextSorted);
        setSelectedSortId(null);
        setFeedbackMsg(t(UI_COPY.games.greatJob, language));
        if (nextSorted.length === items.length) {
          finishActivity(items.length, items.length);
        }
      } else {
        soundEngine.playEncourage();
        setNonoMood('encouraging');
        setShowHint(true);
        setFeedbackMsg(t(UI_COPY.games.tryAgain, language));
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-[#FFF8E9] rounded-3xl p-5 border-2 border-[#27345C]/10">
          <div>
            <h3 className="text-xl font-extrabold text-[#27345C]">{t(currentQ.prompt, language)}</h3>
            <p className="text-xs font-bold text-[#27345C]/70 mt-1">
              {language === 'ar'
                ? 'اضغط على العنصر ثم اضغط على السلة المناسبة له'
                : 'Tap an item, then tap the matching basket'}
            </p>
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        {/* Remaining Items */}
        <div className="flex flex-wrap justify-center gap-3">
          {remaining.map((item, idx) => {
            const isSelected = selectedSortId === item.id || (!selectedSortId && idx === 0);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playPop();
                  setSelectedSortId(item.id);
                }}
                className={`px-5 py-3 rounded-2xl border-2 flex items-center gap-2 font-bold cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#FFD84D]/40 border-[#8054D9] scale-105 shadow'
                    : 'bg-white border-[#27345C]/12'
                }`}
              >
                <span className="text-3xl">{item.visual}</span>
                <span>{t(item.label, language)}</span>
              </button>
            );
          })}
        </div>

        {showHint && (
          <p className="text-center text-sm font-bold text-[#8054D9]">{t(currentQ.hint, language)}</p>
        )}

        {/* Target Buckets */}
        <div className={`grid grid-cols-1 sm:grid-cols-${buckets.length} gap-4`}>
          {buckets.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBucketTap(b.id)}
              className="nono-btn-tactile rounded-3xl p-6 bg-white border-2 border-[#8054D9]/30 hover:border-[#8054D9] flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <span className="text-4xl">{b.emoji}</span>
              <span className="text-lg font-extrabold text-[#27345C]">{t(b.label, language)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 6: MAZE EXPLORER
  // ============================================
  const mazeGrid = currentQ?.mazeGrid || [
    [2, 0, 1],
    [1, 0, 0],
    [0, 1, 3],
  ];
  const [pos, setPos] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  useEffect(() => {
    setPos({ r: 0, c: 0 });
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'maze-explorer' && currentQ) {
    const move = (dr: number, dc: number) => {
      const nr = pos.r + dr;
      const nc = pos.c + dc;
      if (nr < 0 || nr >= mazeGrid.length || nc < 0 || nc >= mazeGrid[0].length) return;
      if (mazeGrid[nr][nc] === 1) {
        soundEngine.playEncourage();
        setNonoMood('thinking');
        return;
      }
      soundEngine.playPop();
      setPos({ r: nr, c: nc });
      if (mazeGrid[nr][nc] === 3) {
        soundEngine.playSuccess();
        setNonoMood('celebrating');
        finishActivity(1, 1);
      }
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between bg-[#FFF8E9] rounded-3xl p-4 border-2 border-[#27345C]/10">
          <h3 className="text-lg sm:text-xl font-extrabold text-[#27345C]">
            {t(currentQ.prompt, language)}
          </h3>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="grid gap-1.5 bg-[#27345C]/10 p-3 rounded-3xl">
            {mazeGrid.map((row, r) => (
              <div key={r} className="flex gap-1.5">
                {row.map((cell, c) => {
                  const isNono = pos.r === r && pos.c === c;
                  const isWall = cell === 1;
                  const isGoal = cell === 3;
                  return (
                    <div
                      key={c}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-2xl font-bold ${
                        isWall
                          ? 'bg-[#27345C] text-white'
                          : isGoal
                            ? 'bg-[#FFD84D]/50 border-2 border-[#FFD84D]'
                            : 'bg-[#FFF8E9]'
                      }`}
                    >
                      {isNono ? '🦊' : isGoal ? '⭐' : isWall ? '🪨' : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 w-44" dir="ltr">
            <div />
            <button
              type="button"
              onClick={() => move(-1, 0)}
              aria-label="Up"
              className="nono-btn-tactile h-14 rounded-2xl bg-[#8054D9] text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowUp className="w-6 h-6" />
            </button>
            <div />
            <button
              type="button"
              onClick={() => move(0, -1)}
              aria-label="Left"
              className="nono-btn-tactile h-14 rounded-2xl bg-[#39BDF2] text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => move(1, 0)}
              aria-label="Down"
              className="nono-btn-tactile h-14 rounded-2xl bg-[#8054D9] text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowDown className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => move(0, 1)}
              aria-label="Right"
              className="nono-btn-tactile h-14 rounded-2xl bg-[#39BDF2] text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // MECHANIC 7: MUSIC & RHYTHM MEMORY
  // ============================================
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [playedNotes, setPlayedNotes] = useState<number[]>([]);
  useEffect(() => {
    setPlayedNotes([]);
  }, [qIndex, activity.id]);

  if (activity.mechanic === 'music-rhythm' && currentQ) {
    const seq = currentQ.musicSequence || [0, 2, 4];
    const keys = [
      { idx: 0, color: '#FF78B7', label: 'Do' },
      { idx: 1, color: '#FF9360', label: 'Re' },
      { idx: 2, color: '#FFD84D', label: 'Mi' },
      { idx: 3, color: '#55D98B', label: 'Sol' },
      { idx: 4, color: '#39BDF2', label: 'La' },
    ];

    const playTargetSequence = () => {
      setPlayedNotes([]);
      seq.forEach((noteIdx, i) => {
        setTimeout(() => {
          setActiveKey(noteIdx);
          soundEngine.playMusicNote(noteIdx);
          setTimeout(() => setActiveKey(null), 320);
        }, i * 520);
      });
    };

    const handleKeyTap = (idx: number) => {
      soundEngine.playMusicNote(idx);
      setActiveKey(idx);
      setTimeout(() => setActiveKey(null), 220);

      const next = [...playedNotes, idx];
      setPlayedNotes(next);
      const stepIdx = next.length - 1;
      if (seq[stepIdx] !== idx) {
        soundEngine.playEncourage();
        setNonoMood('encouraging');
        setFeedbackMsg(t(UI_COPY.games.tryAgain, language));
        setPlayedNotes([]);
        return;
      }

      if (next.length === seq.length) {
        soundEngine.playSuccess();
        setNonoMood('dancing');
        const nextScore = score + 1;
        setScore(nextScore);
        advanceOrFinish(nextScore, questions.length);
      }
    };

    return (
      <div className="space-y-6 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FFF8E9] rounded-3xl p-5 border-2 border-[#27345C]/10">
          <div className="text-start">
            <h3 className="text-xl font-extrabold text-[#27345C]">{t(currentQ.prompt, language)}</h3>
            <button
              type="button"
              onClick={playTargetSequence}
              className="mt-2 nono-btn-tactile px-4 py-2 rounded-xl bg-[#8054D9] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Music className="w-4 h-4" />
              <span>{language === 'ar' ? 'اسمع اللحن من نونو' : 'Play Melody'}</span>
            </button>
          </div>
          <NonoCharacter mood={nonoMood} scarfColor={scarfColor} size="sm" language={language} />
        </div>

        <div className="flex items-end justify-center gap-3 py-4" dir="ltr">
          {keys.map((k) => (
            <motion.button
              key={k.idx}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => handleKeyTap(k.idx)}
              style={{
                backgroundColor: k.color,
                height: `${180 - k.idx * 14}px`,
              }}
              className={`w-14 sm:w-20 rounded-2xl border-4 flex flex-col items-center justify-end pb-4 text-[#27345C] font-extrabold shadow-lg cursor-pointer transition-transform ${
                activeKey === k.idx ? 'scale-105 border-[#27345C] brightness-110' : 'border-white'
              }`}
            >
              <span>{k.label}</span>
            </motion.button>
          ))}
        </div>
        <p className="text-xs font-bold text-[#27345C]/70 tabular-nums">
          {playedNotes.length} / {seq.length}
        </p>
      </div>
    );
  }

  // ============================================
  // MECHANIC 8: DRAWING & COLORING STUDIO
  // ============================================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#8054D9');
  const [brushSize, setBrushSize] = useState(8);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (activity.mechanic === 'drawing-studio' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [activity.id, activity.mechanic]);

  if (activity.mechanic === 'drawing-studio') {
    const palette = ['#8054D9', '#39BDF2', '#FFD84D', '#FF78B7', '#55D98B', '#FF9360', '#27345C'];
    const stamps = ['⭐', '🌸', '🦋', '🚀', '🌈'];

    const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setDrawing(true);
    };

    const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDraw = () => setDrawing(false);

    const clearCanvas = () => {
      soundEngine.playPop();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    const addStamp = (emoji: string) => {
      soundEngine.playPop();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.font = '42px sans-serif';
      const x = 60 + Math.random() * (canvas.width - 120);
      const y = 70 + Math.random() * (canvas.height - 120);
      ctx.fillText(emoji, x, y);
    };

    const handleSave = () => {
      if (!canvasRef.current) return;
      const url = canvasRef.current.toDataURL('image/png');
      onSaveDrawing?.(url, t(activity.title, language));
      setSavedToast(true);
      setTimeout(() => {
        finishActivity(1, 1);
      }, 700);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFF8E9] rounded-2xl p-4 border border-[#27345C]/10">
          <p className="font-bold text-sm sm:text-base text-[#27345C]">
            {activity.drawingPrompt ? t(activity.drawingPrompt, language) : t(activity.instructions, language)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="px-3 py-2 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              <span>{language === 'ar' ? 'مسح' : 'Clear'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="nono-btn-tactile px-4 py-2 rounded-xl bg-[#55D98B] text-[#27345C] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'ar' ? 'احفظ في غرفتي' : 'Save to My Room'}</span>
            </button>
          </div>
        </div>

        {/* Palette & Stamps */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBrushColor(c)}
                aria-label={c}
                style={{ backgroundColor: c }}
                className={`w-9 h-9 rounded-full border-4 cursor-pointer ${
                  brushColor === c ? 'border-[#27345C] scale-110' : 'border-white shadow'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {[4, 10, 18].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setBrushSize(sz)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                  brushSize === sz ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                }`}
              >
                {sz}px
              </button>
            ))}
            {stamps.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addStamp(s)}
                className="w-9 h-9 rounded-xl bg-white border border-[#27345C]/15 text-lg hover:scale-110 transition-transform cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={760}
          height={380}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={stopDraw}
          onPointerLeave={stopDraw}
          className="w-full h-[300px] sm:h-[360px] bg-white rounded-3xl border-4 border-[#27345C]/12 shadow-inner touch-none cursor-crosshair"
        />

        {savedToast && (
          <div className="p-3 rounded-2xl bg-[#55D98B]/25 text-center font-bold text-[#27345C] flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>{language === 'ar' ? 'تم حفظ لوحتك الرائعة في غرفتك!' : 'Saved your masterpiece to My Room!'}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
};
