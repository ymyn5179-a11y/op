import { Level2LessonDefinition, Level2Subject, LocalizedText } from '../types/nonoland';
import { ALL_LEVEL1_LESSONS } from './level1Curriculum';
import { LEVEL2_ARABIC_LESSONS } from './level2/arabicLevel2';
import { LEVEL2_COLORS_SHAPES_LESSONS } from './level2/colorsShapesLevel2';
import { LEVEL2_ENGLISH_LESSONS } from './level2/englishLevel2';
import { LEVEL2_LOGIC_LESSONS } from './level2/logicLevel2';
import { LEVEL2_MATH_LESSONS } from './level2/mathLevel2';
import { LEVEL2_WORLD_AROUND_ME_LESSONS } from './level2/worldAroundMeLevel2';

export {
  LEVEL2_ARABIC_LESSONS,
  LEVEL2_COLORS_SHAPES_LESSONS,
  LEVEL2_ENGLISH_LESSONS,
  LEVEL2_LOGIC_LESSONS,
  LEVEL2_MATH_LESSONS,
  LEVEL2_WORLD_AROUND_ME_LESSONS,
};

export interface Level2SubjectMeta {
  id: Level2Subject;
  title: LocalizedText;
  subtitle: LocalizedText;
  emoji: string;
  accentHex: string;
  lessonCount: number;
}

export const LEVEL2_SUBJECT_META: Level2SubjectMeta[] = [
  {
    id: 'arabic',
    title: { ar: 'اللغة العربية', en: 'Arabic' },
    subtitle: { ar: 'مواضع الحرف، التشكيل، المدود وقراءة جمل قصيرة', en: 'Positions, Harakat, Madd & Short Sentences' },
    emoji: '📖',
    accentHex: '#8054D9',
    lessonCount: LEVEL2_ARABIC_LESSONS.length,
  },
  {
    id: 'english',
    title: { ar: 'اللغة الإنجليزية', en: 'English' },
    subtitle: { ar: 'الأصوات المركبة، كلمات CVC، المفردات والجمل البسيطة', en: 'Phonics Blends, CVC Words, Vocabulary & Sentences' },
    emoji: '🔤',
    accentHex: '#39BDF2',
    lessonCount: LEVEL2_ENGLISH_LESSONS.length,
  },
  {
    id: 'math',
    title: { ar: 'الرياضيات', en: 'Mathematics' },
    subtitle: { ar: 'الأعداد ١١–٥٠، المقارنة، الجمع والطرح، الوقت والنقود', en: 'Numbers 11–50, Comparing, Add/Subtract, Time & Coins' },
    emoji: '🧮',
    accentHex: '#FF9360',
    lessonCount: LEVEL2_MATH_LESSONS.length,
  },
  {
    id: 'colors-shapes',
    title: { ar: 'الألوان والأشكال', en: 'Colors & Shapes' },
    subtitle: { ar: 'مزج الألوان، الدرجات، الأشكال الهندسية والأنماط المركبة', en: 'Color Mixing, Shades, 2D Shapes & Complex Patterns' },
    emoji: '🎨',
    accentHex: '#E04F9E',
    lessonCount: LEVEL2_COLORS_SHAPES_LESSONS.length,
  },
  {
    id: 'logic',
    title: { ar: 'المنطق والتفكير', en: 'Logic & Thinking' },
    subtitle: { ar: 'المختلف، التسلسل، السبب والنتيجة، المتاهات والذاكرة', en: 'Odd One Out, Sequences, Cause & Effect, Mazes' },
    emoji: '🧩',
    accentHex: '#55D98B',
    lessonCount: LEVEL2_LOGIC_LESSONS.length,
  },
  {
    id: 'world-around-me',
    title: { ar: 'العالم من حولي', en: 'World Around Me' },
    subtitle: { ar: 'الحيوانات، النبات، الصحة، المهن، المواصلات، الفصول والبيئة', en: 'Animals, Plants, Health, Helpers, Transport & Seasons' },
    emoji: '🌍',
    accentHex: '#F59E0B',
    lessonCount: LEVEL2_WORLD_AROUND_ME_LESSONS.length,
  },
];

export const ALL_LEVEL2_LESSONS: Level2LessonDefinition[] = [
  ...LEVEL2_ARABIC_LESSONS,
  ...LEVEL2_ENGLISH_LESSONS,
  ...LEVEL2_MATH_LESSONS,
  ...LEVEL2_COLORS_SHAPES_LESSONS,
  ...LEVEL2_LOGIC_LESSONS,
  ...LEVEL2_WORLD_AROUND_ME_LESSONS,
];

export function getLevel2LessonById(lessonId: string): Level2LessonDefinition | undefined {
  return ALL_LEVEL2_LESSONS.find((l) => l.id === lessonId);
}

export function getLevel2LessonsBySubject(subject: Level2Subject): Level2LessonDefinition[] {
  return ALL_LEVEL2_LESSONS.filter((l) => l.subject === subject);
}

export interface CurriculumLessonRef {
  id: string;
  level: 1 | 2;
  subject: string;
  title: LocalizedText;
}

export const ALL_CURRICULUM_LESSONS_INDEX: CurriculumLessonRef[] = [
  ...ALL_LEVEL1_LESSONS.map((l) => ({
    id: l.id,
    level: 1 as const,
    subject: l.subject === 'numbers' ? 'math' : l.subject === 'colors' ? 'colors-shapes' : l.subject,
    title: l.title,
  })),
  ...ALL_LEVEL2_LESSONS.map((l) => ({
    id: l.id,
    level: 2 as const,
    subject: l.subject,
    title: l.title,
  })),
];

export function getCurriculumLessonById(lessonId: string): CurriculumLessonRef | undefined {
  return ALL_CURRICULUM_LESSONS_INDEX.find((l) => l.id === lessonId);
}
