import React, { useEffect, useState } from 'react';
import { Download, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import {
  ContentPermissionPolicy,
  DataGovernanceRequest,
  FamilyPrivacySettings,
  PrivacyConsentRecord,
} from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';
import { LegalDocumentsModal } from '../LegalDocumentsModal';
import { familyApi } from './shared';

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const ContentPrivacyPanel: React.FC<Props> = ({ gateVerified, onRequestGateUnlock }) => {
  const { authSession, language, refreshChildrenList } = useNonoLand();
  const [policy, setPolicy] = useState<ContentPermissionPolicy | null>(null);
  const [privacy, setPrivacy] = useState<FamilyPrivacySettings | null>(null);
  const [consents, setConsents] = useState<PrivacyConsentRecord[]>([]);
  const [requests, setRequests] = useState<DataGovernanceRequest[]>([]);
  const [deleteNote, setDeleteNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');
  const [legalDocOpen, setLegalDocOpen] = useState<'privacy' | 'terms' | null>(null);

  const loadAll = async () => {
    if (!authSession.authenticated) return;
    const [pRes, privRes] = await Promise.all([
      familyApi<{ policy: ContentPermissionPolicy }>('/api/family/content-policy', authSession.csrfToken),
      familyApi<{
        settings: FamilyPrivacySettings;
        consents: PrivacyConsentRecord[];
        dataRequests: DataGovernanceRequest[];
      }>('/api/family/privacy', authSession.csrfToken),
    ]);
    if (pRes.ok && pRes.data) setPolicy(pRes.data.policy);
    if (privRes.ok && privRes.data) {
      setPrivacy(privRes.data.settings);
      setConsents(privRes.data.consents || []);
      setRequests(privRes.data.dataRequests || []);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [authSession.authenticated]);

  const updatePolicy = async (patch: Partial<ContentPermissionPolicy>) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setSaving(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ policy: ContentPermissionPolicy }>(
      '/api/family/content-policy',
      authSession.csrfToken,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
    setSaving(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not update policy');
      return;
    }
    if (res.data?.policy) {
      setPolicy(res.data.policy);
      await refreshChildrenList();
      soundEngine.playPop();
      setNotice(language === 'ar' ? 'تم حفظ ضوابط المحتوى ✓' : 'Content policy saved ✓');
    }
  };

  const updatePrivacy = async (patch: Partial<FamilyPrivacySettings>) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setSaving(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{
      settings: FamilyPrivacySettings;
      policy: ContentPermissionPolicy;
      consents: PrivacyConsentRecord[];
    }>('/api/family/privacy', authSession.csrfToken, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not update privacy settings');
      return;
    }
    if (res.data) {
      setPrivacy(res.data.settings);
      setPolicy(res.data.policy);
      setConsents(res.data.consents || []);
      await refreshChildrenList();
      soundEngine.playSuccess();
      setNotice(
        language === 'ar'
          ? 'تم تحديث إعدادات الخصوصية والموافقات وتطبيقها فوراً ✓'
          : 'Privacy & consent settings updated and enforced immediately ✓',
      );
    }
  };

  const handleExportFamily = async () => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setSaving(true);
    setErr('');
    const res = await familyApi<{ request: DataGovernanceRequest; exportPackage: Record<string, unknown> }>(
      '/api/family/privacy/export',
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({}) },
    );
    setSaving(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Export failed');
      return;
    }
    if (res.data) {
      setRequests((prev) => [res.data!.request, ...prev]);
      const blob = new Blob([JSON.stringify(res.data.exportPackage, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nonoland-family-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(language === 'ar' ? 'تم تصدير أرشيف بيانات العائلة بنجاح ✓' : 'Family data archive downloaded ✓');
    }
  };

  const handleDeleteRequest = async () => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setSaving(true);
    setErr('');
    const res = await familyApi<{ request: DataGovernanceRequest }>(
      '/api/family/privacy/delete-request',
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({ note: deleteNote }) },
    );
    setSaving(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not submit deletion request');
      return;
    }
    if (res.data?.request) {
      setRequests((prev) => [res.data!.request, ...prev]);
      setDeleteNote('');
      setNotice(language === 'ar' ? 'تم تسجيل طلب حذف البيانات رسمياً.' : 'Data deletion request recorded.');
    }
  };

  return (
    <div className="space-y-5">
      {err && <div className="p-3 rounded-2xl bg-[#FEF2F2] text-xs font-extrabold text-[#991B1B]">{err}</div>}
      {notice && <div className="p-3 rounded-2xl bg-[#DCFCE7] text-xs font-extrabold text-[#15803D]">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Content Approval Controls */}
        <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#8054D9]" />
            <span>{language === 'ar' ? 'الموافقات وضوابط المحتوى العائلي' : 'Content Approval & Age Controls'}</span>
          </h2>
          {policy ? (
            <div className="space-y-2.5">
              {(
                [
                  { key: 'allowStories' as const, ar: 'القصص والحكايات المصورة', en: 'Curated Story World' },
                  { key: 'allowSongsAudio' as const, ar: 'الأناشيد والصوتيات التعليمية', en: 'Educational Songs & Audio' },
                  { key: 'allowVideos' as const, ar: 'الفيديوهات المعتمدة من الوالدين', en: 'Parent-Approved Safe Videos' },
                  { key: 'allowGamesCreative' as const, ar: 'الألعاب الذكية واستوديو الإبداع', en: 'Learning Games & Creative Studio' },
                  { key: 'aiCompanionEnabled' as const, ar: 'رفيق نونو الذكي للعائلة', en: 'Nono AI Learning Companion' },
                  { key: 'voiceInteractionEnabled' as const, ar: 'القراءة والتفاعل الصوتي لنونو', en: 'Nono Voice Companion & Speech' },
                  { key: 'ageStrictMode' as const, ar: 'وضع المستكشف الصغير الصارم (١–٤ سنوات)', en: 'Strict Little Explorers Mode (1–4 Years)' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 cursor-pointer text-xs sm:text-sm font-bold"
                >
                  <span>{item[language]}</span>
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={Boolean(policy[item.key])}
                    onChange={(e) => void updatePolicy({ [item.key]: e.target.checked })}
                    className="w-5 h-5 accent-[#8054D9]"
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#27345C]/65">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading policy...'}</p>
          )}
        </div>

        {/* Privacy Center & Consent Withdrawal */}
        <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
              <span>{language === 'ar' ? 'مركز الخصوصية والموافقات الصريحة' : 'Privacy Center & Consent Ledger'}</span>
            </h2>
            <span className="px-2.5 py-1 rounded-xl bg-[#DCFCE7] text-[#15803D] text-[11px] font-extrabold">
              {language === 'ar' ? 'ملفات خاصة بالكامل 🔒' : 'Strictly Private 🔒'}
            </span>
          </div>

          {privacy && (
            <div className="space-y-2.5">
              {(
                [
                  {
                    key: 'aiFeaturesConsent' as const,
                    ar: 'موافقة استخدام ميزات الذكاء الاصطناعي التربوي',
                    en: 'Consent for Educational AI Features (sends text safely via server proxy)',
                  },
                  {
                    key: 'voiceInteractionConsent' as const,
                    ar: 'موافقة التفاعل الصوتي والنطق الذكي',
                    en: 'Consent for Voice Synthesis & Optional Speech Input',
                  },
                  {
                    key: 'analyticsConsent' as const,
                    ar: 'موافقة تحليلات التقدم الأسبوعي والتكيفي',
                    en: 'Consent for Adaptive & Weekly Learning Analytics',
                  },
                ] as const
              ).map((c) => (
                <label
                  key={c.key}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#F4EEFF]/60 border border-[#8054D9]/15 cursor-pointer text-xs sm:text-sm font-bold"
                >
                  <span>{c[language]}</span>
                  <input
                    type="checkbox"
                    disabled={saving}
                    checked={Boolean(privacy[c.key])}
                    onChange={(e) => void updatePrivacy({ [c.key]: e.target.checked })}
                    className="w-5 h-5 accent-[#8054D9]"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-[#27345C]/10 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleExportFamily()}
                className="min-h-[40px] px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'ar' ? 'تصدير بيانات العائلة (JSON)' : 'Export Family Archive (JSON)'}</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={deleteNote}
                onChange={(e) => setDeleteNote(e.target.value)}
                placeholder={language === 'ar' ? 'سبب طلب حذف الحساب/البيانات (اختياري)' : 'Optional note for data deletion request'}
                className="flex-1 h-10 px-3 rounded-xl border border-[#27345C]/15 text-xs font-bold"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDeleteRequest()}
                className="h-10 px-3.5 rounded-xl bg-[#FEE2E2] text-[#991B1B] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'طلب حذف' : 'Request Deletion'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-bold text-[#27345C]/70">
              <span>
                {language === 'ar'
                  ? 'تُعالج طلبات حذف البيانات خلال مدة أقصاها ٣٠ يوماً (والنسخ الاحتياطية خلال ٩٠ يوماً).'
                  : 'Data deletion requests are fulfilled within 30 days (backups purged within 90 days).'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLegalDocOpen('privacy')}
                  className="underline text-[#8054D9] font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDocOpen('terms')}
                  className="underline text-[#8054D9] font-extrabold cursor-pointer"
                >
                  {language === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}
                </button>
              </div>
            </div>
          </div>

          {consents.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pt-2 border-t border-[#27345C]/10 text-[11px]">
              <p className="font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'سجل الموافقات وتاريخ السحب:' : 'Consent & Withdrawal Ledger:'}
              </p>
              {consents.slice(0, 8).map((c) => (
                <div key={c.id} className="p-2 rounded-xl bg-[#F8FAFC] flex items-center justify-between gap-2">
                  <span className="font-bold text-[#27345C]">
                    {c.consentKey} · {c.granted ? (language === 'ar' ? 'ممنوحة' : 'Granted') : (language === 'ar' ? 'تم السحب' : 'Withdrawn')}
                  </span>
                  <span className="text-[#27345C]/65">
                    {c.grantedByName} · {formatDate(c.grantedAt, language)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {requests.length > 0 && (
            <div className="text-[11px] text-[#27345C]/70">
              {language === 'ar' ? `طلبات البيانات المسجلة: ${requests.length}` : `Data requests on file: ${requests.length}`}
            </div>
          )}
        </div>
      </div>
      <LegalDocumentsModal
        open={legalDocOpen !== null}
        activeDoc={legalDocOpen || 'privacy'}
        language={language}
        onChangeDoc={(doc) => setLegalDocOpen(doc)}
        onClose={() => setLegalDocOpen(null)}
      />
    </div>
  );
};
