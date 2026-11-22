import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { getAgeGroupMeta, t } from '../../i18n/translations';
import { ChildProfile } from '../../types/nonoland';
import { UNIFIED_STAGE_ID } from '../../utils/ageAdaptation';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi, formatChildAgeLabel } from './shared';

interface CredInfo {
  hasCredentials: boolean;
  accessCode?: string;
  accessCodeMasked?: string;
  lastLoginAt?: string;
  rotatedAt?: string;
}

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const MyChildrenCredentialsPanel: React.FC<Props> = ({ gateVerified, onRequestGateUnlock }) => {
  const {
    activeChild,
    authSession,
    childrenList,
    language,
    navigate,
    refreshChildrenList,
    selectChild,
    updateChildProfile,
  } = useNonoLand();

  const [credMap, setCredMap] = useState<Record<string, CredInfo>>({});
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});
  const [busyChildId, setBusyChildId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({});
  const [errMsg, setErrMsg] = useState<Record<string, string>>({});

  // Edit profile state
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editLang, setEditLang] = useState<'ar' | 'en'>('ar');

  // Legacy student account modal state
  const [studentCredChildId, setStudentCredChildId] = useState<string | null>(null);
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentMsg, setStudentMsg] = useState('');
  const [studentErr, setStudentErr] = useState('');

  const loadCreds = async (childId: string) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setBusyChildId(childId);
    setErrMsg((p) => ({ ...p, [childId]: '' }));
    const res = await familyApi<CredInfo>(
      `/api/family/children/${encodeURIComponent(childId)}/credentials`,
      authSession.csrfToken,
    );
    setBusyChildId(null);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErrMsg((p) => ({ ...p, [childId]: res.error || 'Could not load credentials' }));
      return;
    }
    if (res.data) {
      setCredMap((prev) => ({ ...prev, [childId]: res.data! }));
    }
  };

  const saveChildCreds = async (childId: string, rotateAccessCode = false) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const pin = (pinDraft[childId] || '').trim();
    const existing = credMap[childId]?.hasCredentials;
    if (!existing && !/^\d{4,6}$/.test(pin)) {
      setErrMsg((p) => ({
        ...p,
        [childId]: language === 'ar' ? 'أدخل رقماً سرياً للطفل من ٤ إلى ٦ أرقام.' : 'Enter a 4–6 digit numeric Child PIN.',
      }));
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setErrMsg((p) => ({
        ...p,
        [childId]: language === 'ar' ? 'يجب أن يتكون الرقم السري من ٤ إلى ٦ أرقام.' : 'PIN must be 4–6 digits.',
      }));
      return;
    }

    setBusyChildId(childId);
    setErrMsg((p) => ({ ...p, [childId]: '' }));
    setStatusMsg((p) => ({ ...p, [childId]: '' }));

    const res = await familyApi<CredInfo>(
      `/api/family/children/${encodeURIComponent(childId)}/credentials`,
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(pin ? { pin } : {}),
          rotateAccessCode,
        }),
      },
    );
    setBusyChildId(null);

    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErrMsg((p) => ({ ...p, [childId]: res.error || 'Failed to update credentials' }));
      return;
    }

    if (res.data) {
      setCredMap((prev) => ({ ...prev, [childId]: res.data! }));
      setPinDraft((p) => ({ ...p, [childId]: '' }));
      soundEngine.playSuccess();
      setStatusMsg((p) => ({
        ...p,
        [childId]: language === 'ar'
          ? 'تم حفظ رمز الدخول والرقم السري بأمان! شاركهما مع طفلك فقط.'
          : 'Child Access Code & hashed PIN saved securely!',
      }));
    }
  };

  const handleDeleteChild = async (child: ChildProfile) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setBusyChildId(child.id);
    const res = await familyApi<{ deleted: boolean }>(
      `/api/family/children/${encodeURIComponent(child.id)}/delete`,
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Parent requested removal from Family Dashboard' }),
      },
    );
    setBusyChildId(null);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErrMsg((p) => ({ ...p, [child.id]: res.error || 'Could not remove child' }));
      return;
    }
    soundEngine.playPop();
    await refreshChildrenList();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C]">
            {language === 'ar' ? 'أطفالي وبيانات دخول الطفل (رمز + PIN)' : 'My Children & Child Access Credentials'}
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'يتطلب عرض أو تغيير رموز دخول الطفل وتعديل/حذف الملفات فتح بوابة ولي الأمر الأمنية.'
              : 'Viewing or rotating Child Access Codes, setting Child PINs, and removing profiles require Parent Gate verification.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('create-child')}
          className="nono-btn-tactile min-h-[42px] px-4 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{language === 'ar' ? 'إضافة ملف طفل جديد' : 'Create Child Profile'}</span>
        </button>
      </div>

      {!gateVerified && (
        <div className="nono-card p-4 bg-[#FEF3C7] border border-[#F59E0B]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#92400E]">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              {language === 'ar'
                ? 'بوابة الحماية مقفلة حالياً — افتحها لإدارة رموز دخول الأطفال أو حذف الملفات.'
                : 'Parent Gate is locked — verify your Parent PIN or password to view/manage Child Access Codes & PINs.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onRequestGateUnlock}
            className="px-3.5 py-2 rounded-xl bg-[#27345C] text-white text-xs font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'فتح البوابة الآن' : 'Unlock Parent Gate'}
          </button>
        </div>
      )}

      {editingChild && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editName.trim()) return;
            updateChildProfile(editingChild.id, { displayName: editName.trim(), language: editLang });
            setEditingChild(null);
            soundEngine.playSuccess();
          }}
          className="nono-card p-5 bg-[#F4EEFF] border-2 border-[#8054D9] space-y-3"
        >
          <p className="text-sm font-extrabold text-[#27345C]">
            {language === 'ar' ? `تعديل ملف ${editingChild.displayName}` : `Edit Profile: ${editingChild.displayName}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={40}
              required
              className="h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
              placeholder={language === 'ar' ? 'اسم الطفل' : 'Child name'}
            />
            <select
              value={editLang}
              onChange={(e) => setEditLang(e.target.value as 'ar' | 'en')}
              className="h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer"
              >
                {language === 'ar' ? 'حفظ' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditingChild(null)}
                className="px-3 h-10 rounded-xl bg-white text-[#27345C] text-xs font-bold cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </form>
      )}

      {childrenList.length === 0 ? (
        <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
          <p className="text-base font-extrabold text-[#27345C]">
            {language === 'ar'
              ? 'لا يوجد أطفال مسجلون في العائلة بعد'
              : 'No child profiles created yet'}
          </p>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'أنشئ ملف طفلك الآن لتوليد رمز الدخول (NL-XXXX-XXXX) والرقم السري.'
              : 'Create a child profile to generate their unique NL-XXXX-XXXX Access Code and Child PIN.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('create-child')}
            className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إنشاء ملف طفل جديد' : 'Create Child Profile'}</span>
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {childrenList.map((child) => {
          const isSelected = child.id === activeChild?.id;
          const cred = credMap[child.id];
          const busy = busyChildId === child.id;

          return (
            <div
              key={child.id}
              className={`nono-card rounded-3xl p-5 bg-white border-2 space-y-3.5 ${
                isSelected ? 'border-[#8054D9]' : 'border-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-extrabold text-[#27345C]">{child.displayName}</h3>
                  <p className="text-xs font-bold text-[#8054D9]">
                    {formatChildAgeLabel(child, language)} · {t(getAgeGroupMeta(UNIFIED_STAGE_ID).label, language)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingChild(child);
                      setEditName(child.displayName);
                      setEditLang(child.language);
                    }}
                    className="p-2 rounded-xl bg-[#FFF8E9] text-[#27345C] cursor-pointer"
                    title={language === 'ar' ? 'تعديل' : 'Edit'}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectChild(child.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                      isSelected ? 'bg-[#55D98B]/25 text-[#14532D]' : 'bg-[#27345C] text-white'
                    }`}
                  >
                    {isSelected ? (language === 'ar' ? 'نشط ✓' : 'Active ✓') : language === 'ar' ? 'تحديد' : 'Select'}
                  </button>
                </div>
              </div>

              {/* Child Access Code & PIN Box */}
              {authSession.authenticated && !child.id.startsWith('demo-') && (
                <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/12 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[#27345C] flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-[#8054D9]" />
                      <span>{language === 'ar' ? 'دخول الطفل المستقل (بدون بريد)' : 'Child Login (Code + PIN)'}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loadCreds(child.id)}
                      className="text-xs font-extrabold text-[#8054D9] hover:underline cursor-pointer"
                    >
                      {cred
                        ? language === 'ar' ? 'تحديث' : 'Refresh'
                        : language === 'ar' ? 'عرض الرمز' : 'Reveal Code'}
                    </button>
                  </div>

                  {cred?.hasCredentials && cred.accessCode && (
                    <div className="p-2.5 rounded-xl bg-white border border-[#8054D9]/25 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-[#27345C]/65">
                          {language === 'ar' ? 'رمز الدخول السري للطفل' : 'Unique Child Access Code'}
                        </p>
                        <p className="text-sm font-extrabold font-mono-num tracking-wider text-[#27345C]">
                          {cred.accessCode}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(cred.accessCode!);
                            setCopiedId(child.id);
                            setTimeout(() => setCopiedId(null), 1600);
                          }}
                          className="p-2 rounded-lg bg-[#F4EEFF] text-[#8054D9] cursor-pointer"
                          title={language === 'ar' ? 'نسخ' : 'Copy'}
                        >
                          {copiedId === child.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveChildCreds(child.id, true)}
                          className="p-2 rounded-lg bg-[#FFF8E9] text-[#B45309] cursor-pointer"
                          title={language === 'ar' ? 'تدوير الرمز' : 'Rotate Access Code'}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinDraft[child.id] || ''}
                      onChange={(e) =>
                        setPinDraft((p) => ({ ...p, [child.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                      }
                      placeholder={
                        cred?.hasCredentials
                          ? language === 'ar' ? 'PIN جديد (٤–٦ أرقام)' : 'New PIN (4–6 digits)'
                          : language === 'ar' ? 'أنشئ PIN (٤–٦ أرقام)' : 'Set Child PIN (4–6 digits)'
                      }
                      className="flex-1 h-9 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-mono-num font-bold"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveChildCreds(child.id, false)}
                      className="h-9 px-3 rounded-xl bg-[#27345C] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      {cred?.hasCredentials
                        ? language === 'ar' ? 'تحديث PIN' : 'Reset PIN'
                        : language === 'ar' ? 'توليد الرمز وPIN' : 'Create Code + PIN'}
                    </button>
                  </div>

                  {errMsg[child.id] && (
                    <p className="text-[11px] font-bold text-[#DC2626] flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>{errMsg[child.id]}</span>
                    </p>
                  )}
                  {statusMsg[child.id] && (
                    <p className="text-[11px] font-bold text-[#15803D]">{statusMsg[child.id]}</p>
                  )}
                </div>
              )}

              {/* Preserved Student Exam Login + Safe Removal */}
              {authSession.authenticated && !child.id.startsWith('demo-') && (
                <div className="pt-2 border-t border-[#27345C]/10 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentCredChildId(studentCredChildId === child.id ? null : child.id);
                        setStudentMsg('');
                        setStudentErr('');
                      }}
                      className="font-extrabold text-[#8054D9] hover:underline cursor-pointer"
                    >
                      {child.studentUserId
                        ? language === 'ar' ? 'تحديث دخول الامتحانات' : 'Update Exam Account'
                        : language === 'ar' ? '+ ربط بريد امتحانات' : '+ Link Exam Login'}
                    </button>

                    {childrenList.length > 1 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDeleteChild(child)}
                        className="text-[#DC2626] font-extrabold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'إزالة الملف' : 'Remove Child'}</span>
                      </button>
                    )}
                  </div>

                  {studentCredChildId === child.id && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setStudentErr('');
                        setStudentMsg('');
                        const r = await familyApi<{ studentUser?: { email?: string } }>(
                          `/api/parent/children/${encodeURIComponent(child.id)}/student-account`,
                          authSession.csrfToken,
                          {
                            method: 'POST',
                            body: JSON.stringify({ email: studentEmail, password: studentPassword }),
                          },
                        );
                        if (!r.ok) {
                          setStudentErr(r.error || 'Could not save');
                        } else {
                          setStudentMsg(
                            language === 'ar'
                              ? `تم الحفظ: ${r.data?.studentUser?.email || studentEmail}`
                              : `Saved: ${r.data?.studentUser?.email || studentEmail}`,
                          );
                          setStudentEmail('');
                          setStudentPassword('');
                        }
                      }}
                      className="space-y-2 p-3 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10"
                    >
                      <input
                        type="email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder={language === 'ar' ? 'بريد دخول الطالب للامتحانات' : 'Student exam email'}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
                        required
                      />
                      <input
                        type="password"
                        value={studentPassword}
                        onChange={(e) => setStudentPassword(e.target.value)}
                        placeholder={language === 'ar' ? 'كلمة مرور قوية (١٢+ حرفاً)' : 'Strong password (12+ chars)'}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
                        required
                      />
                      {studentErr && <p className="text-[11px] font-bold text-[#DC2626]">{studentErr}</p>}
                      {studentMsg && <p className="text-[11px] font-bold text-[#15803D]">{studentMsg}</p>}
                      <button
                        type="submit"
                        className="w-full h-9 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold cursor-pointer"
                      >
                        {language === 'ar' ? 'حفظ' : 'Save Exam Login'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
