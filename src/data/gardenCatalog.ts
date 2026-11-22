import type { GardenItemDefinition, LearningGardenState } from '../types/nonoland';

export const GARDEN_ITEMS_CATALOG: GardenItemDefinition[] = [
  {
    id: 'garden-sun-flower',
    category: 'flower',
    name: { ar: 'زهرة الشمس المبتسمة', en: 'Smiling Sunflower' },
    emoji: '🌻',
    milestoneHint: { ar: 'أكمل أول درس أو قصة', en: 'Complete your first lesson or story' },
  },
  {
    id: 'garden-olive-tree',
    category: 'tree',
    name: { ar: 'شجرة النجاح الصغيرة', en: 'Little Tree of Growth' },
    emoji: '🌳',
    milestoneHint: { ar: 'أتقن أي مهارة أو درسين', en: 'Practice or complete 2 lessons' },
  },
  {
    id: 'garden-blue-butterfly',
    category: 'butterfly',
    name: { ar: 'فراشة المعرفة', en: 'Curiosity Butterfly' },
    emoji: '🦋',
    milestoneHint: { ar: 'أكمل نشاط قراءة أو مغامرة', en: 'Complete a story or reading stage' },
  },
  {
    id: 'garden-rainbow-tulip',
    category: 'flower',
    name: { ar: 'توليب الألوان الزاهي', en: 'Rainbow Tulip' },
    emoji: '🌷',
    milestoneHint: { ar: 'ارسم أو أنشئ في الاستوديو', en: 'Create a creative project' },
  },
  {
    id: 'garden-story-stone',
    category: 'stone',
    name: { ar: 'حجر الحكايات المضيء', en: 'Glowing Story Stone' },
    emoji: '🪨',
    milestoneHint: { ar: 'اقرأ ٣ قصص ممتعة', en: 'Finish 3 stories' },
  },
  {
    id: 'garden-family-blossom',
    category: 'decor',
    name: { ar: 'زهرة وقتنا معاً', en: 'Together Time Blossom' },
    emoji: '🌸',
    milestoneHint: { ar: 'أكمل نشاطاً عائلياً مع ولي الأمر', en: 'Complete a Together Time activity' },
  },
  {
    id: 'garden-science-sprout',
    category: 'plant',
    name: { ar: 'نبتة المختبر العجيبة', en: 'Discovery Lab Sprout' },
    emoji: '🪴',
    milestoneHint: { ar: 'جرب تجربة في مختبر نونو', en: 'Finish a Discovery Lab experiment' },
  },
  {
    id: 'garden-star-lantern',
    category: 'decor',
    name: { ar: 'فانوس النجوم الذهبي', en: 'Golden Star Lantern' },
    emoji: '🏮',
    milestoneHint: { ar: 'اجمع ١٢ نجمة تعلم', en: 'Collect 12 learning stars' },
  },
  {
    id: 'garden-ladybug',
    category: 'butterfly',
    name: { ar: 'دعسوقة اللطف', en: 'Kindness Ladybug' },
    emoji: '🐞',
    milestoneHint: { ar: 'اعتنِ بالحديقة ٣ مرات', en: 'Water the garden 3 times' },
  },
  {
    id: 'garden-cherry-tree',
    category: 'tree',
    name: { ar: 'شجرة الربيع الوردية', en: 'Spring Blossom Tree' },
    emoji: '🌺',
    milestoneHint: { ar: 'استمر في التعلم ٥ جلسات', en: 'Reach 5 completed milestones' },
  },
];

export const DEFAULT_LEARNING_GARDEN_STATE: LearningGardenState = {
  unlockedItemIds: ['garden-sun-flower'],
  placements: [
    {
      instanceId: 'g-starter-1',
      itemId: 'garden-sun-flower',
      x: 48,
      y: 66,
      growthStage: 1,
    },
  ],
  wateringCount: 0,
  theme: 'sunny-meadow',
  milestonesUnlocked: [],
};

export function sanitizeLearningGarden(raw?: Partial<LearningGardenState> | null): LearningGardenState {
  const validIds = new Set(GARDEN_ITEMS_CATALOG.map((i) => i.id));
  const unlocked = Array.from(
    new Set(['garden-sun-flower', ...(Array.isArray(raw?.unlockedItemIds) ? raw.unlockedItemIds.filter((id) => validIds.has(id)) : [])]),
  );
  const placements = Array.isArray(raw?.placements) && raw.placements.length > 0
    ? raw.placements.slice(0, 18).map((p, idx) => ({
        instanceId: String(p.instanceId || `gp-${idx}`),
        itemId: validIds.has(p.itemId) ? p.itemId : 'garden-sun-flower',
        x: Math.min(90, Math.max(10, Math.round(Number(p.x) || 50))),
        y: Math.min(88, Math.max(24, Math.round(Number(p.y) || 64))),
        growthStage: ([1, 2, 3].includes(Number(p.growthStage)) ? Number(p.growthStage) : 1) as 1 | 2 | 3,
      }))
    : [...DEFAULT_LEARNING_GARDEN_STATE.placements];

  return {
    unlockedItemIds: unlocked,
    placements,
    wateringCount: Math.max(0, Number(raw?.wateringCount || 0)),
    lastWateredAt: raw?.lastWateredAt,
    theme:
      raw?.theme === 'spring-rain' || raw?.theme === 'starlight-garden'
        ? raw.theme
        : 'sunny-meadow',
    milestonesUnlocked: Array.isArray(raw?.milestonesUnlocked) ? raw.milestonesUnlocked.slice(0, 40) : [],
  };
}
