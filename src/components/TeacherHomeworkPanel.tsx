import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Paperclip,
  Plus,
  Send,
  Upload,
  Users,
} from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { t } from '../i18n/translations';
import type {
  Classroom,
  ContentVersionEntry,
  HomeworkAssignment,
  HomeworkAttachment,
  HomeworkStudentSubmission,
  HomeworkType,
  LocalizedText,
  TeacherQuestion,
  TeacherSubject,
} from '../types/nonoland';
import { ALLOWED_HOMEWORK_TYPES, ALLOWED_TEACHER_SUBJECTS } from '../utils/validation';

interface LessonOption {
  id: string;
  level: 1 | 2;
  subject: string;
  title: LocalizedText;
}

interface HomeworkRow extends HomeworkAssignment {
  stats: {
    assigned: number;
    opened: number;
    started: number;
    submitted: number;
    completed: number;
    overdue: number;
  };
}

interface TrackingRow extends HomeworkStudentSubmission {
  effectiveStatus: string;
  studentName: string;
}

interface TeacherHomeworkPanelProps {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  classes: Array<Classroom & { students: Array<{ id: string; displayName: string }> }>;
  students: Array<{ id: string; displayName: string; ageGroup: string }>;
  lessons: LessonOption[];
  questions: TeacherQuestion[];
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

const HOMEWORK_TYPE_LABELS: Record<HomeworkType, { ar: string; en: string }> = {
  'multiple-choice': { ar: 'اختيار من متعدد', en: 'Multiple Choice' },
  'picture-matching': { ar: 'مطابقة الصور', en: 'Picture Matching' },
  'audio-activity': { ar: 'نشاط استماع صوتي', en: 'Audio Activity' },
  'reading-practice': { ar: 'تدريب قراءة', en: 'Reading Practice' },
  'writing-practice': { ar: 'تدريب كتابة', en: 'Writing Practice' },
  'math-exercise': { ar: 'تمارين رياضيات', en: 'Math Exercise' },
  'interactive-game': { ar: 'لعبة تعليمية تفاعلية', en: 'Interactive Game' },
  'teacher-questions': { ar: 'أسئلة المعلم المخصصة', en: 'Teacher-Created Questions' },
};

export const TeacherHomeworkPanel: React.FC<TeacherHomeworkPanelProps> = ({
  apiFetch,
  classes,
  students,
  lessons,
  questions,
  onNotice,
  onError,
}) => {
  const { language, featureFlags } = useNonoLand();
  const [homeworks, setHomeworks] = useState<HomeworkRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Homework State
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [instAr, setInstAr] = useState('');
  const [instEn, setInstEn] = useState('');
  const [hwType, setHwType] = useState<HomeworkType>('reading-practice');
  const [subject, setSubject] = useState<TeacherSubject | 'comprehensive'>('arabic');
  const [level, setLevel] = useState<1 | 2>(1);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 60_000).toISOString().slice(0, 16));
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 16));
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [publishOnSave, setPublishOnSave] = useState(true);

  // Tracking & Grading Drawer State
  const [trackingHw, setTrackingHw] = useState<HomeworkAssignment | null>(null);
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([]);
  const [extendSubId, setExtendSubId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState(() => new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 16));
  const [extendReason, setExtendReason] = useState('Extra time granted by teacher');
  const [gradeSubId, setGradeSubId] = useState<string | null>(null);
  const [gradePct, setGradePct] = useState(90);
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [versionModal, setVersionModal] = useState<{ id: string; versions: ContentVersionEntry[] } | null>(null);

  const loadHomeworks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/teacher/homework');
      if (res.ok) {
        const d = (await res.json()) as { homeworks?: HomeworkRow[] };
        setHomeworks(d.homeworks || []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadHomeworks();
  }, [loadHomeworks]);

  const lessonsForLevel = lessons.filter((l) => l.level === level);

  useEffect(() => {
    if (lessonsForLevel.length > 0 && selectedLessons.length === 0) {
      setSelectedLessons([lessonsForLevel[0].id]);
    }
  }, [lessonsForLevel, selectedLessons.length]);

  const handleUploadAttachment = async (file: File) => {
    onError('');
    setUploadingAtt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch('/api/teacher/homework/attachments', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'Could not upload attachment');
        return;
      }
      setAttachments((prev) => [...prev, data.attachment]);
      onNotice(language === 'ar' ? 'تم رفع المرفق بنجاح' : 'Attachment uploaded securely');
    } catch {
      onError('Network error uploading attachment');
    } finally {
      setUploadingAtt(false);
    }
  };

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    onError('');
    onNotice('');
    if (selectedLessons.length === 0) {
      onError(language === 'ar' ? 'اختر درساً واحداً على الأقل' : 'Select at least one curriculum lesson');
      return;
    }
    const res = await apiFetch('/api/teacher/homework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: { ar: titleAr || titleEn, en: titleEn || titleAr },
        instructions: { ar: instAr || instEn, en: instEn || instAr },
        homeworkType: hwType,
        subject,
        level,
        lessonIds: selectedLessons,
        questionIds: selectedQIds,
        attachmentIds: attachments.map((a) => a.id),
        classIds: selectedClassIds,
        studentIds: selectedStudentIds,
        startDate: new Date(startDate).toISOString(),
        deadline: new Date(deadline).toISOString(),
        maxAttempts,
        publish: publishOnSave,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || 'Failed to create homework');
      return;
    }
    setTitleAr('');
    setTitleEn('');
    setInstAr('');
    setInstEn('');
    setSelectedQIds([]);
    setAttachments([]);
    setSelectedClassIds([]);
    setSelectedStudentIds([]);
    onNotice(
      data.requiresAdminApproval
        ? language === 'ar'
          ? 'تم إنشاء الواجب وإرساله لمراجعة الإدارة قبل ظهوره للطلاب.'
          : 'Homework created & sent to Admin review queue before student visibility.'
        : language === 'ar'
          ? 'تم حفظ ونشر الواجب للطلاب المختارين!'
          : 'Homework assignment saved cleanly!',
    );
    await loadHomeworks();
  };

  const openTracking = async (hwId: string) => {
    onError('');
    const res = await apiFetch(`/api/teacher/homework/${hwId}/tracking`);
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || 'Unable to load tracking');
      return;
    }
    setTrackingHw(data.homework);
    setTrackingRows(data.tracking || []);
  };

  const handleExtendDeadline = async (subId: string) => {
    const res = await apiFetch(`/api/teacher/homework/submissions/${subId}/extend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extendedDeadline: new Date(extendDate).toISOString(),
        reason: extendReason,
      }),
    });
    const data = await res.json();
    if (!res.ok) return onError(data.error || 'Could not extend deadline');
    setExtendSubId(null);
    onNotice(language === 'ar' ? 'تم تمديد الموعد للطالب' : 'Deadline extended for student');
    if (trackingHw) await openTracking(trackingHw.id);
    await loadHomeworks();
  };

  const handleGradeSubmission = async (subId: string) => {
    const res = await apiFetch(`/api/teacher/homework/submissions/${subId}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        percentage: Number(gradePct),
        teacherFeedback: gradeFeedback,
        markCompleted: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) return onError(data.error || 'Could not save grade');
    setGradeSubId(null);
    setGradeFeedback('');
    onNotice(language === 'ar' ? 'تم حفظ الدرجة وملاحظات المعلم' : 'Grade and feedback saved');
    if (trackingHw) await openTracking(trackingHw.id);
    await loadHomeworks();
  };

  const openVersions = async (hwId: string) => {
    const res = await apiFetch(`/api/content/homework/${hwId}/versions`);
    if (res.ok) {
      const d = await res.json();
      setVersionModal({ id: hwId, versions: d.versions || [] });
    }
  };

  if (!featureFlags.teacherHomeworkEnabled) {
    return (
      <div className="nono-card p-6 bg-white text-center space-y-2">
        <AlertCircle className="w-10 h-10 text-[#FF9360] mx-auto" />
        <h3 className="font-extrabold text-lg text-[#27345C]">
          {language === 'ar' ? 'نظام الواجبات متوقف مؤقتاً من الإدارة' : 'Homework Module Paused by Admin'}
        </h3>
        <p className="text-xs font-bold text-[#27345C]/70">
          {language === 'ar'
            ? 'فعّل المشرف إيقاف ميزة الواجبات عبر Feature Flags.'
            : 'An administrator has disabled the teacherHomeworkEnabled feature flag.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* CREATE HOMEWORK FORM */}
      <form onSubmit={(e) => void handleCreateHomework(e)} className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#8054D9]" />
            <span>{language === 'ar' ? 'إنشاء وإسناد واجب منزلي جديد' : 'Create & Assign Homework'}</span>
          </h2>
          {featureFlags.requireTeacherContentApproval && (
            <span className="px-2.5 py-1 rounded-lg bg-[#FFD84D]/35 text-[#78350F] text-xs font-extrabold">
              {language === 'ar' ? 'يتطلب موافقة الإدارة قبل النشر' : 'Admin Approval Required'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
          <input
            required
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            placeholder={language === 'ar' ? 'عنوان الواجب (بالعربية)' : 'Homework Title (Arabic)'}
            className="h-11 px-3 rounded-xl border border-[#27345C]/20"
          />
          <input
            required
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder={language === 'ar' ? 'عنوان الواجب (بالإنجليزية)' : 'Homework Title (English)'}
            className="h-11 px-3 rounded-xl border border-[#27345C]/20"
          />
          <textarea
            rows={2}
            value={instAr}
            onChange={(e) => setInstAr(e.target.value)}
            placeholder={language === 'ar' ? 'التعليمات للطالب بالعربية' : 'Student Instructions (Arabic)'}
            className="p-3 rounded-xl border border-[#27345C]/20"
          />
          <textarea
            rows={2}
            value={instEn}
            onChange={(e) => setInstEn(e.target.value)}
            placeholder={language === 'ar' ? 'التعليمات بالإنجليزية' : 'Student Instructions (English)'}
            className="p-3 rounded-xl border border-[#27345C]/20"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
          <div>
            <label className="block mb-1">{language === 'ar' ? 'نوع الواجب' : 'Homework Type'}</label>
            <select
              value={hwType}
              onChange={(e) => setHwType(e.target.value as HomeworkType)}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20 bg-white"
            >
              {ALLOWED_HOMEWORK_TYPES.map((ht) => (
                <option key={ht} value={ht}>
                  {language === 'ar' ? HOMEWORK_TYPE_LABELS[ht].ar : HOMEWORK_TYPE_LABELS[ht].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">{language === 'ar' ? 'المادة' : 'Subject'}</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as TeacherSubject | 'comprehensive')}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20 bg-white"
            >
              <option value="comprehensive">comprehensive</option>
              {ALLOWED_TEACHER_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">{language === 'ar' ? 'مستوى المنهج' : 'Curriculum Level'}</label>
            <select
              value={level}
              onChange={() => {
                setLevel(1);
                setSelectedLessons([]);
              }}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20 bg-white"
            >
              <option value={1}>{language === 'ar' ? 'التأسيس — المستكشفون الصغار (١–٤ سنوات)' : 'Track 1 · Foundations (Ages 1–4)'}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
          <div>
            <label className="block mb-1">{language === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20"
            />
          </div>
          <div>
            <label className="block mb-1">{language === 'ar' ? 'الموعد النهائي للتسليم' : 'Submission Deadline'}</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20"
            />
          </div>
          <div>
            <label className="block mb-1">{language === 'ar' ? 'أقصى عدد محاولات' : 'Max Attempts'}</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl border border-[#27345C]/20"
            />
          </div>
        </div>

        {/* Linked Lessons */}
        <div className="space-y-1.5 text-xs font-bold">
          <label className="block">
            {language === 'ar' ? `الدروس المرتبطة (${selectedLessons.length})` : `Linked Curriculum Lessons (${selectedLessons.length})`}
          </label>
          <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-[#27345C]/12 bg-[#FFF8E9]/40">
            {lessonsForLevel.map((ls) => {
              const picked = selectedLessons.includes(ls.id);
              return (
                <button
                  key={ls.id}
                  type="button"
                  onClick={() =>
                    setSelectedLessons((prev) =>
                      picked ? prev.filter((x) => x !== ls.id) : [...prev, ls.id],
                    )
                  }
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg border cursor-pointer ${
                    picked ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-white border-[#27345C]/15'
                  }`}
                >
                  {ls.id} · {t(ls.title, language)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Question Bank items */}
        {questions.length > 0 && (
          <div className="space-y-1.5 text-xs font-bold">
            <label className="block">
              {language === 'ar'
                ? `أسئلة المعلم المرفقة (اختياري · ${selectedQIds.length})`
                : `Attach Question Bank Items (optional · ${selectedQIds.length})`}
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 p-2.5 rounded-xl border border-[#27345C]/12">
              {questions.map((q) => {
                const picked = selectedQIds.includes(q.id);
                return (
                  <label key={q.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={(e) =>
                        setSelectedQIds((p) =>
                          e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id),
                        )
                      }
                    />
                    <span>
                      [{q.lessonId}] {q.promptAr || q.promptEn} ({q.marks} pts)
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Attachments Upload */}
        <div className="space-y-2 text-xs font-bold">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-[#8054D9]" />
              <span>{language === 'ar' ? 'مرفقات تعليمية (PNG, JPG, WEBP, MP3, WAV, PDF)' : 'Safe Educational Attachments'}</span>
            </label>
            <label className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E5F6FF] border border-[#39BDF2] text-[#27345C] flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4 text-[#39BDF2]" />
              <span>{uploadingAtt ? 'Uploading...' : language === 'ar' ? 'رفع ملف' : 'Upload Attachment'}</span>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.mp3,.wav,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadAttachment(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <span key={att.id} className="px-2.5 py-1 rounded-lg bg-[#FFF8E9] border border-[#27345C]/15">
                  {att.fileName} ({att.kind})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Assign to Classes / Students */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
          <div>
            <label className="block mb-1">{language === 'ar' ? 'إسناد إلى فصولي' : 'Assign to My Classes'}</label>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const picked = selectedClassIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedClassIds((p) =>
                        picked ? p.filter((x) => x !== c.id) : [...p, c.id],
                      )
                    }
                    className={`min-h-[40px] px-3 py-1 rounded-xl border cursor-pointer ${
                      picked ? 'bg-[#8054D9] text-white border-[#8054D9]' : 'bg-[#FFF8E9]'
                    }`}
                  >
                    {c.name} ({c.students.length})
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-1">{language === 'ar' ? 'أو طلاب محددين' : 'Or Individual Assigned Students'}</label>
            <div className="flex flex-wrap gap-1.5">
              {students.map((st) => {
                const picked = selectedStudentIds.includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setSelectedStudentIds((p) =>
                        picked ? p.filter((x) => x !== st.id) : [...p, st.id],
                      )
                    }
                    className={`min-h-[40px] px-3 py-1 rounded-xl border cursor-pointer ${
                      picked ? 'bg-[#39BDF2] text-white border-[#39BDF2]' : 'bg-white'
                    }`}
                  >
                    {st.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
          />
          <span>
            {featureFlags.requireTeacherContentApproval
              ? language === 'ar'
                ? 'إرسال للموافقة والنشر مباشرة'
                : 'Submit for Admin Approval & Publish'
              : language === 'ar'
                ? 'نشر الواجب للطلاب مباشرة'
                : 'Publish immediately to assigned students'}
          </span>
        </label>

        <button
          type="submit"
          className="nono-btn-tactile min-h-[44px] px-6 py-2.5 rounded-xl bg-[#8054D9] text-white font-extrabold text-xs cursor-pointer flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{language === 'ar' ? 'حفظ وإسناد الواجب' : 'Create & Assign Homework'}</span>
        </button>
      </form>

      {/* EXISTING HOMEWORKS LIST + TRACKING */}
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#39BDF2]" />
            <span>
              {language === 'ar'
                ? `واجباتي ومتابعة الإنجاز (${homeworks.length})`
                : `My Homework Assignments (${homeworks.length})`}
            </span>
          </h3>
          {loading && <span className="text-xs font-bold text-[#8054D9]">Loading...</span>}
        </div>

        {homeworks.length === 0 ? (
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'لم تنشئ أي واجب منزلي بعد.' : 'No homework assignments created yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {homeworks.map((hw) => (
              <div
                key={hw.id}
                className="p-4 rounded-2xl border border-[#27345C]/12 bg-[#FFF8E9]/45 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                      <span className="px-2 py-0.5 rounded-lg bg-[#27345C] text-white">{hw.status}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-[#8054D9]/15 text-[#8054D9]">
                        {hw.homeworkType}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-[#27345C]/15 tabular-nums">
                        v{hw.version}
                      </span>
                      <span className="text-[#27345C]/70 tabular-nums">
                        <Calendar className="w-3 h-3 inline me-1" />
                        Due: {new Date(hw.deadline).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-base text-[#27345C] mt-1">{t(hw.title, language)}</h4>
                    {hw.adminFeedback && (
                      <p className="text-xs font-bold text-[#9A3412] mt-1">
                        Admin feedback: {hw.adminFeedback}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => void openTracking(hw.id)}
                      className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#39BDF2] text-white font-extrabold cursor-pointer flex items-center gap-1.5"
                    >
                      <Users className="w-4 h-4" />
                      <span>{language === 'ar' ? 'متابعة وتصحيح' : 'Track & Grade'}</span>
                    </button>
                    {hw.status === 'draft' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/teacher/content/homework/${hw.id}/submit-review`, {
                            method: 'POST',
                          });
                          onNotice('Submitted homework for Admin review.');
                          await loadHomeworks();
                        }}
                        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#FFD84D] text-[#27345C] font-extrabold cursor-pointer"
                      >
                        {language === 'ar' ? 'إرسال للمراجعة' : 'Submit Review'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openVersions(hw.id)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white border border-[#27345C]/15 cursor-pointer flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Versions</span>
                    </button>
                  </div>
                </div>

                {/* Live Completion Funnel Metrics */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[11px] font-bold">
                  {[
                    { k: language === 'ar' ? 'مسند' : 'Assigned', v: hw.stats.assigned },
                    { k: language === 'ar' ? 'فتح' : 'Opened', v: hw.stats.opened },
                    { k: language === 'ar' ? 'بدأ' : 'Started', v: hw.stats.started },
                    { k: language === 'ar' ? 'سلّم' : 'Submitted', v: hw.stats.submitted },
                    { k: language === 'ar' ? 'مكتمل' : 'Completed', v: hw.stats.completed },
                    { k: language === 'ar' ? 'متأخر' : 'Overdue', v: hw.stats.overdue },
                  ].map((m) => (
                    <div key={m.k} className="p-2 rounded-xl bg-white border border-[#27345C]/10">
                      <p className="text-[#27345C]/60">{m.k}</p>
                      <p className="text-sm font-extrabold text-[#27345C] tabular-nums">{m.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TRACKING & GRADING DRAWER */}
      {trackingHw && (
        <div className="nono-card p-5 bg-[#F4EEFF]/60 border-2 border-[#8054D9]/35 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-extrabold text-base text-[#27345C]">
              {language === 'ar' ? 'تفاصيل متابعة الطلاب:' : 'Student Tracking:'} {t(trackingHw.title, language)}
            </h3>
            <button
              type="button"
              onClick={() => setTrackingHw(null)}
              className="min-h-[40px] px-3 rounded-xl bg-white border font-bold text-xs cursor-pointer"
            >
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>

          <div className="space-y-2.5">
            {trackingRows.map((row) => (
              <div key={row.id} className="p-3.5 rounded-2xl bg-white border border-[#27345C]/12 space-y-2 text-xs font-bold">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-sm text-[#27345C]">{row.studentName}</p>
                    <p className="text-[#27345C]/65">
                      Status: <span className="text-[#8054D9]">{row.effectiveStatus}</span>
                      {row.openedAt ? ` · Opened ${new Date(row.openedAt).toLocaleDateString()}` : ''}
                      {row.submittedAt ? ` · Submitted ${new Date(row.submittedAt).toLocaleDateString()}` : ''}
                      {row.percentage !== undefined ? ` · Score ${row.percentage}%` : ''}
                    </p>
                    {row.textResponse && (
                      <p className="mt-1 p-2 rounded-xl bg-[#FFF8E9] text-[#27345C]">
                        <FileText className="w-3.5 h-3.5 inline me-1" />
                        Student answer: {row.textResponse}
                      </p>
                    )}
                    {row.teacherFeedback && (
                      <p className="mt-1 text-[#166534]">Feedback sent: {row.teacherFeedback}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExtendSubId(extendSubId === row.id ? null : row.id);
                        setGradeSubId(null);
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-[#FFF8E9] border border-[#FFD84D] text-[#27345C] cursor-pointer flex items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تمديد الموعد' : 'Extend Deadline'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGradeSubId(gradeSubId === row.id ? null : row.id);
                        setExtendSubId(null);
                        setGradePct(row.percentage ?? 90);
                        setGradeFeedback(row.teacherFeedback || '');
                      }}
                      className="min-h-[40px] px-3 rounded-xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تقييم وملاحظات' : 'Grade / Feedback'}</span>
                    </button>
                  </div>
                </div>

                {extendSubId === row.id && (
                  <div className="p-3 rounded-xl bg-[#FFF8E9] flex flex-wrap items-center gap-2">
                    <input
                      type="datetime-local"
                      value={extendDate}
                      onChange={(e) => setExtendDate(e.target.value)}
                      className="h-9 px-2 rounded-lg border bg-white"
                    />
                    <input
                      type="text"
                      value={extendReason}
                      onChange={(e) => setExtendReason(e.target.value)}
                      placeholder="Extension reason"
                      className="h-9 px-2 rounded-lg border bg-white flex-1 min-w-[160px]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleExtendDeadline(row.id)}
                      className="h-9 px-3 rounded-lg bg-[#8054D9] text-white cursor-pointer"
                    >
                      Apply Extension
                    </button>
                  </div>
                )}

                {gradeSubId === row.id && (
                  <div className="p-3 rounded-xl bg-[#E2F9EC] flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradePct}
                      onChange={(e) => setGradePct(Number(e.target.value))}
                      className="h-9 w-20 px-2 rounded-lg border bg-white"
                    />
                    <input
                      type="text"
                      value={gradeFeedback}
                      onChange={(e) => setGradeFeedback(e.target.value)}
                      placeholder="Encouraging teacher feedback for student & parent..."
                      className="h-9 px-2 rounded-lg border bg-white flex-1 min-w-[180px]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleGradeSubmission(row.id)}
                      className="h-9 px-3 rounded-lg bg-[#27345C] text-white cursor-pointer"
                    >
                      Save Grade
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {versionModal && (
        <div className="nono-card p-5 bg-white border-2 border-[#8054D9] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm">Version History — {versionModal.id}</h4>
            <button
              type="button"
              onClick={() => setVersionModal(null)}
              className="px-3 py-1 rounded-lg bg-slate-100 font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
          {versionModal.versions.length === 0 ? (
            <p className="font-bold text-[#27345C]/65">Initial version v1 — no prior edits archived yet.</p>
          ) : (
            versionModal.versions.map((v) => (
              <div key={v.version} className="p-2.5 rounded-xl bg-[#FFF8E9]">
                <p className="font-extrabold">
                  v{v.version} · {v.editedByName} · {new Date(v.editedAt).toLocaleString()}
                </p>
                <p className="text-[#27345C]/70">{v.reason}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
