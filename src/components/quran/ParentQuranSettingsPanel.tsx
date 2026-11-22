import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Lock,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { QURAN_RECITERS, QURAN_STORIES, QURAN_SURAHS } from '../../data/quranCatalog';
import { formatNumber } from '../../i18n/translations';
import type { QuranChildSettings } from '../../types/nonoland';
import type { ChildQuranSummaryPayload } from './QuranSharedTypes';

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const ParentQuranSettingsPanel: React.FC<Props> = ({
  gateVerified,
  onRequestGateUnlock,
}) => {
  const { activeChild, authSession, childrenList, language, navigate, selectChild } = useNonoLand();
  const [summary, setSummary] = useState<ChildQuranSummaryPayload | null>(null);
  const [draft, setDraft] = useState<QuranChildSettings | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isPersistedChild = Boolean(
    authSession.authenticated &&
      activeChild &&
      !activeChild.id.startsWith('demo-') &&
      !activeChild.id.startsWith('sample-'),
  );

  const loadChildQuran = useCallback(async () => {
    if (!isPersistedChild || !activeChild) {
      setSummary(null);
      setDraft(null);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/quran`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as ChildQuranSummaryPayload;
        setSummary(data);
        setDraft(data.settings);
        const notes: Record<string, string> = {};
        for (const sp of data.surahProgress) {
          if (sp.parentNote) notes[sp.surahId] = sp.parentNote;
        }
        setNoteDrafts(notes);
      }
    } catch {
      setErrorMsg(language === 'ar' ? 'تعذر تحميل إعدادات عالم القرآن.' : 'Failed to load Quran settings.');
    } finally {
      setLoading(false);
    }
  }, [activeChild, isPersistedChild, language]);

  useEffect(() => {
    void loadChildQuran();
  }, [loadChildQuran]);

  if (!activeChild) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <BookOpen className="w-8 h-8 text-[#047857] mx-auto" />
        <p className="text-base font-extrabold text-[#27345C]">
          {language === 'ar'
            ? 'أضف ملف طفل أولاً لإدارة عالم القرآن الكريم ومراجعة الحفظ'
            : 'Add a child profile to manage Quran World settings and memorization confirmation'}
        </p>
        <button
          type="button"
          onClick={() => navigate('create-child')}
          className="nono-btn-tactile min-h-[44px] px-5 rounded-xl bg-[#047857] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
        >
          {language === 'ar' ? '+ إضافة طفل' : '+ Add Child'}
        </button>
      </div>
    );
  }

  const schemaReady = summary?.quranSchemaReady ?? false;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !isPersistedChild) return;
    setNotice('');
    setErrorMsg('');
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(`/api/children/${encodeURIComponent(activeChild.id)}/quran/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'PARENT_GATE_REQUIRED') {
          onRequestGateUnlock();
          return;
        }
        setErrorMsg(data.error || 'Could not update Quran settings.');
        return;
      }
      if (data.summary) {
        setSummary((prev) => ({ ...(prev || ({} as ChildQuranSummaryPayload)), ...data.summary, quranSchemaReady: schemaReady }));
        setDraft(data.summary.settings);
      }
      setNotice(
        language === 'ar'
          ? 'تم حفظ إعدادات عالم القرآن الكريم بنجاح ✓'
          : 'Quran World settings saved cleanly ✓',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMemorizationConfirm = async (surahId: string, confirmed: boolean) => {
    if (!isPersistedChild) return;
    setNotice('');
    setErrorMsg('');
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authSession.csrfToken) headers['x-csrf-token'] = authSession.csrfToken;
      const res = await fetch(
        `/api/children/${encodeURIComponent(activeChild.id)}/quran/memorization-confirm`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            surahId,
            confirmed,
            parentNote: noteDrafts[surahId] || '',
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'PARENT_GATE_REQUIRED') {
          onRequestGateUnlock();
          return;
        }
        setErrorMsg(data.error || 'Could not update memorization confirmation.');
        return;
      }
      if (data.summary) {
        setSummary((prev) => ({ ...(prev || ({} as ChildQuranSummaryPayload)), ...data.summary, quranSchemaReady: schemaReady }));
      }
      setNotice(
        confirmed
          ? language === 'ar'
            ? 'تم اعتماد الحفظ بواسطة ولي الأمر ✓'
            : 'Memorization confirmed by parent ✓'
          : language === 'ar'
            ? 'تم إعادة حالة السورة للمتابعة المستمرة.'
            : 'Surah reset for ongoing practice.',
      );
    } finally {
      setSaving(false);
    }
  };

  const moveSurahOrder = (surahId: string, dir: -1 | 1) => {
    if (!draft) return;
    const list = [...draft.surahOrder];
    const idx = list.indexOf(surahId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    setDraft({ ...draft, surahOrder: list });
  };

  const toggleAllowedSurah = (surahId: string) => {
    if (!draft) return;
    const exists = draft.allowedSurahIds.includes(surahId);
    if (exists && draft.allowedSurahIds.length <= 1) {
      setErrorMsg(
        language === 'ar'
          ? 'يجب بقاء سورة واحدة مفعّلة على الأقل.'
          : 'At least one Surah must remain enabled.',
      );
      return;
    }
    const next = exists
      ? draft.allowedSurahIds.filter((id) => id !== surahId)
      : [...draft.allowedSurahIds, surahId];
    setDraft({ ...draft, allowedSurahIds: next });
  };

  return (
    <div className="space-y-5">
      {/* Header + Child Selector + Independent Growth Summary */}
      <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#047857]" />
              <span>
                {language === 'ar'
                  ? 'عالم القرآن الكريم — تحكم الأهل وتأكيد الحفظ'
                  : 'Quran World — Parent Controls & Memorization Confirmation'}
              </span>
            </h2>
            <p className="text-xs font-bold text-[#27345C]/70 mt-0.5">
              {language === 'ar'
                ? 'مستقل تماماً عن درجات الاختبارات · لا يتم اعتماد الحفظ تلقائياً من الاستماع أبداً.'
                : 'Completely independent of academic exam scores · Memorization is never auto-confirmed.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeChild.id}
              onChange={(e) => selectChild(e.target.value)}
              className="min-h-[42px] px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold"
            >
              {childrenList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => navigate('quran-world')}
              className="min-h-[42px] px-4 rounded-xl bg-[#047857] text-white text-xs font-extrabold cursor-pointer"
            >
              {language === 'ar' ? 'فتح شاشة الطفل ←' : 'Open Child View →'}
            </button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
            {[
              { ar: 'سور مسموعة', en: 'Surahs Heard', val: summary.growthSummary.listenedSurahsCount },
              { ar: 'جلسات ترديد', en: 'Repeat Practiced', val: summary.growthSummary.practicedSurahsCount },
              { ar: 'سور مألوفة', en: 'Familiar', val: summary.growthSummary.familiarSurahsCount },
              { ar: 'حفظ مؤكد من الأهل', en: 'Parent Confirmed', val: summary.growthSummary.parentConfirmedCount },
              { ar: 'قصص قرآنية', en: 'Stories Read', val: summary.growthSummary.storiesReadCount },
              { ar: 'آداب مطبّقة', en: 'Manners Practiced', val: summary.growthSummary.mannersPracticedCount },
            ].map((stat) => (
              <div key={stat.en} className="p-3 rounded-2xl bg-[#ECFDF5]/60 border border-[#10B981]/20">
                <p className="text-xl font-extrabold text-[#047857] tabular-nums">{stat.val}</p>
                <p className="text-[11px] font-bold text-[#27345C]/75 mt-0.5">{stat[language]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schema Pending Notice */}
      {isPersistedChild && !loading && !schemaReady && (
        <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#D97706]/35 text-[#92400E] text-xs font-bold flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#D97706]" />
          <span>
            {language === 'ar'
              ? 'جداول حفظ إعدادات القرآن الكريم غير مطبّقة في قاعدة البيانات بعد (Migration 0002). يمكنك استعراض الحقول وسيتم الحفظ فور تفعيل الجداول.'
              : 'Quran tables await migration 0002_quran_world.sql. Saving changes is paused safely until tables are created.'}
          </span>
        </div>
      )}

      {/* Parent Gate Lock Prompt */}
      {!gateVerified && (
        <div className="nono-card rounded-3xl p-5 bg-[#FFFBEB] border border-[#D97706]/35 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-[#92400E]">
            <Lock className="w-5 h-5 shrink-0" />
            <span>
              {language === 'ar'
                ? 'تعديل إعدادات القرآن الكريم واعتماد الحفظ محمي ببوابة الوالدين.'
                : 'Updating Quran settings and confirming memorization require unlocking the Parent Gate.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRequestGateUnlock}
            className="min-h-[44px] px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'فتح بوابة الحماية PIN' : 'Unlock Parent Gate'}
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-2xl bg-[#DCFCE7] border border-[#10B981]/35 text-[#166534] text-xs font-extrabold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#EF4444]/35 text-[#991B1B] text-xs font-extrabold">
          {errorMsg}
        </div>
      )}

      {/* SETTINGS FORM */}
      {draft && (
        <form onSubmit={(e) => void handleSaveSettings(e)} className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#047857]" />
              <span>{language === 'ar' ? 'تخصيص التجربة للطفل' : 'Child Quran Preferences'}</span>
            </h3>
            <button
              type="submit"
              disabled={!gateVerified || saving || !schemaReady}
              className="nono-btn-tactile min-h-[44px] px-5 rounded-xl bg-[#047857] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-45"
            >
              <Save className="w-4 h-4" />
              <span>{language === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-bold">
            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] flex items-center justify-between gap-2 cursor-pointer">
              <span>{language === 'ar' ? 'تفعيل عالم القرآن للطفل' : 'Enable Quran World'}</span>
              <input
                type="checkbox"
                disabled={!gateVerified}
                checked={draft.enabled}
                onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                className="w-5 h-5 accent-[#047857]"
              />
            </label>

            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] flex items-center justify-between gap-2 cursor-pointer">
              <span>{language === 'ar' ? 'وضع الاستماع فقط' : 'Listen-Only Mode'}</span>
              <input
                type="checkbox"
                disabled={!gateVerified}
                checked={draft.listenOnlyMode}
                onChange={(e) => setDraft({ ...draft, listenOnlyMode: e.target.checked })}
                className="w-5 h-5 accent-[#047857]"
              />
            </label>

            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] flex items-center justify-between gap-2 cursor-pointer">
              <span>{language === 'ar' ? 'تذكير يومي لطيف' : 'Gentle Daily Reminder'}</span>
              <input
                type="checkbox"
                disabled={!gateVerified}
                checked={draft.gentleReminderEnabled}
                onChange={(e) => setDraft({ ...draft, gentleReminderEnabled: e.target.checked })}
                className="w-5 h-5 accent-[#047857]"
              />
            </label>

            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] space-y-1.5">
              <span>{language === 'ar' ? 'عدد مرات التكرار (١–٥)' : 'Repeat Count (1–5)'}</span>
              <input
                type="number"
                min={1}
                max={5}
                disabled={!gateVerified}
                value={draft.repeatCount}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    repeatCount: Math.max(1, Math.min(5, Number(e.target.value) || 2)),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 tabular-nums font-extrabold"
              />
            </label>

            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] space-y-1.5">
              <span>{language === 'ar' ? 'الحد اليومي (٥–٦٠ دقيقة)' : 'Daily Max Minutes (5–60)'}</span>
              <input
                type="number"
                min={5}
                max={60}
                disabled={!gateVerified}
                value={draft.dailyMaxMinutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dailyMaxMinutes: Math.max(5, Math.min(60, Number(e.target.value) || 15)),
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 tabular-nums font-extrabold"
              />
            </label>

            <label className="p-3.5 rounded-2xl bg-[#FFF8E9] space-y-1.5">
              <span>{language === 'ar' ? 'القارئ المعتمد' : 'Default Reciter'}</span>
              <select
                disabled={!gateVerified}
                value={draft.preferredReciterId}
                onChange={(e) => setDraft({ ...draft, preferredReciterId: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 font-extrabold"
              >
                {QURAN_RECITERS.filter(
                  (r) => r.reciterType === 'adult' || r.id === draft.preferredReciterId,
                ).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name[language]} ({r.verificationStatus})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-[#27345C] cursor-pointer">
            <input
              type="checkbox"
              disabled={!gateVerified}
              checked={draft.preferChildReciterFallback}
              onChange={(e) => setDraft({ ...draft, preferChildReciterFallback: e.target.checked })}
              className="w-4 h-4 accent-[#047857]"
            />
            <span>
              {language === 'ar'
                ? 'استخدام قارئ بالغ موثّق تلقائياً إذا لم تتوفر تلاوة طفل مرخصة بعد'
                : 'Fall back automatically to a verified adult reciter when child recording is pending'}
            </span>
          </label>

          {/* Allowed Surahs & Ordering */}
          <div className="space-y-2.5">
            <p className="text-xs font-extrabold text-[#27345C]">
              {language === 'ar' ? 'السور المتاحة وترتيب عرضها للطفل:' : 'Enabled Surahs & Display Order:'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {draft.surahOrder.map((sId, idx) => {
                const surah = QURAN_SURAHS.find((s) => s.id === sId);
                if (!surah) return null;
                const enabled = draft.allowedSurahIds.includes(sId);
                return (
                  <div
                    key={sId}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs font-bold ${
                      enabled ? 'bg-[#ECFDF5]/60 border-[#10B981]/30' : 'bg-slate-50 border-slate-200 opacity-70'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!gateVerified}
                        checked={enabled}
                        onChange={() => toggleAllowedSurah(sId)}
                        className="w-4 h-4 accent-[#047857]"
                      />
                      <span>
                        {surah.nameAr} ({surah.nameEn})
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!gateVerified || idx === 0}
                        onClick={() => moveSurahOrder(sId, -1)}
                        aria-label="Move Surah Up"
                        className="p-1.5 rounded-lg bg-white border border-[#27345C]/12 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!gateVerified || idx === draft.surahOrder.length - 1}
                        onClick={() => moveSurahOrder(sId, 1)}
                        aria-label="Move Surah Down"
                        className="p-1.5 rounded-lg bg-white border border-[#27345C]/12 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      )}

      {/* CHILD QURAN STORIES PROGRESS (READ-ONLY FOR PARENTS) */}
      {summary && (
        <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-extrabold text-[#27345C]">
                {language === 'ar'
                  ? 'تقدّم الطفل في «حكايات من القرآن»'
                  : 'Quran Stories Listening & Activity Progress'}
              </h3>
              <p className="text-xs font-bold text-[#27345C]/70 mt-0.5">
                {language === 'ar'
                  ? 'متابعة المشاهد المسموعة والأنشطة التفاعلية والأوسمة (منفصلة تماماً عن تأكيد حفظ السور).'
                  : 'Track stories started, scenes reached, listening time, interactive activities, and completion badges.'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#ECFDF5] text-[#047857] text-xs font-extrabold tabular-nums">
              {language === 'ar'
                ? `${formatNumber(summary.growthSummary.storiesReadCount, 'ar')} / ${formatNumber(QURAN_STORIES.length, 'ar')} مكتملة`
                : `${summary.growthSummary.storiesReadCount} / ${QURAN_STORIES.length} Completed`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QURAN_STORIES.map((story) => {
              const detail = summary.storyProgressDetails?.find((d) => d.storyId === story.id);
              const legacy = summary.storyProgress.find((p) => p.storyId === story.id);
              const started = Boolean(detail?.startedAt || legacy);
              const completed = Boolean(detail?.completed || (legacy?.completedCount || 0) > 0);
              const sceneCount = Math.max(1, detail?.totalScenes || story.scenes.length);
              const reachedScene = detail ? Math.min(sceneCount, (detail.lastSceneIndex || 0) + 1) : 0;
              const listenedMins = detail ? Math.round((detail.listenedSeconds || 0) / 60) : 0;
              const activityCount = detail?.interactionsCompleted?.length || 0;
              const totalActivities = story.scenes.filter((s) => Boolean(s.activity)).length;
              const completedDateStr = detail?.completedAt
                ? new Date(detail.completedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')
                : legacy?.lastReadAt
                  ? new Date(legacy.lastReadAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')
                  : null;

              return (
                <div
                  key={story.id}
                  className={`p-4 rounded-2xl border space-y-1.5 text-xs ${
                    completed
                      ? 'bg-[#ECFDF5]/60 border-[#10B981]/30'
                      : started
                        ? 'bg-[#FFF8E9] border-[#D97706]/25'
                        : 'bg-slate-50 border-[#27345C]/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-sm text-[#27345C]">
                      {story.title[language]}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold shrink-0 ${
                        completed
                          ? 'bg-[#DCFCE7] text-[#166534]'
                          : started
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : 'bg-slate-200/70 text-[#27345C]/70'
                      }`}
                    >
                      {completed
                        ? `${story.completionBadge.icon} ${story.completionBadge.title[language]}`
                        : started
                          ? language === 'ar'
                            ? 'قيد الاستماع'
                            : 'In Progress'
                          : language === 'ar'
                            ? 'لم تبدأ بعد'
                            : 'Not Started'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#27345C]/75 font-bold tabular-nums">
                    <span>
                      {language === 'ar'
                        ? `المشاهد: ${formatNumber(reachedScene, 'ar')}/${formatNumber(sceneCount, 'ar')}`
                        : `Scene: ${reachedScene}/${sceneCount}`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {language === 'ar'
                        ? `الأنشطة: ${formatNumber(activityCount, 'ar')}/${formatNumber(totalActivities, 'ar')}`
                        : `Activities: ${activityCount}/${totalActivities}`}
                    </span>
                    {listenedMins > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {language === 'ar'
                            ? `${formatNumber(listenedMins, 'ar')} د استماع`
                            : `${listenedMins}m listened`}
                        </span>
                      </>
                    )}
                    {completedDateStr && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          {language === 'ar' ? `آخر تاريخ: ${completedDateStr}` : `Completed: ${completedDateStr}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PARENT MEMORIZATION CONFIRMATION LIST */}
      {summary && (
        <div className="nono-card rounded-3xl p-5 sm:p-6 bg-white space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-[#27345C]">
              {language === 'ar'
                ? 'تأكيد الحفظ بواسطة ولي الأمر (حفظ مباشر)'
                : 'Explicit Parent Memorization Confirmation'}
            </h3>
            <p className="text-xs font-bold text-[#27345C]/70 mt-0.5">
              {language === 'ar'
                ? 'استمع لتلاوة طفلك بنفسك ثم اعتمد الحفظ مع رسالة تشجيع لطيفة.'
                : 'Listen to your child recite directly, then confirm memorization with an encouraging note.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QURAN_SURAHS.map((surah) => {
              const prog = summary.surahProgress.find((p) => p.surahId === surah.id);
              const isConfirmed = Boolean(prog?.parentConfirmedMemorization);
              return (
                <div
                  key={surah.id}
                  className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-extrabold text-sm text-[#27345C]">
                        {surah.nameAr} · {surah.nameEn}
                      </p>
                      <p className="text-[#27345C]/70 font-bold tabular-nums">
                        {language === 'ar'
                          ? `الاستماع: ${prog?.listenCount || 0} · الترديد: ${prog?.repeatSessionsCount || 0} · الحالة: ${prog?.status || 'not_started'}`
                          : `Listens: ${prog?.listenCount || 0} · Repeats: ${prog?.repeatSessionsCount || 0} · Status: ${prog?.status || 'not_started'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!gateVerified || saving || !schemaReady}
                      onClick={() => void handleMemorizationConfirm(surah.id, !isConfirmed)}
                      className={`min-h-[40px] px-3.5 rounded-xl font-extrabold cursor-pointer disabled:opacity-45 ${
                        isConfirmed
                          ? 'bg-[#DCFCE7] text-[#166534] border border-[#10B981]/40'
                          : 'bg-[#047857] text-white'
                      }`}
                    >
                      {isConfirmed
                        ? language === 'ar'
                          ? 'مؤكد ✓ (إلغاء)'
                          : 'Confirmed ✓ (Reset)'
                        : language === 'ar'
                          ? 'تأكيد الحفظ'
                          : 'Confirm Memorized'}
                    </button>
                  </div>

                  <input
                    type="text"
                    maxLength={280}
                    disabled={!gateVerified}
                    value={noteDrafts[surah.id] || ''}
                    onChange={(e) => setNoteDrafts((p) => ({ ...p, [surah.id]: e.target.value }))}
                    placeholder={
                      language === 'ar'
                        ? 'ملاحظة تشجيعية لطيفة من ولي الأمر...'
                        : 'Encouraging parent note (optional)...'
                    }
                    className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/12 font-semibold"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
