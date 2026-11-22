import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Eye,
  FileAudio,
  ListChecks,
  RefreshCw,
  Save,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import type {
  QuranStoryAdminOverride,
  QuranStorySceneOverride,
  QuranStorySfxCue,
  QuranStorySpec,
} from '../../types/nonoland';
import { QuranStoryPlayer } from './QuranStoryPlayer';

interface Props {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

interface ManifestItem {
  storyId: string;
  storyTitleAr: string;
  storyTitleEn: string;
  sceneId: string;
  sceneOrder: number;
  sceneTitleAr: string;
  sceneTitleEn: string;
  narrationTextAr: string;
  narrationTextEn: string;
  expectedLocalPath: string;
  attachedUrl: string | null;
  assetStatus: 'valid' | 'missing' | 'invalid';
  bytes: number;
  durationSeconds: number | null;
  validationReason?: string;
  reviewFlag?: { reasonAr: string; reasonEn: string };
}

interface AudioManifestSummary {
  totalStories: number;
  totalScenes: number;
  totalRequiredAssets: number;
  validAudioCount: number;
  missingAudioCount: number;
  invalidAudioCount: number;
  ttsConfigured: boolean;
  ttsModel: string;
  voiceName: string;
  encodingTarget: string;
  items: ManifestItem[];
}

const SFX_CUE_OPTIONS: Array<{ value: QuranStorySfxCue; labelAr: string; labelEn: string }> = [
  { value: 'birds', labelAr: 'أصوات طيور هادئة', labelEn: 'Gentle Birds' },
  { value: 'waves', labelAr: 'أمواج لطيفة', labelEn: 'Calm Waves' },
  { value: 'whale', labelAr: 'بحر هادئ عميق', labelEn: 'Deep Ocean' },
  { value: 'stars', labelAr: 'بريق نجوم ليلي', labelEn: 'Night Stars' },
  { value: 'river', labelAr: 'خرير ماء', labelEn: 'Flowing River' },
  { value: 'forest', labelAr: 'طبيعة وأشجار', labelEn: 'Nature Meadow' },
  { value: 'dawn', labelAr: 'نسمة فجر', labelEn: 'Soft Dawn' },
  { value: 'cave', labelAr: 'صدى كهف هادئ', labelEn: 'Quiet Cave' },
  { value: 'chime', labelAr: 'نغمة رنين لطيفة', labelEn: 'Warm Chime' },
];

export const AdminQuranStoriesPanel: React.FC<Props> = ({
  apiFetch,
  onNotice,
  onError,
}) => {
  const { language } = useNonoLand();
  const [stories, setStories] = useState<QuranStorySpec[]>([]);
  const [overrides, setOverrides] = useState<Record<string, QuranStoryAdminOverride>>({});
  const [manifest, setManifest] = useState<AudioManifestSummary | null>(null);
  const [showManifestTable, setShowManifestTable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingKey, setGeneratingKey] = useState<string>('');
  const [validatingSceneId, setValidatingSceneId] = useState<string>('');
  const [validationMessages, setValidationMessages] = useState<
    Record<string, { ok: boolean; msg: string }>
  >({});
  const [selectedId, setSelectedId] = useState<string>('');
  const [previewStory, setPreviewStory] = useState<QuranStorySpec | null>(null);

  // Local editable draft for selected story
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [publishedDraft, setPublishedDraft] = useState<'published' | 'draft'>('published');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [moralAr, setMoralAr] = useState('');
  const [moralEn, setMoralEn] = useState('');
  const [sceneOrderDraft, setSceneOrderDraft] = useState<string[]>([]);
  const [sceneDrafts, setSceneDrafts] = useState<Record<string, QuranStorySceneOverride>>({});

  const hydrateDraft = useCallback(
    (story: QuranStorySpec, ov?: QuranStoryAdminOverride) => {
      setSelectedId(story.id);
      setEnabledDraft(ov?.enabled ?? story.enabled);
      setPublishedDraft(ov?.publishedStatus ?? story.publishedStatus);
      setTitleAr(story.title.ar);
      setTitleEn(story.title.en);
      setDescAr(story.description.ar);
      setDescEn(story.description.en);
      setMoralAr(story.moralLesson.ar);
      setMoralEn(story.moralLesson.en);
      setSceneOrderDraft(story.scenes.map((s) => s.id));
      const map: Record<string, QuranStorySceneOverride> = {};
      for (const sc of story.scenes) {
        const scOv = ov?.sceneOverrides?.[sc.id];
        map[sc.id] = {
          id: sc.id,
          title: { ar: sc.title.ar, en: sc.title.en },
          durationSeconds: sc.durationSeconds,
          sfxCue: sc.sfxCue,
          illustrationKey: sc.illustrationKey,
          narrationAudioUrl:
            sc.narrationAudioUrl ??
            (scOv?.narrationAudioUrl ? scOv.narrationAudioUrl : ''),
          narration: {
            young: { ...sc.narration.young },
            mid: { ...sc.narration.mid },
            older: { ...sc.narration.older },
          },
        };
      }
      setSceneDrafts(map);
      setValidationMessages({});
    },
    [],
  );

  const loadStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/quran/stories', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        stories?: QuranStorySpec[];
        overrides?: Record<string, QuranStoryAdminOverride>;
        audioManifest?: AudioManifestSummary;
        error?: string;
      };
      if (!res.ok || !Array.isArray(data.stories)) {
        onError(data.error || 'Failed to load Quran Stories CMS.');
        return;
      }
      setStories(data.stories);
      setOverrides(data.overrides || {});
      if (data.audioManifest) {
        setManifest(data.audioManifest);
      }
    } catch {
      onError(language === 'ar' ? 'تعذر تحميل إدارة حكايات القرآن.' : 'Failed to load Quran Stories CMS.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, language, onError]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const selectedBase = stories.find((s) => s.id === selectedId) || null;

  const moveScene = (sceneId: string, dir: -1 | 1) => {
    const idx = sceneOrderDraft.indexOf(sceneId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sceneOrderDraft.length) return;
    const next = [...sceneOrderDraft];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSceneOrderDraft(next);
  };

  const updateSceneField = (sceneId: string, patch: Partial<QuranStorySceneOverride>) => {
    setSceneDrafts((prev) => ({
      ...prev,
      [sceneId]: {
        ...(prev[sceneId] || { id: sceneId }),
        ...patch,
      },
    }));
  };

  const buildPreviewStory = (): QuranStorySpec | null => {
    if (!selectedBase) return null;
    const sceneMap = new Map(selectedBase.scenes.map((s) => [s.id, s]));
    const orderedScenes = sceneOrderDraft
      .map((id) => sceneMap.get(id))
      .filter((sc): sc is QuranStorySpec['scenes'][number] => Boolean(sc))
      .map((sc) => {
        const d = sceneDrafts[sc.id];
        if (!d) return sc;
        return {
          ...sc,
          title: d.title || sc.title,
          durationSeconds: d.durationSeconds ?? sc.durationSeconds,
          sfxCue: d.sfxCue ?? sc.sfxCue,
          illustrationKey: d.illustrationKey || sc.illustrationKey,
          narrationAudioUrl: d.narrationAudioUrl ? d.narrationAudioUrl : null,
          narration: d.narration || sc.narration,
        };
      });
    return {
      ...selectedBase,
      enabled: enabledDraft,
      publishedStatus: publishedDraft,
      title: { ar: titleAr || selectedBase.title.ar, en: titleEn || selectedBase.title.en },
      description: { ar: descAr || selectedBase.description.ar, en: descEn || selectedBase.description.en },
      moralLesson: { ar: moralAr || selectedBase.moralLesson.ar, en: moralEn || selectedBase.moralLesson.en },
      scenes: orderedScenes,
    };
  };

  const handleValidateSceneAudioUrl = async (sceneId: string) => {
    const rawUrl = String(sceneDrafts[sceneId]?.narrationAudioUrl || '').trim();
    if (!rawUrl) {
      setValidationMessages((p) => ({
        ...p,
        [sceneId]: {
          ok: false,
          msg: language === 'ar' ? 'أدخل رابطاً أولاً قبل الفحص.' : 'Enter an audio URL first.',
        },
      }));
      return;
    }
    setValidatingSceneId(sceneId);
    try {
      const res = await apiFetch('/api/admin/quran/stories/validate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });
      const resp = (await res.json().catch(() => ({}))) as {
        validation?: {
          valid: boolean;
          bytes: number;
          durationSeconds: number | null;
          mimeType: string | null;
          reason?: string;
        };
        error?: string;
      };
      if (!res.ok || !resp.validation?.valid) {
        setValidationMessages((p) => ({
          ...p,
          [sceneId]: {
            ok: false,
            msg: resp.error || resp.validation?.reason || 'Validation failed.',
          },
        }));
        return;
      }
      const v = resp.validation;
      if (v.durationSeconds) {
        updateSceneField(sceneId, {
          durationSeconds: Math.max(10, Math.min(180, Math.round(v.durationSeconds))),
        });
      }
      setValidationMessages((p) => ({
        ...p,
        [sceneId]: {
          ok: true,
          msg: `Valid ${v.mimeType || 'audio'} (${Math.round(v.bytes / 1024)} KB${
            v.durationSeconds ? `, ${v.durationSeconds}s` : ''
          })`,
        },
      }));
    } finally {
      setValidatingSceneId('');
    }
  };

  const handleGenerateSceneAudio = async (storyId: string, sceneId: string) => {
    onError('');
    setGeneratingKey(`${storyId}:${sceneId}`);
    try {
      const res = await apiFetch(
        `/api/admin/quran/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(sceneId)}/generate-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ageBand: 'mid' }),
        },
      );
      const resp = (await res.json().catch(() => ({}))) as {
        asset?: { url: string; bytes: number; durationSeconds: number | null };
        stories?: QuranStorySpec[];
        overrides?: Record<string, QuranStoryAdminOverride>;
        audioManifest?: AudioManifestSummary;
        error?: string;
      };
      if (!res.ok || !resp.asset) {
        onError(resp.error || 'Could not generate scene audio.');
        return;
      }
      if (Array.isArray(resp.stories)) setStories(resp.stories);
      if (resp.overrides) setOverrides(resp.overrides);
      if (resp.audioManifest) setManifest(resp.audioManifest);
      if (selectedId === storyId) {
        updateSceneField(sceneId, {
          narrationAudioUrl: resp.asset.url,
          durationSeconds: resp.asset.durationSeconds
            ? Math.max(10, Math.min(180, Math.round(resp.asset.durationSeconds)))
            : sceneDrafts[sceneId]?.durationSeconds,
        });
        setValidationMessages((p) => ({
          ...p,
          [sceneId]: {
            ok: true,
            msg: `Generated MP3 (${Math.round(resp.asset!.bytes / 1024)} KB${
              resp.asset!.durationSeconds ? `, ${resp.asset!.durationSeconds}s` : ''
            })`,
          },
        }));
      }
      onNotice(
        language === 'ar'
          ? `تم توليد وحفظ السرد العربي للمشهد ${sceneId} (${resp.asset.url}).`
          : `Generated & validated Arabic narration MP3 for ${sceneId}.`,
      );
    } finally {
      setGeneratingKey('');
    }
  };

  const handleGenerateAllForStory = async (storyId: string) => {
    onError('');
    setGeneratingKey(`story:${storyId}`);
    try {
      const res = await apiFetch(
        `/api/admin/quran/stories/${encodeURIComponent(storyId)}/generate-all-audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: false }),
        },
      );
      const resp = (await res.json().catch(() => ({}))) as {
        generatedCount?: number;
        stories?: QuranStorySpec[];
        overrides?: Record<string, QuranStoryAdminOverride>;
        audioManifest?: AudioManifestSummary;
        error?: string;
      };
      if (Array.isArray(resp.stories)) setStories(resp.stories);
      if (resp.overrides) setOverrides(resp.overrides);
      if (resp.audioManifest) setManifest(resp.audioManifest);
      if (!res.ok) {
        onError(resp.error || 'Batch story audio generation failed.');
        return;
      }
      onNotice(
        language === 'ar'
          ? `تم توليد ${resp.generatedCount || 0} ملفات سرد صوتي للقصة بنجاح.`
          : `Generated ${resp.generatedCount || 0} verified MP3 scenes cleanly.`,
      );
    } finally {
      setGeneratingKey('');
    }
  };

  const handleGenerateAllMissingStories = async () => {
    onError('');
    const storiesNeedingAudio = stories.filter((st) =>
      st.scenes.some((sc) => !sc.narrationAudioUrl),
    );
    if (storiesNeedingAudio.length === 0) return;

    setGeneratingKey('all-stories');
    let totalGenerated = 0;
    try {
      for (const st of storiesNeedingAudio) {
        const res = await apiFetch(
          `/api/admin/quran/stories/${encodeURIComponent(st.id)}/generate-all-audio`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: false }),
          },
        );
        const resp = (await res.json().catch(() => ({}))) as {
          generatedCount?: number;
          stories?: QuranStorySpec[];
          overrides?: Record<string, QuranStoryAdminOverride>;
          audioManifest?: AudioManifestSummary;
          error?: string;
        };
        if (Array.isArray(resp.stories)) setStories(resp.stories);
        if (resp.overrides) setOverrides(resp.overrides);
        if (resp.audioManifest) setManifest(resp.audioManifest);
        totalGenerated += resp.generatedCount || 0;
        if (!res.ok) {
          onError(resp.error || `Stopped at story ${st.id}`);
          return;
        }
      }
      onNotice(
        language === 'ar'
          ? `تم توليد وحفظ ${totalGenerated} ملفاً صوتياً عبر مكتبة الحكايات بنجاح.`
          : `Generated & saved ${totalGenerated} verified Arabic narration MP3s.`,
      );
    } finally {
      setGeneratingKey('');
    }
  };

  const handleSaveStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBase) return;
    onError('');
    setSaving(true);
    try {
      const sanitizedScenes: Record<string, QuranStorySceneOverride> = {};
      for (const [scId, d] of Object.entries(sceneDrafts)) {
        sanitizedScenes[scId] = {
          ...d,
          narrationAudioUrl:
            typeof d.narrationAudioUrl === 'string' && d.narrationAudioUrl.trim()
              ? d.narrationAudioUrl.trim()
              : null,
        };
      }
      const res = await apiFetch(`/api/admin/quran/stories/${encodeURIComponent(selectedBase.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enabledDraft,
          publishedStatus: publishedDraft,
          title: { ar: titleAr, en: titleEn },
          description: { ar: descAr, en: descEn },
          moralLesson: { ar: moralAr, en: moralEn },
          sceneOrder: sceneOrderDraft,
          sceneOverrides: sanitizedScenes,
        }),
      });
      const resp = (await res.json().catch(() => ({}))) as {
        stories?: QuranStorySpec[];
        story?: QuranStorySpec;
        override?: QuranStoryAdminOverride;
        overrides?: Record<string, QuranStoryAdminOverride>;
        audioManifest?: AudioManifestSummary;
        error?: string;
      };
      if (!res.ok) {
        onError(resp.error || 'Could not update story configuration.');
        return;
      }
      if (Array.isArray(resp.stories)) setStories(resp.stories);
      if (resp.overrides) setOverrides(resp.overrides);
      else if (resp.override) {
        setOverrides((prev) => ({ ...prev, [selectedBase.id]: resp.override! }));
      }
      if (resp.audioManifest) setManifest(resp.audioManifest);
      onNotice(
        language === 'ar'
          ? `تم حفظ تعديلات قصة «${titleAr || selectedBase.title.ar}» بنجاح (${publishedDraft === 'published' ? 'منشورة' : 'مسودة'}).`
          : `Saved Quran Story "${titleEn || selectedBase.title.en}" (${publishedDraft}).`,
      );
      setSelectedId('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nono-card rounded-3xl p-5 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#047857]" />
            <span>
              {language === 'ar'
                ? 'إدارة مكتبة «حكايات من القرآن» والملفات الصوتية (CMS)'
                : 'Quran Stories Library & Audio Narration CMS'}
            </span>
          </h3>
          <p className="text-xs font-bold text-[#27345C]/70 mt-0.5">
            {language === 'ar'
              ? 'فحص الحالة الفعلية لكل مشهد، توليد السرد القصصي المعتمد باللغة العربية (وليس تلاوة قرآن)، واستبدال أو فحص الروابط قبل النشر.'
              : 'Track valid vs missing scene audio, generate Arabic storytelling MP3s (non-Quran recitation), validate URLs, and preview drafts safely.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStories()}
          className="min-h-[36px] px-3 rounded-xl bg-[#ECFDF5] text-[#047857] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{stories.length} {language === 'ar' ? 'حكايات' : 'Stories'}</span>
        </button>
      </div>

      {/* Audio Asset Manifest Overview */}
      {manifest && (
        <div className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#B4862C]/25 space-y-3 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-[#27345C]/10">
              <p className="text-base font-extrabold text-[#27345C] tabular-nums">{manifest.totalScenes}</p>
              <p className="text-[11px] font-bold text-[#27345C]/70">
                {language === 'ar' ? 'إجمالي المشاهد' : 'Total Scenes'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#10B981]/25">
              <p className="text-base font-extrabold text-[#047857] tabular-nums">{manifest.validAudioCount}</p>
              <p className="text-[11px] font-bold text-[#065F46]">
                {language === 'ar' ? 'ملفات صوت صالحة' : 'Valid Audio'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#EF4444]/25">
              <p className="text-base font-extrabold text-[#991B1B] tabular-nums">
                {manifest.missingAudioCount + manifest.invalidAudioCount}
              </p>
              <p className="text-[11px] font-bold text-[#991B1B]">
                {language === 'ar' ? 'ملفات مفقودة' : 'Missing / Invalid'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-[#27345C]/10">
              <p className="text-xs font-extrabold text-[#27345C] truncate">
                {manifest.ttsConfigured ? manifest.ttsModel : 'Not Configured'}
              </p>
              <p className="text-[11px] font-bold text-[#27345C]/70">
                {language === 'ar' ? 'محرك السرد' : 'TTS Provider'}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-[#27345C]/10">
              <button
                type="button"
                onClick={() => setShowManifestTable((v) => !v)}
                className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-[#047857] font-extrabold cursor-pointer"
              >
                <ListChecks className="w-4 h-4" />
                <span>
                  {showManifestTable
                    ? language === 'ar'
                      ? 'إخفاء الجرد'
                      : 'Hide Manifest'
                    : language === 'ar'
                      ? 'عرض جرد المشاهد'
                      : 'View 41-Scene Manifest'}
                </span>
              </button>
            </div>
          </div>

          {manifest.ttsConfigured && manifest.missingAudioCount + manifest.invalidAudioCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#ECFDF5] border border-[#10B981]/30">
              <span className="font-bold text-[#065F46]">
                {language === 'ar'
                  ? `متبقي ${manifest.missingAudioCount + manifest.invalidAudioCount} مشاهد بدون ملف صوتي معتمد من أصل ${manifest.totalRequiredAssets}.`
                  : `${manifest.missingAudioCount + manifest.invalidAudioCount} of ${manifest.totalRequiredAssets} scenes need Arabic narration MP3s.`}
              </span>
              <button
                type="button"
                disabled={generatingKey !== ''}
                onClick={() => void handleGenerateAllMissingStories()}
                className="min-h-[38px] px-4 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <FileAudio className="w-4 h-4" />
                <span>
                  {generatingKey === 'all-stories'
                    ? language === 'ar'
                      ? 'جارٍ التوليد...'
                      : 'Generating...'
                    : language === 'ar'
                      ? `توليد كل الناقص (${manifest.missingAudioCount + manifest.invalidAudioCount})`
                      : `Generate All Missing (${manifest.missingAudioCount + manifest.invalidAudioCount})`}
                </span>
              </button>
            </div>
          )}

          {showManifestTable && (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-[#27345C]/12 bg-white divide-y divide-[#27345C]/10">
              {manifest.items.map((item) => (
                <div key={`${item.storyId}:${item.sceneId}`} className="p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-[#27345C]">
                      {item.storyTitleAr} · {item.sceneId} ({item.sceneTitleAr})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          item.assetStatus === 'valid'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : item.assetStatus === 'invalid'
                              ? 'bg-[#FEE2E2] text-[#991B1B]'
                              : 'bg-[#FEF3C7] text-[#92400E]'
                        }`}
                      >
                        {item.assetStatus}
                        {item.durationSeconds ? ` · ${item.durationSeconds}s` : ''}
                        {item.bytes > 0 ? ` · ${Math.round(item.bytes / 1024)}KB` : ''}
                      </span>
                      {manifest.ttsConfigured && (
                        <button
                          type="button"
                          disabled={generatingKey !== ''}
                          onClick={() => void handleGenerateSceneAudio(item.storyId, item.sceneId)}
                          className="px-2 py-0.5 rounded-md bg-[#047857] text-white text-[10px] font-extrabold cursor-pointer disabled:opacity-45"
                        >
                          {generatingKey === `${item.storyId}:${item.sceneId}`
                            ? '...'
                            : language === 'ar'
                              ? 'توليد MP3'
                              : 'Generate MP3'}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#27345C]/75">{item.narrationTextAr}</p>
                  <p className="text-[10px] font-mono-num text-[#27345C]/60" dir="ltr">
                    Expected: {item.expectedLocalPath}
                    {item.attachedUrl ? ` | Attached: ${item.attachedUrl}` : ''}
                  </p>
                  {item.reviewFlag && (
                    <p className="text-[10px] font-bold text-[#92400E] bg-[#FFFBEB] p-1.5 rounded">
                      ⚑ {language === 'ar' ? item.reviewFlag.reasonAr : item.reviewFlag.reasonEn}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && stories.length === 0 ? (
        <p className="text-xs font-bold text-[#27345C]/65">
          {language === 'ar' ? 'جارٍ تحميل مكتبة الحكايات...' : 'Loading stories library...'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {stories.map((story) => {
            const hasAudioCount = story.scenes.filter((s) => Boolean(s.narrationAudioUrl)).length;
            const missingCount = story.scenes.length - hasAudioCount;
            return (
              <div
                key={story.id}
                className={`p-4 rounded-2xl border space-y-2 ${
                  story.enabled && story.publishedStatus === 'published'
                    ? 'bg-[#FFFDF7] border-[#B4862C]/25'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-sm text-[#27345C]">{story.title[language]}</p>
                    <p className="text-[#27345C]/65 font-bold mt-0.5 flex items-center gap-1.5">
                      {hasAudioCount === story.scenes.length ? (
                        <Volume2 className="w-3.5 h-3.5 text-[#047857]" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-[#D97706]" />
                      )}
                      <span>
                        {story.scenes.length} {language === 'ar' ? 'مشاهد' : 'scenes'} ·{' '}
                        {hasAudioCount}/{story.scenes.length}{' '}
                        {language === 'ar' ? 'صوت معتمد' : 'validated audio'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                        story.publishedStatus === 'published'
                          ? 'bg-[#DCFCE7] text-[#166534]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {story.publishedStatus}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                        story.enabled ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {story.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                </div>

                <p className="text-[#27345C]/75 font-bold line-clamp-2">{story.description[language]}</p>

                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[#047857]">
                  <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    {story.surahReferences.map((r) => `${r.surahNameAr} (${r.ayahRange})`).join(' · ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => hydrateDraft(story, overrides[story.id])}
                    className="min-h-[38px] flex-1 px-3 rounded-xl bg-[#27345C] text-white font-extrabold cursor-pointer"
                  >
                    {language === 'ar' ? 'تعديل وإدارة الصوت' : 'Edit & Audio CMS'}
                  </button>
                  {manifest?.ttsConfigured && missingCount > 0 && (
                    <button
                      type="button"
                      disabled={generatingKey !== ''}
                      onClick={() => void handleGenerateAllForStory(story.id)}
                      className="min-h-[38px] px-3 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-45"
                    >
                      <FileAudio className="w-3.5 h-3.5" />
                      <span>
                        {generatingKey === `story:${story.id}`
                          ? '...'
                          : language === 'ar'
                            ? `توليد (${missingCount})`
                            : `Generate (${missingCount})`}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewStory(story)}
                    className="min-h-[38px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'معاينة' : 'Preview'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBase && (
        <form
          onSubmit={(e) => void handleSaveStory(e)}
          className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-[#047857]/25 space-y-4 text-xs font-bold"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27345C]/10 pb-3">
            <div>
              <p className="text-sm font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? `تعديل حكاية: ${selectedBase.title.ar}`
                  : `Editing Story: ${selectedBase.title.en}`}
              </p>
              <p className="text-[11px] text-[#047857] mt-0.5">
                {language === 'ar'
                  ? 'ضوابط الشرع والوقار: السرد تعليمي قصصي فقط · لا يتم حفظ روابط صوتية غير محققة.'
                  : 'Safety & accuracy: educational storytelling only · Invalid or broken audio URLs are blocked on save.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const built = buildPreviewStory();
                  if (built) setPreviewStory(built);
                }}
                className="min-h-[36px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'معاينة المسودة قبل النشر' : 'Preview Before Publishing'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedId('')}
                className="min-h-[36px] px-3 rounded-xl bg-slate-200 text-[#27345C] font-extrabold cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#ECFDF5]/60 border border-[#10B981]/25 space-y-1 text-[11px] text-[#065F46]">
            <p className="font-extrabold">
              {language === 'ar' ? 'المرجعية القرآنية المعتمدة (للقراءة فقط):' : 'Immutable Verified Quranic Facts:'}
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {selectedBase.establishedQuranicFacts.map((fact, idx) => (
                <li key={idx}>{fact[language]}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="p-3 rounded-xl bg-white border border-[#27345C]/12 flex items-center justify-between cursor-pointer">
              <span>{language === 'ar' ? 'تفعيل الحكاية في التطبيق' : 'Story Enabled'}</span>
              <input
                type="checkbox"
                checked={enabledDraft}
                onChange={(e) => setEnabledDraft(e.target.checked)}
                className="w-4 h-4 accent-[#047857]"
              />
            </label>

            <label className="space-y-1">
              <span>{language === 'ar' ? 'حالة النشر' : 'Publish Status'}</span>
              <select
                value={publishedDraft}
                onChange={(e) => setPublishedDraft(e.target.value as 'published' | 'draft')}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15"
              >
                <option value="published">published</option>
                <option value="draft">draft</option>
              </select>
            </label>

            <label className="space-y-1">
              <span>Title (Arabic)</span>
              <input
                type="text"
                dir="rtl"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>

            <label className="space-y-1">
              <span>Title (English)</span>
              <input
                type="text"
                dir="ltr"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>

            <label className="space-y-1">
              <span>Description (Arabic)</span>
              <textarea
                rows={2}
                dir="rtl"
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>

            <label className="space-y-1">
              <span>Description (English)</span>
              <textarea
                rows={2}
                dir="ltr"
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>

            <label className="space-y-1">
              <span>Moral Lesson (Arabic)</span>
              <input
                type="text"
                dir="rtl"
                value={moralAr}
                onChange={(e) => setMoralAr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>

            <label className="space-y-1">
              <span>Moral Lesson (English)</span>
              <input
                type="text"
                dir="ltr"
                value={moralEn}
                onChange={(e) => setMoralEn(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15"
              />
            </label>
          </div>

          <div className="space-y-3 pt-2 border-t border-[#27345C]/10">
            <p className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar'
                ? 'المشاهد والترتيب وتوليد ومعاينة الصوت'
                : 'Scenes Order, Narration Text, Audio Preview & Validation'}
            </p>
            <p className="text-[11px] text-[#92400E] bg-[#FFFBEB] border border-[#D97706]/30 p-2.5 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
              <span>
                {language === 'ar'
                  ? 'يُستخدم نموذج الصوت لتوليد السرد القصصي التعليمي المبسّط فقط (وليس للقرآن الكريم). كل رابط صوتي يتم فحص وجوده وصيغته قبل الحفظ.'
                  : 'TTS is strictly scoped to educational storytelling narration (never Quran recitation). Every attached audio path or HTTPS URL is validated before saving.'}
              </span>
            </p>

            {sceneOrderDraft.map((scId, idx) => {
              const scDraft = sceneDrafts[scId];
              if (!scDraft) return null;
              const manifestRow = manifest?.items.find(
                (i) => i.storyId === selectedBase.id && i.sceneId === scId,
              );
              const valState = validationMessages[scId];
              const currentAudioUrl =
                typeof scDraft.narrationAudioUrl === 'string'
                  ? scDraft.narrationAudioUrl.trim()
                  : '';

              return (
                <div
                  key={scId}
                  className="p-3.5 rounded-2xl bg-white border border-[#27345C]/12 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-[#047857]">
                        #{idx + 1} · {scId} ({scDraft.title?.[language] || scId})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          currentAudioUrl && manifestRow?.assetStatus === 'valid'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : 'bg-[#FEF3C7] text-[#92400E]'
                        }`}
                      >
                        {currentAudioUrl && manifestRow?.assetStatus === 'valid'
                          ? `valid · ${manifestRow.durationSeconds || scDraft.durationSeconds}s`
                          : 'audio missing'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveScene(scId, -1)}
                        className="p-1.5 rounded-lg bg-[#FFF8E9] border border-[#27345C]/12 disabled:opacity-35 cursor-pointer"
                        aria-label="Move scene up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === sceneOrderDraft.length - 1}
                        onClick={() => moveScene(scId, 1)}
                        className="p-1.5 rounded-lg bg-[#FFF8E9] border border-[#27345C]/12 disabled:opacity-35 cursor-pointer"
                        aria-label="Move scene down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <label className="space-y-1">
                      <span>Scene Title (AR)</span>
                      <input
                        type="text"
                        dir="rtl"
                        value={scDraft.title?.ar || ''}
                        onChange={(e) =>
                          updateSceneField(scId, {
                            title: { ar: e.target.value, en: scDraft.title?.en || '' },
                          })
                        }
                        className="w-full h-9 px-2.5 rounded-xl bg-[#F8FAFC] border border-[#27345C]/12"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Duration (sec)</span>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={scDraft.durationSeconds ?? 35}
                        onChange={(e) =>
                          updateSceneField(scId, {
                            durationSeconds: Math.max(10, Math.min(180, Number(e.target.value) || 35)),
                          })
                        }
                        className="w-full h-9 px-2.5 rounded-xl bg-[#F8FAFC] border border-[#27345C]/12 tabular-nums"
                      />
                    </label>
                    <label className="space-y-1">
                      <span>Gentle SFX Cue</span>
                      <select
                        value={scDraft.sfxCue || 'chime'}
                        onChange={(e) =>
                          updateSceneField(scId, { sfxCue: e.target.value as QuranStorySfxCue })
                        }
                        className="w-full h-9 px-2.5 rounded-xl bg-[#F8FAFC] border border-[#27345C]/12"
                      >
                        {SFX_CUE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.value} — {language === 'ar' ? opt.labelAr : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block">Story Narration Audio URL (https:// or /assets/audio/...)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        placeholder={manifestRow?.expectedLocalPath || `/assets/audio/stories/${selectedBase.id}/${scId}.mp3`}
                        value={scDraft.narrationAudioUrl || ''}
                        onChange={(e) => updateSceneField(scId, { narrationAudioUrl: e.target.value })}
                        className="flex-1 min-w-[220px] h-9 px-2.5 rounded-xl bg-[#F8FAFC] border border-[#27345C]/12 font-mono-num"
                      />
                      <button
                        type="button"
                        disabled={validatingSceneId === scId}
                        onClick={() => void handleValidateSceneAudioUrl(scId)}
                        className="h-9 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] font-extrabold cursor-pointer disabled:opacity-45"
                      >
                        {validatingSceneId === scId
                          ? '...'
                          : language === 'ar'
                            ? 'فحص الرابط'
                            : 'Validate URL'}
                      </button>
                      {manifest?.ttsConfigured && (
                        <button
                          type="button"
                          disabled={generatingKey !== ''}
                          onClick={() => void handleGenerateSceneAudio(selectedBase.id, scId)}
                          className="h-9 px-3 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-45"
                        >
                          <FileAudio className="w-3.5 h-3.5" />
                          <span>
                            {generatingKey === `${selectedBase.id}:${scId}`
                              ? language === 'ar'
                                ? 'جارٍ التوليد...'
                                : 'Generating...'
                              : language === 'ar'
                                ? 'توليد السرد العربي'
                                : 'Generate Arabic Audio'}
                          </span>
                        </button>
                      )}
                    </div>
                    {valState && (
                      <p
                        className={`text-[11px] font-bold flex items-center gap-1 ${
                          valState.ok ? 'text-[#047857]' : 'text-[#991B1B]'
                        }`}
                      >
                        {valState.ok ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{valState.msg}</span>
                      </p>
                    )}
                    {currentAudioUrl && (
                      <audio
                        controls
                        preload="none"
                        src={currentAudioUrl}
                        className="w-full h-9 mt-1"
                      />
                    )}
                  </div>

                  {manifestRow?.reviewFlag && (
                    <p className="text-[11px] font-bold text-[#92400E] bg-[#FFFBEB] border border-[#D97706]/25 p-2 rounded-xl">
                      ⚑ {language === 'ar' ? manifestRow.reviewFlag.reasonAr : manifestRow.reviewFlag.reasonEn}
                    </p>
                  )}

                  <label className="block space-y-1">
                    <span>Arabic Narration (Ages 2–3 default segment)</span>
                    <textarea
                      rows={2}
                      dir="rtl"
                      value={scDraft.narration?.mid?.ar || ''}
                      onChange={(e) =>
                        updateSceneField(scId, {
                          narration: {
                            young: scDraft.narration?.young || { ar: '', en: '' },
                            mid: { ar: e.target.value, en: scDraft.narration?.mid?.en || '' },
                            older: scDraft.narration?.older || { ar: '', en: '' },
                          },
                        })
                      }
                      className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#27345C]/12"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="nono-btn-tactile min-h-[42px] px-6 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'ar' ? 'حفظ تعديلات الحكاية' : 'Save Story Updates'}</span>
            </button>
          </div>
        </form>
      )}

      {previewStory && (
        <QuranStoryPlayer
          story={previewStory}
          language={language}
          internalBand="2-3"
          previewMode
          onClose={() => setPreviewStory(null)}
          onRecordProgress={() => {}}
        />
      )}
    </div>
  );
};
