import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Flag,
  History,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Upload,
} from 'lucide-react';
import { useNonoLand } from '../context/NonoLandContext';
import { t } from '../i18n/translations';
import type {
  ContentGovernanceStatus,
  ContentVersionEntry,
  FeatureFlags,
  HomeworkAssignment,
  QuestionQualityFlag,
  SecurityEventLog,
  TeacherExam,
  TeacherQuestion,
} from '../types/nonoland';
import { DEFAULT_FEATURE_FLAGS } from '../utils/validation';

interface GovernanceProps {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

const FLAG_META: Array<{ key: keyof FeatureFlags; ar: string; en: string; desc: string }> = [
  { key: 'teacherHomeworkEnabled', ar: 'تفعيل نظام الواجبات المدرسية', en: 'Teacher Homework Module', desc: 'Enables homework creation, attachments, tracking, and student submission.' },
  { key: 'paidAssessmentsEnabled', ar: 'تفعيل الامتحانات الرسمية المدفوعة', en: 'Official Paid Assessments', desc: 'Controls official 40-question exam checkout gate.' },
  { key: 'certificatesEnabled', ar: 'تفعيل إصدار الشهادات الموثّقة', en: 'Certificates Issuance', desc: 'Issues verifiable PDF/QR certificates on completion/pass.' },
  { key: 'offlineLearningEnabled', ar: 'تفعيل وضع عدم الاتصال والمزامنة', en: 'Offline Learning & Sync', desc: 'Enables idempotent offline activity queue & /api/student/sync.' },
  { key: 'newSubjectsEnabled', ar: 'تفعيل المواد الجديدة', en: 'New Curriculum Subjects', desc: 'Controls newly introduced subjects and tracks.' },
  { key: 'newGameModulesEnabled', ar: 'تفعيل الألعاب التعليمية الجديدة', en: 'New Interactive Game Modules', desc: 'Controls experimental/newly published mini-games.' },
  { key: 'requireTeacherContentApproval', ar: 'اشتراط موافقة الإدارة قبل نشر محتوى المعلم', en: 'Require Admin Approval for Teacher Content', desc: 'Forces teacher exams/homework/questions through Admin approval queue before students see them.' },
  { key: 'quranWorldEnabled', ar: 'تفعيل عالم القرآن الكريم (١–٤ سنوات)', en: 'Quran World Module (Ages 1–4)', desc: 'Controls child access to Quran World Surahs, Listen & Repeat, Stories, and Islamic Manners.' },
];

export const AdminGovernancePanel: React.FC<GovernanceProps> = ({
  apiFetch,
  onNotice,
  onError,
}) => {
  const { language } = useNonoLand();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [queue, setQueue] = useState<{
    questions: Array<TeacherQuestion & { teacherName: string }>;
    exams: Array<TeacherExam & { teacherName: string }>;
    homeworks: Array<HomeworkAssignment & { teacherName: string }>;
  }>({ questions: [], exams: [], homeworks: [] });

  const [auditReport, setAuditReport] = useState<{
    totalChecked: number;
    flaggedCount: number;
    questions: Array<{
      id: string;
      lessonId: string;
      subject: string;
      promptAr: string;
      promptEn: string;
      qualityFlags: QuestionQualityFlag[];
    }>;
  } | null>(null);

  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [versionsModal, setVersionsModal] = useState<{
    title: string;
    versions: ContentVersionEntry[];
  } | null>(null);

  const loadQueue = useCallback(async () => {
    const qStr = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await apiFetch(`/api/admin/content/review-queue${qStr}`);
    if (res.ok) {
      setQueue(await res.json());
    }
  }, [apiFetch, statusFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const runQualityAudit = async () => {
    onError('');
    const res = await apiFetch('/api/admin/questions/quality-audit', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return onError(data.error || 'Quality audit failed');
    setAuditReport(data);
    onNotice(`Quality audit checked ${data.totalChecked} question(s); found ${data.flaggedCount} flagged.`);
    await loadQueue();
  };

  const reviewItem = async (
    kind: 'question' | 'exam' | 'homework',
    id: string,
    status: ContentGovernanceStatus,
  ) => {
    onError('');
    const res = await apiFetch(`/api/admin/content/${kind}/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, feedback: feedbackMap[id] || '' }),
    });
    const data = await res.json();
    if (!res.ok) return onError(data.error || 'Review action failed');
    onNotice(`Updated ${kind} ${id} -> ${status}`);
    await loadQueue();
  };

  const viewVersions = async (kind: 'question' | 'exam' | 'homework', id: string) => {
    const res = await apiFetch(`/api/content/${kind}/${id}/versions`);
    if (res.ok) {
      const d = await res.json();
      setVersionsModal({ title: `${kind} ${id} (v${d.currentVersion})`, versions: d.versions || [] });
    }
  };

  return (
    <div className="space-y-5">
      {/* Automated Question Quality Checker */}
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
              <Flag className="w-5 h-5 text-[#FF9360]" />
              <span>{language === 'ar' ? 'مدقق جودة الأسئلة الآلي' : 'Automated Question Quality Checker'}</span>
            </h3>
            <p className="text-xs font-bold text-[#27345C]/65">
              {language === 'ar'
                ? 'يفحص غياب الترجمة، غياب الوسائط، تكرار الأسئلة، صحة الدرجات وتطابق الدرس والمادة.'
                : 'Checks missing AR/EN text, missing audio/visuals, duplicates, broken media URLs, invalid marks & lesson-subject mismatches.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runQualityAudit()}
            className="nono-btn-tactile min-h-[44px] px-5 py-2 rounded-xl bg-[#8054D9] text-white font-extrabold text-xs cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{language === 'ar' ? 'تشغيل فحص الجودة الآن' : 'Run Quality Audit'}</span>
          </button>
        </div>

        {auditReport && (
          <div className="space-y-2.5 text-xs font-bold">
            <p className="text-[#27345C]">
              Checked: {auditReport.totalChecked} · Flagged:{' '}
              <span className={auditReport.flaggedCount > 0 ? 'text-[#991B1B]' : 'text-[#166534]'}>
                {auditReport.flaggedCount}
              </span>
            </p>
            {auditReport.questions.map((fq) => (
              <div key={fq.id} className="p-3 rounded-2xl bg-[#FFF3D1] border border-[#FFD84D] space-y-1">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-extrabold text-[#27345C]">
                    [{fq.lessonId} · {fq.subject}] {fq.promptAr || fq.promptEn}
                  </span>
                  <div className="flex gap-1.5">
                    {fq.qualityFlags.map((fl) => (
                      <span key={fl.code} title={fl.message} className="px-2 py-0.5 rounded-lg bg-[#991B1B] text-white text-[10px]">
                        {fl.code}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Review Queue */}
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#55D98B]" />
            <span>{language === 'ar' ? 'طابور مراجعة واعتماد المحتوى' : 'Content Approval & Governance Queue'}</span>
          </h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          >
            <option value="">All Statuses</option>
            <option value="pending-review">Pending Review</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Questions Review */}
        {(['question', 'exam', 'homework'] as const).map((kind) => {
          const items =
            kind === 'question' ? queue.questions : kind === 'exam' ? queue.exams : queue.homeworks;
          return (
            <div key={kind} className="space-y-2.5">
              <h4 className="text-xs font-extrabold uppercase text-[#8054D9] tracking-wide">
                {kind === 'question'
                  ? `Teacher Questions (${items.length})`
                  : kind === 'exam'
                    ? `Teacher Exams (${items.length})`
                    : `Teacher Homework (${items.length})`}
              </h4>
              {items.length === 0 ? (
                <p className="text-xs font-bold text-[#27345C]/55">No items matching current filter.</p>
              ) : (
                items.map((raw) => {
                  const status =
                    kind === 'question'
                      ? (raw as TeacherQuestion).approvalStatus || 'published'
                      : (raw as TeacherExam | HomeworkAssignment).status;
                  const titleText =
                    kind === 'question'
                      ? (raw as TeacherQuestion).promptAr || (raw as TeacherQuestion).promptEn
                      : t((raw as TeacherExam | HomeworkAssignment).title, language);
                  const teacherName = (raw as { teacherName: string }).teacherName;
                  const versionNum = (raw as { version?: number }).version || 1;
                  const qFlags =
                    kind === 'question' ? (raw as TeacherQuestion).qualityFlags || [] : [];

                  return (
                    <div
                      key={raw.id}
                      className="p-3.5 rounded-2xl border border-[#27345C]/12 bg-[#FFF8E9]/45 space-y-2 text-xs font-bold"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-lg bg-[#27345C] text-white">{status}</span>
                            <span className="px-2 py-0.5 rounded-lg bg-white border tabular-nums">
                              v{versionNum}
                            </span>
                            <span className="text-[#27345C]/70">By {teacherName}</span>
                            {qFlags.map((fl) => (
                              <span key={fl.code} title={fl.message} className="px-2 py-0.5 rounded-lg bg-[#FF6B6B]/20 text-[#991B1B]">
                                ⚠ {fl.code}
                              </span>
                            ))}
                          </div>
                          <p className="font-extrabold text-sm text-[#27345C] mt-1">{titleText}</p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => void reviewItem(kind, raw.id, 'published')}
                            className="min-h-[38px] px-3 rounded-lg bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer"
                          >
                            Approve & Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewItem(kind, raw.id, 'rejected')}
                            className="min-h-[38px] px-3 rounded-lg bg-[#FFD84D] text-[#78350F] font-extrabold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => void reviewItem(kind, raw.id, 'suspended')}
                            className="min-h-[38px] px-3 rounded-lg bg-[#FF6B6B]/20 text-[#991B1B] font-extrabold cursor-pointer"
                          >
                            Suspend
                          </button>
                          <button
                            type="button"
                            onClick={() => void viewVersions(kind, raw.id)}
                            className="min-h-[38px] px-2.5 rounded-lg bg-white border border-[#27345C]/15 cursor-pointer flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>History</span>
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={feedbackMap[raw.id] || ''}
                        onChange={(e) => setFeedbackMap((p) => ({ ...p, [raw.id]: e.target.value }))}
                        placeholder="Optional review feedback for teacher..."
                        className="w-full h-9 px-3 rounded-xl border border-[#27345C]/15 bg-white"
                      />
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {versionsModal && (
        <div className="nono-card p-5 bg-white border-2 border-[#8054D9] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm">Version Audit — {versionsModal.title}</h4>
            <button
              type="button"
              onClick={() => setVersionsModal(null)}
              className="px-3 py-1 rounded-lg bg-slate-100 font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
          {versionsModal.versions.length === 0 ? (
            <p className="font-bold text-[#27345C]/65">No historical versions recorded yet.</p>
          ) : (
            versionsModal.versions.map((v) => (
              <div key={v.version} className="p-3 rounded-xl bg-[#FFF8E9] space-y-1">
                <p className="font-extrabold">
                  v{v.version} · {v.editedByName} · {new Date(v.editedAt).toLocaleString()}
                </p>
                <p className="text-[#27345C]/75">Reason: {v.reason}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const AdminOpsPanel: React.FC<GovernanceProps> = ({ apiFetch, onNotice, onError }) => {
  const { language, refreshFeatureFlags } = useNonoLand();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [integrity, setIntegrity] = useState<{
    healthy: boolean;
    checkedAt: string;
    issueCount: number;
    issues: string[];
    counts: Record<string, number>;
    operationalMetrics: {
      totalRequests: number;
      apiErrors: number;
      syncFailures: number;
      lastErrorAt?: string;
      lastErrorMessage?: string;
    };
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<SecurityEventLog[]>([]);
  const [eventFilter, setEventFilter] = useState('');
  const [recordFilter, setRecordFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const loadOps = useCallback(async () => {
    const qs = new URLSearchParams();
    if (eventFilter) qs.set('eventType', eventFilter);
    if (recordFilter) qs.set('recordType', recordFilter);
    if (roleFilter) qs.set('actorRole', roleFilter);
    if (outcomeFilter) qs.set('outcome', outcomeFilter);
    if (auditSearch.trim()) qs.set('q', auditSearch.trim());
    const auditUrl = `/api/admin/audit-logs${qs.toString() ? `?${qs.toString()}` : ''}`;

    const [fRes, iRes, lRes] = await Promise.all([
      apiFetch('/api/config/features'),
      apiFetch('/api/admin/ops/integrity'),
      apiFetch(auditUrl),
    ]);
    if (fRes.ok) {
      const fd = await fRes.json();
      if (fd.featureFlags) setFlags(fd.featureFlags);
    }
    if (iRes.ok) setIntegrity(await iRes.json());
    if (lRes.ok) setAuditLogs((await lRes.json()).logs || []);
  }, [apiFetch, eventFilter, recordFilter, roleFilter, outcomeFilter, auditSearch]);

  useEffect(() => {
    void loadOps();
  }, [loadOps]);

  const handleSaveFlags = async (next: FeatureFlags) => {
    onError('');
    setFlags(next);
    const res = await apiFetch('/api/admin/feature-flags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    const d = await res.json();
    if (!res.ok) return onError(d.error || 'Could not update feature flags');
    await refreshFeatureFlags();
    onNotice('Feature flags updated & persisted.');
    await loadOps();
  };

  const handleDownloadBackup = async () => {
    onError('');
    const res = await apiFetch('/api/admin/ops/backup');
    const data = await res.json();
    if (!res.ok) return onError(data.error || 'Backup export failed');
    const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nonoland-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotice('Sanitized backup snapshot downloaded.');
  };

  const handleRestoreFile = async (file: File) => {
    onError('');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const res = await apiFetch('/api/admin/ops/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsed }),
      });
      const d = await res.json();
      if (!res.ok) return onError(d.error || 'Restore failed');
      onNotice('Database restored cleanly from backup.');
      await loadOps();
    } catch {
      onError('Invalid JSON backup file');
    }
  };

  return (
    <div className="space-y-5">
      {/* Feature Flags */}
      <div className="nono-card p-5 bg-white space-y-4">
        <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[#8054D9]" />
          <span>{language === 'ar' ? 'مفاتيح التحكم بالميزات (Feature Flags)' : 'Live Platform Feature Flags'}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
          {FLAG_META.map((fm) => (
            <label
              key={fm.key}
              className="p-3.5 rounded-2xl bg-[#FFF8E9]/70 border border-[#27345C]/12 flex items-start justify-between gap-3 cursor-pointer"
            >
              <div>
                <p className="font-extrabold text-sm text-[#27345C]">
                  {language === 'ar' ? fm.ar : fm.en}
                </p>
                <p className="text-[#27345C]/65 mt-0.5">{fm.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={flags[fm.key]}
                onChange={(e) =>
                  void handleSaveFlags({ ...flags, [fm.key]: e.target.checked })
                }
                className="w-5 h-5 accent-[#8054D9] shrink-0 mt-1"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Operational Health, DB Integrity & Backup/Restore */}
      <div className="nono-card p-5 bg-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Database className="w-5 h-5 text-[#39BDF2]" />
            <span>{language === 'ar' ? 'سلامة البيانات والنسخ الاحتياطي' : 'Operations, DB Integrity & Backup'}</span>
          </h3>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => void loadOps()}
              className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Integrity Check</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadBackup()}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#55D98B] text-[#27345C] font-extrabold cursor-pointer flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup</span>
            </button>
            <label className="min-h-[40px] px-3.5 rounded-xl bg-[#8054D9] text-white font-extrabold cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore JSON</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleRestoreFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {integrity && (
          <div className="space-y-3 text-xs font-bold">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`px-3 py-1 rounded-lg inline-flex items-center gap-1.5 font-extrabold ${
                  integrity.healthy ? 'bg-[#55D98B]/25 text-[#14532D]' : 'bg-[#FF6B6B]/20 text-[#991B1B]'
                }`}
              >
                {integrity.healthy ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {integrity.healthy ? 'DB Integrity Verified (0 Orphan Records)' : `${integrity.issueCount} Integrity Issue(s)`}
              </span>
              <span className="text-[#27345C]/65 tabular-nums">
                API Requests: {integrity.operationalMetrics.totalRequests} · Errors: {integrity.operationalMetrics.apiErrors} · Sync Failures: {integrity.operationalMetrics.syncFailures}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(integrity.counts).map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-xl bg-[#FFF8E9] border border-[#27345C]/10">
                  <p className="text-[#27345C]/60">{k}</p>
                  <p className="text-lg font-extrabold text-[#27345C] tabular-nums">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="nono-card p-5 bg-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#8054D9]" />
            <span>{language === 'ar' ? 'سجل التدقيق الأمني المحمي (غير قابل للتعديل)' : 'Immutable Security Audit Trail'}</span>
          </h3>
          <span className="text-[11px] font-extrabold text-[#27345C]/65">
            {auditLogs.length} {language === 'ar' ? 'سجل مطابق' : 'matching entries'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <input
            type="text"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder={language === 'ar' ? 'بحث في الملخص أو المعرّف...' : 'Search summary, actor, recordId...'}
            className="h-9 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          />
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          >
            <option value="">All Event Types</option>
            <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
            <option value="AUTH_LOGIN_FAIL">AUTH_LOGIN_FAIL</option>
            <option value="AUTH_REGISTER">AUTH_REGISTER</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="ACCESS_DENIED">ACCESS_DENIED</option>
            <option value="ADMIN_ACTION">ADMIN_ACTION</option>
            <option value="TEACHER_ACTION">TEACHER_ACTION</option>
            <option value="CONTENT_REVIEW">CONTENT_REVIEW</option>
            <option value="FEATURE_FLAG_CHANGE">FEATURE_FLAG_CHANGE</option>
            <option value="AI_SAFETY_BLOCK">AI_SAFETY_BLOCK</option>
            <option value="PARENT_SETTING_CHANGE">PARENT_SETTING_CHANGE</option>
            <option value="SMART_ASSESSMENT">SMART_ASSESSMENT</option>
            <option value="READING_STAGE_COMPLETE">READING_STAGE_COMPLETE</option>
            <option value="FAMILY_ACTIVITY">FAMILY_ACTIVITY</option>
            <option value="ENTERTAINMENT_SAVE">ENTERTAINMENT_SAVE</option>
            <option value="REWARD_REDEEM">REWARD_REDEEM</option>
            <option value="HOMEWORK_ACTION">HOMEWORK_ACTION</option>
            <option value="OFFLINE_SYNC">OFFLINE_SYNC</option>
            <option value="BACKUP_RESTORE">BACKUP_RESTORE</option>
          </select>
          <select
            value={recordFilter}
            onChange={(e) => setRecordFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          >
            <option value="">All Record Types</option>
            <option value="user">user</option>
            <option value="session">session</option>
            <option value="child">child</option>
            <option value="exam">exam</option>
            <option value="exam_attempt">exam_attempt</option>
            <option value="assessment">assessment</option>
            <option value="reading_stage">reading_stage</option>
            <option value="family_activity">family_activity</option>
            <option value="entertainment">entertainment</option>
            <option value="reward">reward</option>
            <option value="ai_chat">ai_chat</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          >
            <option value="">All Actor Roles</option>
            <option value="super_admin">super_admin</option>
            <option value="admin">admin</option>
            <option value="teacher">teacher</option>
            <option value="parent">parent</option>
            <option value="student">student</option>
          </select>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-[#27345C]/20 text-xs font-bold bg-white"
          >
            <option value="">All Outcomes</option>
            <option value="success">success</option>
            <option value="blocked">blocked</option>
            <option value="denied">denied</option>
            <option value="error">error</option>
          </select>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 text-xs font-bold">
          {auditLogs.length === 0 ? (
            <p className="text-center py-6 text-[#27345C]/60">
              {language === 'ar' ? 'لا توجد سجلات مطابقة لهذا البحث.' : 'No audit records match these filters.'}
            </p>
          ) : (
            auditLogs.map((lg) => (
              <div key={lg.id} className="p-3 rounded-xl bg-[#FFF8E9]/70 border border-[#27345C]/10 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-[#27345C] text-white text-[10px]">
                      {lg.eventType}
                    </span>
                    {lg.outcome && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          lg.outcome === 'denied' || lg.outcome === 'blocked'
                            ? 'bg-[#FF4D6D]/15 text-[#991B1B]'
                            : lg.outcome === 'error'
                              ? 'bg-[#FF9360]/20 text-[#9A3412]'
                              : 'bg-[#55D98B]/25 text-[#14532D]'
                        }`}
                      >
                        {lg.outcome}
                      </span>
                    )}
                    {lg.recordType && (
                      <span className="px-2 py-0.5 rounded bg-white border border-[#27345C]/10 text-[10px] text-[#8054D9]">
                        {lg.recordType}
                        {lg.recordId ? `:${lg.recordId}` : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-[#27345C]/55 tabular-nums text-[11px]">
                    {lg.actorRole || lg.role || 'anon'}
                    {lg.actorId ? ` (${lg.actorId})` : ''} · {new Date(lg.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-[#27345C]">{lg.summary}</p>
                {(lg.reason || lg.previousValue !== undefined || lg.newValue !== undefined) && (
                  <p className="text-[11px] text-[#27345C]/70 font-mono-num break-all">
                    {lg.reason ? `Reason: ${lg.reason} · ` : ''}
                    {lg.previousValue !== undefined ? `Prev: ${lg.previousValue} → ` : ''}
                    {lg.newValue !== undefined ? `New: ${lg.newValue}` : ''}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
