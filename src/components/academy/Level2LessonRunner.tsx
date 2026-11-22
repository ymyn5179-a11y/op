import React from 'react';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { Level2LessonDefinition } from '../../types/nonoland';

interface Level2LessonRunnerProps {
  lesson: Level2LessonDefinition;
  onExit: () => void;
  onSelectNextLesson?: (lesson: Level2LessonDefinition) => void;
  nextLesson?: Level2LessonDefinition;
}

export const Level2LessonRunner: React.FC<Level2LessonRunnerProps> = ({
  onExit,
}) => {
  const { language } = useNonoLand();
  const ArrowBack = language === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="max-w-xl mx-auto my-8 nono-card rounded-3xl p-8 bg-white text-center space-y-4">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFF8E9] border border-[#27345C]/15 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-[#8054D9]" />
      </div>
      <h2 className="text-xl font-extrabold text-[#27345C]">
        {language === 'ar'
          ? 'المحتوى مخصص لمرحلة التأسيس (١–٤ سنوات) فقط'
          : 'Ages 1–4 Foundations Curriculum Only'}
      </h2>
      <p className="text-sm font-bold text-[#27345C]/75">
        {language === 'ar'
          ? 'تم إيقاف مسار المستوى الثاني في نونو لاند للتركيز الكامل على دروس التأسيس التفاعلية للأعمار من ١ إلى ٤ سنوات.'
          : 'Level 2 content is disabled in NonoLand. All learning experiences are focused exclusively on Foundations (Ages 1–4).'}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="nono-btn-tactile inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#8054D9] text-white font-extrabold text-sm cursor-pointer"
      >
        <ArrowBack className="w-4 h-4" />
        <span>
          {language === 'ar' ? 'العودة إلى مرحلة التأسيس (١–٤ سنوات)' : 'Back to Foundations (Ages 1–4)'}
        </span>
      </button>
    </div>
  );
};
