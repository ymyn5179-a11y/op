import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, Unlock } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi } from './shared';

interface Props {
  gateVerified: boolean;
  hasParentPin: boolean;
  remainingSeconds: number;
  onGateStateChange: (verified: boolean, hasPin: boolean, remSec: number) => void;
}

export const ParentGatePanel: React.FC<Props> = ({
  gateVerified,
  hasParentPin,
  remainingSeconds,
  onGateStateChange,
}) => {
  const { authSession, language } = useNonoLand();
  const [verifySecret, setVerifySecret] = useState('');
  const [verifyMode, setVerifyMode] = useState<'pin' | 'password'>(hasParentPin ? 'pin' : 'password');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNotice('');
    const body = verifyMode === 'pin' ? { pin: verifySecret } : { password: verifySecret };
    const res = await familyApi<{ verified: boolean; remainingSeconds: number; hasParentPin: boolean }>(
      '/api/parent/gate/verify',
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify(body) },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Verification failed');
      return;
    }
    setVerifySecret('');
    soundEngine.playSuccess();
    onGateStateChange(true, Boolean(res.data?.hasParentPin), res.data?.remainingSeconds || 900);
    setNotice(language === 'ar' ? 'تم فتح بوابة ولي الأمر بنجاح لـ ١٥ دقيقة ✓' : 'Parent Gate verified for 15 minutes ✓');
  };

  const handleLock = async () => {
    setBusy(true);
    await familyApi('/api/parent/gate/lock', authSession.csrfToken, { method: 'POST', body: JSON.stringify({}) });
    setBusy(false);
    onGateStateChange(false, hasParentPin, 0);
    setNotice(language === 'ar' ? 'تم إقفال بوابة ولي الأمر 🔒' : 'Parent Gate locked 🔒');
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ hasParentPin: boolean; verified: boolean; remainingSeconds: number }>(
      '/api/parent/gate/pin',
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPin }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Could not update Parent PIN');
      return;
    }
    setCurrentPassword('');
    setNewPin('');
    soundEngine.playCelebration();
    onGateStateChange(true, true, res.data?.remainingSeconds || 900);
    setNotice(language === 'ar' ? 'تم حفظ رمز الحماية الأبوي (PIN) بأمان ✓' : 'Parent Gate PIN saved securely ✓');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            {gateVerified ? <Unlock className="w-5 h-5 text-[#16A34A]" /> : <Lock className="w-5 h-5 text-[#B45309]" />}
            <span>{language === 'ar' ? 'حالة بوابة الحماية الأبوية' : 'Parent Gate Security Status'}</span>
          </h2>
          <span
            className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
              gateVerified ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            {gateVerified
              ? language === 'ar'
                ? `مفتوحة (${Math.ceil(remainingSeconds / 60)} د)`
                : `Verified (${Math.ceil(remainingSeconds / 60)}m)`
              : language === 'ar'
                ? 'مقفلة'
                : 'Locked'}
          </span>
        </div>

        <p className="text-xs font-bold text-[#27345C]/75">
          {language === 'ar'
            ? 'تحمي البوابة رموز دخول الأطفال، الأجهزة الموثوقة، إدارة أولياء الأمور، وتغييرات الخصوصية والبيانات.'
            : 'Protects Child Access Codes, Child PIN resets, Guardian invites/revocation, Device trust, and Privacy changes.'}
        </p>

        {err && <p className="text-xs font-extrabold text-[#DC2626]">{err}</p>}
        {notice && <p className="text-xs font-extrabold text-[#15803D]">{notice}</p>}

        {gateVerified ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleLock()}
            className="min-h-[42px] px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{language === 'ar' ? 'إقفال البوابة الآن' : 'Lock Parent Gate Now'}</span>
          </button>
        ) : (
          <form onSubmit={(e) => void handleVerify(e)} className="space-y-3">
            {hasParentPin && (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setVerifyMode('pin')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer ${
                    verifyMode === 'pin' ? 'bg-[#8054D9] text-white' : 'bg-[#FFF8E9] text-[#27345C]'
                  }`}
                >
                  {language === 'ar' ? 'برمز الحماية (PIN)' : 'Use Parent PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyMode('password')}
                  className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer ${
                    verifyMode === 'password' ? 'bg-[#8054D9] text-white' : 'bg-[#FFF8E9] text-[#27345C]'
                  }`}
                >
                  {language === 'ar' ? 'بكلمة مرور الحساب' : 'Use Account Password'}
                </button>
              </div>
            )}
            <input
              type="password"
              value={verifySecret}
              onChange={(e) => setVerifySecret(e.target.value)}
              placeholder={
                verifyMode === 'pin' && hasParentPin
                  ? language === 'ar' ? 'أدخل رمز PIN الأبوي' : 'Enter Parent PIN'
                  : language === 'ar' ? 'أدخل كلمة مرور ولي الأمر' : 'Enter Parent Password'
              }
              className="w-full h-11 px-3.5 rounded-xl border-2 border-[#27345C]/15 text-sm font-bold"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] rounded-xl bg-[#8054D9] text-white text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'ar' ? 'فتح البوابة' : 'Verify & Unlock'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Configure or Reset Parent PIN */}
      <form onSubmit={(e) => void handleSetPin(e)} className="nono-card rounded-3xl p-6 bg-white space-y-4">
        <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#8054D9]" />
          <span>
            {hasParentPin
              ? language === 'ar' ? 'تحديث رمز الحماية الأبوي (PIN)' : 'Reset Parent Gate PIN'
              : language === 'ar' ? 'إنشاء رمز حماية أبوي سريع (PIN)' : 'Create Quick Parent Gate PIN'}
          </span>
        </h2>
        <p className="text-xs font-bold text-[#27345C]/70">
          {language === 'ar'
            ? 'يتطلب تأكيد كلمة مرور حسابك الحالية. يُحفظ الرمز مشفراً باتجاه واحد ولا يظهر كنص واضح أبداً.'
            : 'Requires your current parent account password. Stored securely with a one-way cryptographic hash.'}
        </p>

        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder={language === 'ar' ? 'كلمة مرور الحساب الحالية' : 'Current account password'}
          className="w-full h-11 px-3.5 rounded-xl border-2 border-[#27345C]/15 text-sm font-bold"
          required
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={language === 'ar' ? 'رمز PIN الجديد (٤ إلى ٦ أرقام)' : 'New Parent PIN (4–6 digits)'}
          className="w-full h-11 px-3.5 rounded-xl border-2 border-[#27345C]/15 text-sm font-mono-num font-bold"
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[44px] rounded-xl bg-[#27345C] text-white text-sm font-extrabold cursor-pointer"
        >
          {language === 'ar' ? 'حفظ رمز الحماية الأبوي' : 'Save Parent PIN'}
        </button>
      </form>
    </div>
  );
};
