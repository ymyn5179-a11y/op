import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import type { Language, QuranStoryActivitySpec } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';

interface Props {
  activity: QuranStoryActivitySpec;
  language: Language;
  alreadyCompleted: boolean;
  sfxMuted: boolean;
  onComplete: (interactionId: string) => void;
}

export const QuranStoryActivities: React.FC<Props> = ({
  activity,
  language,
  alreadyCompleted,
  sfxMuted,
  onComplete,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sequenceIds, setSequenceIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'retry'; text: string } | null>(
    alreadyCompleted
      ? { kind: 'success', text: activity.successMessage[language] }
      : null,
  );
  const [completed, setCompleted] = useState(alreadyCompleted);

  useEffect(() => {
    setSelectedIds([]);
    setSequenceIds([]);
    setCompleted(alreadyCompleted);
    setFeedback(
      alreadyCompleted
        ? { kind: 'success', text: activity.successMessage[language] }
        : null,
    );
  }, [activity.id, alreadyCompleted, activity.successMessage, language]);

  const markSuccess = () => {
    if (!sfxMuted) soundEngine.playSuccess();
    setCompleted(true);
    setFeedback({ kind: 'success', text: activity.successMessage[language] });
    onComplete(activity.id);
  };

  const triggerRetry = () => {
    if (!sfxMuted) soundEngine.playEncourage();
    setFeedback({ kind: 'retry', text: activity.retryMessage[language] });
  };

  return (
    <div className="rounded-2xl border border-[#10B981]/30 bg-[#ECFDF5]/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base font-extrabold text-[#064E3B]">
            {activity.title[language]}
          </p>
          <p className="text-xs font-bold text-[#065F46]/85 mt-0.5">
            {activity.instruction[language]}
          </p>
        </div>
        {completed && (
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#047857] shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{language === 'ar' ? 'تم!' : 'Done!'}</span>
          </span>
        )}
      </div>

      {/* TYPE 1: TAP TARGETS ON SCENE BOARD */}
      {activity.type === 'tap-targets' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activity.items.map((item) => {
              const isPicked = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={completed && isPicked}
                  onClick={() => {
                    if (completed) return;
                    if (!sfxMuted) soundEngine.playPop();
                    if (!item.isTarget) {
                      triggerRetry();
                      return;
                    }
                    if (isPicked) return;
                    const next = [...selectedIds, item.id];
                    setSelectedIds(next);
                    if (next.length >= activity.requiredCount) {
                      markSuccess();
                    } else {
                      setFeedback({
                        kind: 'success',
                        text:
                          language === 'ar'
                            ? `أحسنت! (${next.length} من ${activity.requiredCount})`
                            : `Nice tap! (${next.length} of ${activity.requiredCount})`,
                      });
                    }
                  }}
                  className={`nono-btn-tactile min-h-[68px] p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-transform ${
                    isPicked
                      ? 'bg-[#DCFCE7] border-[#10B981] text-[#065F46] scale-[0.98]'
                      : 'bg-white border-[#27345C]/15 text-[#27345C] hover:border-[#047857]'
                  }`}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="text-xs font-extrabold leading-tight">
                    {item.label[language]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs font-bold text-[#065F46]/75 tabular-nums">
            {language === 'ar'
              ? `التقدم: ${Math.min(selectedIds.length, activity.requiredCount)} / ${activity.requiredCount}`
              : `Progress: ${Math.min(selectedIds.length, activity.requiredCount)} / ${activity.requiredCount}`}
          </p>
        </div>
      )}

      {/* TYPE 2: PLACE PAIRS / ITEMS INTO DESTINATION */}
      {activity.type === 'place-pairs' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {activity.items.map((item) => {
              const isPlaced = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={completed}
                  onClick={() => {
                    if (completed || isPlaced) return;
                    if (!sfxMuted) soundEngine.playPop();
                    const next = [...selectedIds, item.id];
                    setSelectedIds(next);
                    if (next.length >= activity.items.length) {
                      markSuccess();
                    } else {
                      setFeedback({
                        kind: 'success',
                        text:
                          language === 'ar'
                            ? `رائع! تم الترتيب في ${activity.destinationLabel.ar}`
                            : `Nice! Placed into ${activity.destinationLabel.en}`,
                      });
                    }
                  }}
                  className={`nono-btn-tactile min-h-[72px] p-3 rounded-2xl border flex items-center gap-3 text-start cursor-pointer transition-all ${
                    isPlaced
                      ? 'bg-[#DCFCE7] border-[#10B981] text-[#065F46]'
                      : 'bg-white border-[#27345C]/15 text-[#27345C] hover:border-[#047857]'
                  }`}
                >
                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold">{item.label[language]}</p>
                    <p className="text-[11px] font-bold text-[#27345C]/65">
                      {isPlaced
                        ? language === 'ar'
                          ? 'في المكان الآمن ✓'
                          : 'Safely placed ✓'
                        : item.pairCountLabel[language]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="rounded-xl bg-white/80 border border-[#10B981]/25 px-3 py-2 flex items-center justify-between text-xs font-extrabold text-[#065F46]">
            <span>{activity.destinationLabel[language]}</span>
            <span className="tabular-nums">
              {selectedIds.length} / {activity.items.length}
            </span>
          </div>
        </div>
      )}

      {/* TYPE 3: PICTURE SEQUENCING (1 -> 2 -> 3) */}
      {activity.type === 'sequence-cards' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {activity.steps.map((step) => {
              const pickedOrder = sequenceIds.indexOf(step.id);
              const isPicked = pickedOrder >= 0;
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={completed}
                  onClick={() => {
                    if (completed || isPicked) return;
                    const expectedOrder = sequenceIds.length + 1;
                    if (step.order === expectedOrder) {
                      if (!sfxMuted) soundEngine.playPop();
                      const next = [...sequenceIds, step.id];
                      setSequenceIds(next);
                      if (next.length >= activity.steps.length) {
                        markSuccess();
                      } else {
                        setFeedback({
                          kind: 'success',
                          text:
                            language === 'ar'
                              ? `أحسنت! الخطوة ${expectedOrder} صحيحة، اختر التالية.`
                              : `Great! Step ${expectedOrder} is right — pick next.`,
                        });
                      }
                    } else {
                      triggerRetry();
                    }
                  }}
                  className={`nono-btn-tactile min-h-[76px] p-3 rounded-2xl border flex items-center gap-3 text-start cursor-pointer ${
                    isPicked
                      ? 'bg-[#DCFCE7] border-[#10B981] text-[#065F46]'
                      : 'bg-white border-[#27345C]/15 text-[#27345C] hover:border-[#047857]'
                  }`}
                >
                  <span className="text-2xl shrink-0" aria-hidden="true">
                    {step.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold">{step.label[language]}</p>
                    {isPicked && (
                      <p className="text-[11px] font-extrabold text-[#047857] tabular-nums">
                        #{pickedOrder + 1}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {!completed && sequenceIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSequenceIds([]);
                setFeedback(null);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold text-[#27345C] cursor-pointer"
            >
              {language === 'ar' ? 'إعادة الترتيب' : 'Reset Order'}
            </button>
          )}
        </div>
      )}

      {/* TYPE 4: KINDNESS / GOOD CHOICE MATCH */}
      {activity.type === 'match-kindness' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {activity.choices.map((choice) => {
            const isChosen = selectedIds.includes(choice.id);
            return (
              <button
                key={choice.id}
                type="button"
                disabled={completed}
                onClick={() => {
                  if (completed) return;
                  if (choice.isKindMatch) {
                    setSelectedIds([choice.id]);
                    markSuccess();
                  } else {
                    triggerRetry();
                  }
                }}
                className={`nono-btn-tactile min-h-[64px] p-3.5 rounded-2xl border flex items-center gap-3 text-start cursor-pointer ${
                  isChosen || (completed && choice.isKindMatch)
                    ? 'bg-[#DCFCE7] border-[#10B981] text-[#065F46]'
                    : 'bg-white border-[#27345C]/15 text-[#27345C] hover:border-[#047857]'
                }`}
              >
                <span className="text-2xl shrink-0" aria-hidden="true">
                  {choice.emoji}
                </span>
                <span className="text-xs sm:text-sm font-extrabold">{choice.label[language]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* GENTLE NON-PUNITIVE FEEDBACK */}
      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2 ${
            feedback.kind === 'success'
              ? 'bg-[#DCFCE7] text-[#166534] border border-[#10B981]/35'
              : 'bg-[#FFFBEB] text-[#92400E] border border-[#F59E0B]/35'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  );
};
