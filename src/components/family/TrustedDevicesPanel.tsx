import React, { useEffect, useState } from 'react';
import { Laptop, LogOut, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import { TrustedDeviceRecord } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi } from './shared';

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const TrustedDevicesPanel: React.FC<Props> = ({ gateVerified, onRequestGateUnlock }) => {
  const { authSession, language } = useNonoLand();
  const [devices, setDevices] = useState<TrustedDeviceRecord[]>([]);
  const [activeSessions, setActiveSessions] = useState(0);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  const loadDevices = async () => {
    if (!authSession.authenticated) return;
    const res = await familyApi<{ devices: TrustedDeviceRecord[]; activeSessionsCount: number }>(
      '/api/family/devices',
      authSession.csrfToken,
    );
    if (res.ok && res.data) {
      setDevices(res.data.devices || []);
      setActiveSessions(res.data.activeSessionsCount || 0);
    }
  };

  useEffect(() => {
    void loadDevices();
  }, [authSession.authenticated]);

  const registerCurrentDevice = async () => {
    setBusy(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ device: TrustedDeviceRecord }>(
      '/api/family/devices/register-current',
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({
          deviceName: deviceLabel.trim() || undefined,
          trusted: true,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Could not register device');
      return;
    }
    setDeviceLabel('');
    await loadDevices();
    soundEngine.playSuccess();
    setNotice(
      language === 'ar'
        ? 'تم اعتماد هذا الجهاز للعائلة! سيظهر الآن اختيار الطفل السريع بالرقم السري على هذا الجهاز فقط.'
        : 'Current device trusted! Child Quick-Pick (with PIN) is now enabled safely on this browser.',
    );
  };

  const toggleTrust = async (dev: TrustedDeviceRecord) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const res = await familyApi<{ device: TrustedDeviceRecord }>(
      `/api/family/devices/${encodeURIComponent(dev.id)}`,
      authSession.csrfToken,
      { method: 'PATCH', body: JSON.stringify({ trusted: !dev.trusted }) },
    );
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not update device');
      return;
    }
    await loadDevices();
    soundEngine.playPop();
  };

  const revokeDevice = async (devId: string) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const res = await familyApi<{ revoked: boolean; revokedSessions: number }>(
      `/api/family/devices/${encodeURIComponent(devId)}/revoke`,
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not revoke device');
      return;
    }
    await loadDevices();
    soundEngine.playPop();
    setNotice(
      language === 'ar'
        ? `تم سحب ثقة الجهاز وإغلاق ${res.data?.revokedSessions || 0} جلسة مرتبطة فوراً.`
        : `Device revoked and ${res.data?.revokedSessions || 0} linked session(s) terminated.`,
    );
  };

  const signOutOthers = async () => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const res = await familyApi<{ terminated: number }>(
      '/api/family/sessions/sign-out-others',
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not sign out other sessions');
      return;
    }
    await loadDevices();
    soundEngine.playSuccess();
    setNotice(
      language === 'ar'
        ? `تم إنهاء ${res.data?.terminated || 0} جلسات أخرى نشطة للعائلة ✓`
        : `Signed out ${res.data?.terminated || 0} other active session(s) ✓`,
    );
  };

  return (
    <div className="nono-card rounded-3xl p-6 bg-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Laptop className="w-6 h-6 text-[#8054D9]" />
            <span>{language === 'ar' ? 'الأجهزة العائلية الموثوقة والجلسات' : 'Trusted Family Devices & Sessions'}</span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? `الجلسات النشطة حالياً: ${activeSessions} · الأجهزة الموثوقة تستخدم رمز أمان خادمي خاص بالعائلة فقط.`
              : `Active sessions: ${activeSessions} · Trusted browsers allow family-scoped Child Quick-Pick with PIN verification.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void signOutOthers()}
          className="min-h-[40px] px-4 rounded-xl bg-[#FEF2F2] text-[#991B1B] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === 'ar' ? 'إنهاء جميع الجلسات الأخرى' : 'Sign Out Other Sessions'}</span>
        </button>
      </div>

      {err && <div className="p-3 rounded-2xl bg-[#FEF2F2] text-xs font-extrabold text-[#991B1B]">{err}</div>}
      {notice && <div className="p-3 rounded-2xl bg-[#DCFCE7] text-xs font-extrabold text-[#15803D]">{notice}</div>}

      {/* Register Current Device */}
      <div className="p-4 rounded-2xl bg-[#F4EEFF] border border-[#8054D9]/20 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={deviceLabel}
          onChange={(e) => setDeviceLabel(e.target.value)}
          maxLength={40}
          placeholder={language === 'ar' ? 'اسم مخصص لهذا الجهاز (مثلاً: جهاز المنزل)' : 'Device label (e.g., Living Room Tablet)'}
          className="flex-1 min-w-[200px] h-10 px-3 rounded-xl bg-white border border-[#27345C]/15 text-xs font-bold"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void registerCurrentDevice()}
          className="h-10 px-4 rounded-xl bg-[#8054D9] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language === 'ar' ? 'اعتماد هذا الجهاز للعائلة' : 'Trust This Browser Device'}</span>
        </button>
      </div>

      {/* Devices List */}
      <div className="space-y-2.5">
        {devices.length === 0 ? (
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'لا توجد أجهزة عائلية مسجلة بعد. اضغط على اعتماد هذا الجهاز لتفعيل دخول الطفل السريع الآمن.'
              : 'No registered family devices yet. Click "Trust This Browser Device" to enable family-scoped Child Quick-Pick.'}
          </p>
        ) : (
          devices.map((d) => (
            <div
              key={d.id}
              className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                d.revoked
                  ? 'bg-slate-100 border-slate-200 opacity-65'
                  : d.isCurrentDevice
                    ? 'bg-[#E2F9EC]/50 border-[#55D98B]'
                    : 'bg-[#FFF8E9] border-[#27345C]/10'
              }`}
            >
              <div className="flex items-center gap-3">
                {d.deviceType === 'mobile' || d.deviceType === 'tablet' ? (
                  <Smartphone className="w-5 h-5 text-[#8054D9]" />
                ) : (
                  <Laptop className="w-5 h-5 text-[#8054D9]" />
                )}
                <div>
                  <p className="font-extrabold text-sm text-[#27345C]">
                    {d.deviceName}{' '}
                    {d.isCurrentDevice && (
                      <span className="px-2 py-0.5 rounded-lg bg-[#DCFCE7] text-[#15803D] text-[10px]">
                        {language === 'ar' ? 'الجهاز الحالي' : 'This Device'}
                      </span>
                    )}
                  </p>
                  <p className="text-[#27345C]/70 font-bold">
                    {d.browser} · {d.os} · {language === 'ar' ? 'آخر نشاط:' : 'Last seen:'} {formatDate(d.lastActiveAt, language)}
                  </p>
                </div>
              </div>

              {!d.revoked ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleTrust(d)}
                    className={`px-3 py-1.5 rounded-xl font-extrabold cursor-pointer ${
                      d.trusted ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-white border border-[#27345C]/15 text-[#27345C]'
                    }`}
                  >
                    {d.trusted
                      ? language === 'ar' ? 'موثوق ✓' : 'Trusted ✓'
                      : language === 'ar' ? 'غير موثوق' : 'Untrusted'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revokeDevice(d.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#FEE2E2] text-[#991B1B] font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === 'ar' ? 'سحب الثقة' : 'Revoke'}</span>
                  </button>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-600 font-extrabold">
                  {language === 'ar' ? 'مسحوب' : 'Revoked'}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
