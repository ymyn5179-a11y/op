import React, { useCallback, useEffect, useState } from 'react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { CheckCircle2, Fingerprint, KeyRound, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import { PasskeySummary } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi } from './shared';

export const PasskeysPanel: React.FC = () => {
  const { authSession, language } = useNonoLand();
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reauthenticated, setReauthenticated] = useState(false);
  const [reauthRemainingSeconds, setReauthRemainingSeconds] = useState(0);
  const [reauthPassword, setReauthPassword] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  const webAuthnSupported = typeof window !== 'undefined' && browserSupportsWebAuthn();

  const loadPasskeys = useCallback(async () => {
    if (!authSession.authenticated || authSession.user?.role !== 'parent') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await familyApi<{
      supported: boolean;
      passkeys: PasskeySummary[];
      reauthenticated: boolean;
      reauthRemainingSeconds: number;
    }>('/api/auth/passkeys', authSession.csrfToken);
    setLoading(false);
    if (res.ok && res.data) {
      setPasskeys(res.data.passkeys || []);
      setReauthenticated(Boolean(res.data.reauthenticated));
      setReauthRemainingSeconds(res.data.reauthRemainingSeconds || 0);
    } else if (res.error) {
      setErr(res.error);
    }
  }, [authSession.authenticated, authSession.csrfToken, authSession.user?.role]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  useEffect(() => {
    if (!reauthenticated || reauthRemainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setReauthRemainingSeconds((prev) => {
        if (prev <= 1) {
          setReauthenticated(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reauthenticated, reauthRemainingSeconds]);

  const handleReauthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthPassword.trim()) return;
    setBusy(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ reauthenticated: boolean; expiresInSeconds: number }>(
      '/api/auth/reauthenticate',
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({ password: reauthPassword }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      soundEngine.playEncourage();
      setErr(
        res.error ||
          (language === 'ar' ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.'),
      );
      return;
    }
    setReauthPassword('');
    setReauthenticated(true);
    setReauthRemainingSeconds(res.data?.expiresInSeconds || 300);
    soundEngine.playSuccess();
    setNotice(
      language === 'ar'
        ? 'تم تأكيد كلمة المرور! يمكنك الآن إضافة أو إلغاء مفاتيح المرور خلال ٥ دقائق.'
        : 'Password confirmed! Passkey management is unlocked for 5 minutes.',
    );
  };

  const handleAddPasskey = async () => {
    if (!webAuthnSupported) {
      setErr(
        language === 'ar'
          ? 'متصفحك أو جهازك الحالي لا يدعم إنشاء مفاتيح المرور (WebAuthn).'
          : 'This browser or device does not support creating WebAuthn Passkeys.',
      );
      return;
    }
    if (!reauthenticated) {
      setErr(
        language === 'ar'
          ? 'يرجى تأكيد كلمة المرور أولاً قبل إضافة مفتاح مرور جديد.'
          : 'Please confirm your password first before adding a new Passkey.',
      );
      return;
    }

    setBusy(true);
    setErr('');
    setNotice('');
    try {
      const optRes = await familyApi<{
        options: Parameters<typeof startRegistration>[0]['optionsJSON'];
      }>('/api/auth/passkeys/register/options', authSession.csrfToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!optRes.ok || !optRes.data?.options) {
        if (optRes.code === 'PASSWORD_REAUTH_REQUIRED') {
          setReauthenticated(false);
          setReauthRemainingSeconds(0);
        }
        setErr(
          optRes.error ||
            (language === 'ar'
              ? 'تعذر بدء تسجيل مفتاح المرور.'
              : 'Could not start Passkey registration.'),
        );
        return;
      }

      const attestation = await startRegistration({ optionsJSON: optRes.data.options });

      const verRes = await familyApi<{ passkey: PasskeySummary }>(
        '/api/auth/passkeys/register/verify',
        authSession.csrfToken,
        {
          method: 'POST',
          body: JSON.stringify({
            response: attestation,
            label: labelInput.trim() || undefined,
          }),
        },
      );

      if (!verRes.ok) {
        if (verRes.code === 'PASSWORD_REAUTH_REQUIRED') {
          setReauthenticated(false);
          setReauthRemainingSeconds(0);
        }
        setErr(
          verRes.error ||
            (language === 'ar'
              ? 'فشل التحقق من مفتاح المرور الجديد.'
              : 'Could not verify the new Passkey.'),
        );
        return;
      }

      setLabelInput('');
      await loadPasskeys();
      soundEngine.playSuccess();
      setNotice(
        language === 'ar'
          ? 'تم تسجيل مفتاح المرور (Passkey) بنجاح! يمكنك استخدامه لتسجيل الدخول لاحقاً.'
          : 'Passkey registered! You can now use it to sign in as a parent.',
      );
    } catch (caught) {
      const name = (caught as { name?: string })?.name || '';
      if (name === 'NotAllowedError') {
        setErr(
          language === 'ar'
            ? 'تم إلغاء إنشاء مفتاح المرور على الجهاز.'
            : 'Passkey creation was cancelled on this device.',
        );
      } else if (name === 'InvalidStateError') {
        setErr(
          language === 'ar'
            ? 'هذا الجهاز مسجل بالفعل بمفتاح مرور لهذا الحساب.'
            : 'This device already has a registered Passkey for this account.',
        );
      } else if (name === 'SecurityError') {
        setErr(
          language === 'ar'
            ? 'لا يمكن إنشاء مفتاح مرور داخل إطار مضمّن؛ افتح التطبيق مباشرة عبر HTTPS أو localhost.'
            : 'Passkey creation is blocked in an embedded frame. Open the app directly over HTTPS or localhost.',
        );
      } else {
        setErr(
          language === 'ar'
            ? 'تعذر إنشاء مفتاح المرور في هذا المتصفح.'
            : 'Unable to create Passkey in this browser.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (pk: PasskeySummary) => {
    if (!reauthenticated) {
      setErr(
        language === 'ar'
          ? 'يرجى تأكيد كلمة المرور أولاً قبل إلغاء أي مفتاح مرور.'
          : 'Please confirm your password first before revoking a Passkey.',
      );
      return;
    }

    setBusy(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ revoked: boolean; passkey: PasskeySummary }>(
      `/api/auth/passkeys/${encodeURIComponent(pk.id)}/revoke`,
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({}) },
    );
    setBusy(false);
    if (!res.ok) {
      if (res.code === 'PASSWORD_REAUTH_REQUIRED') {
        setReauthenticated(false);
        setReauthRemainingSeconds(0);
      }
      setErr(
        res.error ||
          (language === 'ar' ? 'تعذر إلغاء مفتاح المرور.' : 'Failed to revoke Passkey.'),
      );
      return;
    }

    await loadPasskeys();
    soundEngine.playPop();
    setNotice(
      language === 'ar'
        ? `تم إلغاء مفتاح المرور (${pk.label}). يظل دخولك بالبريد الإلكتروني وكلمة المرور متاحاً دائماً.`
        : `Passkey "${pk.label}" revoked. Your Email + Password sign-in remains active.`,
    );
  };

  const activeCount = passkeys.filter((p) => !p.revokedAt).length;

  return (
    <div className="nono-card rounded-3xl p-6 bg-white space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-[#8054D9]" />
            <span>
              {language === 'ar'
                ? 'مفاتيح المرور (Passkeys) وأمان الحساب'
                : 'Parent Passkeys & Account Security'}
            </span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/75 leading-relaxed">
            {language === 'ar'
              ? 'مفاتيح المرور اختيارية وتستخدم قفل الشاشة أو البصمة أو Face ID محلياً على جهازك فقط. لا يستلم موقع نونو لاند ولا يخزّن أي بيانات حيوية أو مفاتيح خاصة، ويظل تسجيل الدخول بالبريد الإلكتروني وكلمة المرور القوية متاحاً دائماً.'
              : 'Passkeys are optional and use your device screen lock, fingerprint, or Face ID locally. NonoLand never receives or stores biometric data or private keys, and your Email + Strong Password sign-in always remains active.'}
          </p>
        </div>

        <div className="text-xs font-extrabold text-[#27345C] bg-[#FFF8E9] border border-[#27345C]/12 rounded-2xl px-4 py-2.5">
          {language === 'ar'
            ? `المفاتيح النشطة: ${activeCount}`
            : `Active Passkeys: ${activeCount}`}
        </div>
      </div>

      {err && (
        <div className="p-3.5 rounded-2xl bg-[#FEF2F2] border border-[#FF4D6D]/30 text-xs font-extrabold text-[#991B1B]">
          {err}
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-[#DCFCE7] border border-[#55D98B] text-xs font-extrabold text-[#15803D]">
          {notice}
        </div>
      )}

      {!webAuthnSupported && (
        <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold text-[#27345C]">
          {language === 'ar'
            ? 'متصفحك الحالي لا يدعم مفاتيح المرور (WebAuthn). يمكنك الاستمرار بأمان باستخدام البريد الإلكتروني وكلمة المرور القوية.'
            : 'Your current browser does not support WebAuthn Passkeys. Your account remains fully protected with Email + Strong Password sign-in.'}
        </div>
      )}

      {/* Password Re-authentication Gate */}
      <div className="p-4 rounded-2xl bg-[#F4EEFF] border border-[#8054D9]/20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#27345C]">
            {reauthenticated ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
            ) : (
              <Lock className="w-4 h-4 text-[#8054D9]" />
            )}
            <span>
              {reauthenticated
                ? language === 'ar'
                  ? `إدارة مفاتيح المرور مفعّلة لمدة ${Math.floor(reauthRemainingSeconds / 60)}:${String(reauthRemainingSeconds % 60).padStart(2, '0')}`
                  : `Passkey management unlocked (${Math.floor(reauthRemainingSeconds / 60)}:${String(reauthRemainingSeconds % 60).padStart(2, '0')} remaining)`
                : language === 'ar'
                  ? 'تأكيد كلمة المرور مطلوب قبل إضافة أو إلغاء أي مفتاح مرور'
                  : 'Confirm your current password to add or revoke a Passkey'}
            </span>
          </div>
        </div>

        {!reauthenticated && (
          <form onSubmit={(e) => void handleReauthenticate(e)} className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              required
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              placeholder={
                language === 'ar' ? 'أدخل كلمة المرور الحالية' : 'Enter current parent password'
              }
              className="flex-1 min-w-[220px] h-10 px-3.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold outline-none focus:border-[#8054D9]"
            />
            <button
              type="submit"
              disabled={busy || !reauthPassword.trim()}
              className="h-10 px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm Password'}</span>
            </button>
          </form>
        )}

        {/* Add Passkey Form */}
        {webAuthnSupported && (
          <div className="pt-2 border-t border-[#8054D9]/15 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              maxLength={60}
              disabled={!reauthenticated || busy}
              placeholder={
                language === 'ar'
                  ? 'تسمية الجهاز (مثلاً: هاتف الأم أو حاسوب المنزل)'
                  : 'Device label (e.g. Mom iPhone, Home Laptop)'
              }
              className="flex-1 min-w-[220px] h-10 px-3.5 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold outline-none focus:border-[#8054D9] disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!reauthenticated || busy}
              onClick={() => void handleAddPasskey()}
              className="h-10 px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'إضافة مفتاح مرور' : 'Add Passkey'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Registered Passkeys List */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-[#27345C] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#55D98B]" />
          <span>{language === 'ar' ? 'مفاتيح المرور المسجلة' : 'Registered Passkeys'}</span>
        </h3>

        {loading ? (
          <p className="text-xs font-bold text-[#27345C]/65">
            {language === 'ar' ? 'جاري تحميل مفاتيح المرور...' : 'Loading Passkeys...'}
          </p>
        ) : passkeys.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 text-xs font-bold text-[#27345C]/75">
            {language === 'ar'
              ? 'لا توجد مفاتيح مرور مسجلة بعد. يمكنك إضافة مفتاح مرور اختياري لكل جهاز تستخدمه لتسجيل الدخول بسهولة.'
              : 'No Passkeys registered yet. You can optionally add one or more Passkeys across your personal devices.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {passkeys.map((pk) => {
              const revoked = Boolean(pk.revokedAt);
              return (
                <div
                  key={pk.id}
                  className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                    revoked
                      ? 'bg-slate-100 border-slate-200 opacity-70'
                      : 'bg-[#FFF8E9] border-[#27345C]/12'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Fingerprint
                      className={`w-5 h-5 mt-0.5 shrink-0 ${
                        revoked ? 'text-slate-400' : 'text-[#8054D9]'
                      }`}
                    />
                    <div className="space-y-1">
                      <p className="font-extrabold text-sm text-[#27345C]">{pk.label}</p>
                      <p className="text-[#27345C]/75 font-bold">
                        {pk.deviceType === 'multiDevice'
                          ? language === 'ar'
                            ? 'مفتاح مرور متزامن'
                            : 'Synced Passkey'
                          : language === 'ar'
                            ? 'مفتاح مرتبط بالجهاز'
                            : 'Single-Device Passkey'}
                        {' · '}
                        {language === 'ar' ? 'أُضيف:' : 'Added:'} {formatDate(pk.createdAt, language)}
                        {pk.lastUsedAt
                          ? ` · ${language === 'ar' ? 'آخر استخدام:' : 'Last used:'} ${formatDate(pk.lastUsedAt, language)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {revoked ? (
                    <span className="text-xs font-extrabold text-slate-600">
                      {language === 'ar'
                        ? `ملغى (${formatDate(pk.revokedAt!, language)})`
                        : `Revoked (${formatDate(pk.revokedAt!, language)})`}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !reauthenticated}
                      onClick={() => void handleRevoke(pk)}
                      title={
                        !reauthenticated
                          ? language === 'ar'
                            ? 'أكد كلمة المرور أولاً للإلغاء'
                            : 'Confirm your password first to revoke'
                          : undefined
                      }
                      className="px-3.5 py-2 rounded-xl bg-[#FEE2E2] text-[#991B1B] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إلغاء المفتاح' : 'Revoke'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
