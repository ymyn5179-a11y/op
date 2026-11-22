import React, { useEffect, useState } from 'react';
import { Check, Copy, MailPlus, Shield, Trash2, Users } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import { GuardianInvitation, GuardianMembership, GuardianPermission, GuardianRole } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi } from './shared';

const PERM_LABELS: Record<GuardianPermission, { ar: string; en: string }> = {
  view_profiles: { ar: 'عرض ملفات الأطفال', en: 'View Profiles' },
  view_progress: { ar: 'متابعة التقدم', en: 'View Progress' },
  view_reports: { ar: 'عرض التقارير الأسبوعية', en: 'View Reports' },
  manage_learning_settings: { ar: 'ضبط خطط التعلم', en: 'Manage Learning Settings' },
  manage_credentials: { ar: 'إدارة رموز دخول الأطفال', en: 'Manage Child Credentials' },
  manage_screen_time: { ar: 'إدارة وقت الشاشة', en: 'Manage Screen Time' },
  approve_content: { ar: 'الموافقة على المحتوى والخصوصية', en: 'Approve Content & Privacy' },
  manage_devices: { ar: 'إدارة الأجهزة الموثوقة', en: 'Manage Devices' },
  manage_guardians: { ar: 'دعوة وإدارة أولياء الأمور', en: 'Manage Guardians' },
};

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const GuardiansPanel: React.FC<Props> = ({ gateVerified, onRequestGateUnlock }) => {
  const { authSession, language, refreshChildrenList } = useNonoLand();
  const [members, setMembers] = useState<GuardianMembership[]>([]);
  const [invitations, setInvitations] = useState<GuardianInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'secondary_guardian' | 'caregiver'>('secondary_guardian');
  const [issuedToken, setIssuedToken] = useState('');
  const [acceptToken, setAcceptToken] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  const loadGuardians = async () => {
    if (!authSession.authenticated) return;
    const res = await familyApi<{
      members: GuardianMembership[];
      invitations: GuardianInvitation[];
    }>('/api/family/guardians', authSession.csrfToken);
    if (res.ok && res.data) {
      setMembers(res.data.members || []);
      setInvitations(res.data.invitations || []);
    }
  };

  useEffect(() => {
    void loadGuardians();
  }, [authSession.authenticated]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setBusy(true);
    setErr('');
    setNotice('');
    setIssuedToken('');
    const res = await familyApi<{ invitation: GuardianInvitation; inviteToken: string }>(
      '/api/family/guardians/invite',
      authSession.csrfToken,
      {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not send invitation');
      return;
    }
    if (res.data) {
      setInvitations((prev) => [res.data!.invitation, ...prev]);
      setIssuedToken(res.data.inviteToken);
      setInviteEmail('');
      soundEngine.playSuccess();
      setNotice(
        language === 'ar'
          ? 'تم إنشاء الدعوة بنجاح! شارك رمز الدعوة بشكل خاص مع ولي الأمر المدعو.'
          : 'Invitation created! Share this invite token privately with the invited guardian.',
      );
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptToken.trim()) return;
    setBusy(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ accepted: boolean }>(
      '/api/family/guardians/accept',
      authSession.csrfToken,
      { method: 'POST', body: JSON.stringify({ inviteToken: acceptToken.trim() }) },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'Could not accept invitation');
      return;
    }
    setAcceptToken('');
    await loadGuardians();
    await refreshChildrenList();
    soundEngine.playCelebration();
    setNotice(language === 'ar' ? 'تم قبول الدعوة والانضمام لحساب العائلة ✓' : 'Joined family account ✓');
  };

  const togglePermission = async (member: GuardianMembership, perm: GuardianPermission) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const nextPerms = member.permissions.includes(perm)
      ? member.permissions.filter((p) => p !== perm)
      : [...member.permissions, perm];
    const res = await familyApi<{ membership: GuardianMembership }>(
      `/api/family/guardians/${encodeURIComponent(member.id)}`,
      authSession.csrfToken,
      { method: 'PATCH', body: JSON.stringify({ permissions: nextPerms }) },
    );
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not update permissions');
      return;
    }
    if (res.data?.membership) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? res.data!.membership : m)));
      soundEngine.playPop();
    }
  };

  const handleRevokeMember = async (membershipId: string) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    const res = await familyApi<{ revoked: boolean }>(
      `/api/family/guardians/${encodeURIComponent(membershipId)}`,
      authSession.csrfToken,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not revoke guardian');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    soundEngine.playPop();
    setNotice(language === 'ar' ? 'تم سحب صلاحية العضو فوراً.' : 'Guardian access revoked immediately.');
  };

  const roleBadge = (r: GuardianRole) =>
    r === 'primary_guardian'
      ? language === 'ar' ? 'ولي الأمر الأساسي' : 'Primary Guardian'
      : r === 'secondary_guardian'
        ? language === 'ar' ? 'ولي أمر مشارك' : 'Secondary Guardian'
        : language === 'ar' ? 'مقدّم رعاية' : 'Caregiver';

  return (
    <div className="space-y-5">
      {err && <div className="p-3 rounded-2xl bg-[#FEF2F2] text-xs font-extrabold text-[#991B1B]">{err}</div>}
      {notice && <div className="p-3 rounded-2xl bg-[#DCFCE7] text-xs font-extrabold text-[#15803D]">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={(e) => void handleInvite(e)} className="nono-card rounded-3xl p-5 bg-white space-y-3">
            <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
              <MailPlus className="w-5 h-5 text-[#8054D9]" />
              <span>{language === 'ar' ? 'دعوة ولي أمر أو مقدم رعاية' : 'Invite Co-Guardian or Caregiver'}</span>
            </h2>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={language === 'ar' ? 'البريد الإلكتروني للمدعو' : 'Guardian email address'}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-[#27345C]/15 text-sm font-bold"
              required
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'secondary_guardian' | 'caregiver')}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-[#27345C]/15 text-sm font-bold"
            >
              <option value="secondary_guardian">
                {language === 'ar' ? 'ولي أمر مشارك (تقارير وإعدادات التعلم)' : 'Secondary Guardian (Reports & Learning Controls)'}
              </option>
              <option value="caregiver">
                {language === 'ar' ? 'مقدّم رعاية (متابعة ملف الطفل فقط)' : 'Caregiver (View Profiles & Progress Only)'}
              </option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] rounded-xl bg-[#8054D9] text-white text-sm font-extrabold cursor-pointer"
            >
              {language === 'ar' ? 'إرسال دعوة آمنة' : 'Send Secure Family Invite'}
            </button>

            {issuedToken && (
              <div className="p-3 rounded-2xl bg-[#FFF8E9] border border-[#FFD84D] space-y-1.5 text-xs">
                <p className="font-extrabold text-[#B45309]">
                  {language === 'ar' ? 'رمز قبول الدعوة (يقبل بالبريد المدعو فقط):' : 'Invite Token (matched email required to accept):'}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded-xl bg-white font-mono-num text-[11px] break-all">
                    {issuedToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(issuedToken);
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 1500);
                    }}
                    className="p-2 rounded-xl bg-[#8054D9] text-white cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </form>

          <form onSubmit={(e) => void handleAcceptInvite(e)} className="nono-card rounded-3xl p-5 bg-white space-y-3">
            <h3 className="text-sm font-extrabold text-[#27345C]">
              {language === 'ar' ? 'هل تلقّيت دعوة انضمام لعائلة؟' : 'Have a Family Guardian Invite Token?'}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={acceptToken}
                onChange={(e) => setAcceptToken(e.target.value)}
                placeholder={language === 'ar' ? 'الصق رمز الدعوة هنا' : 'Paste invite token'}
                className="flex-1 h-10 px-3 rounded-xl border border-[#27345C]/15 text-xs font-mono-num"
              />
              <button
                type="submit"
                disabled={busy || !acceptToken.trim()}
                className="h-10 px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold cursor-pointer disabled:opacity-45"
              >
                {language === 'ar' ? 'قبول' : 'Accept'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-7 nono-card rounded-3xl p-5 bg-white space-y-4">
          <h2 className="text-lg font-extrabold text-[#27345C] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8054D9]" />
            <span>{language === 'ar' ? 'أعضاء العائلة والصلاحيات الدقيقة' : 'Active Family Guardians & Permissions'}</span>
          </h2>

          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.id} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#27345C]/10 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-sm text-[#27345C]">{m.displayName}</p>
                    <p className="text-xs text-[#27345C]/65">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-[#F3ECFF] text-[#8054D9] text-[11px] font-extrabold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>{roleBadge(m.role)}</span>
                    </span>
                    {m.role !== 'primary_guardian' && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeMember(m.id)}
                        className="p-2 rounded-xl bg-[#FEE2E2] text-[#991B1B] cursor-pointer"
                        title={language === 'ar' ? 'سحب الصلاحية' : 'Revoke Access'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {m.role !== 'primary_guardian' && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(Object.keys(PERM_LABELS) as GuardianPermission[]).map((perm) => {
                      const has = m.permissions.includes(perm);
                      return (
                        <button
                          key={perm}
                          type="button"
                          onClick={() => void togglePermission(m, perm)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            has
                              ? 'bg-[#DCFCE7] border-[#22C55E] text-[#14532D]'
                              : 'bg-white border-[#27345C]/12 text-[#27345C]/60'
                          }`}
                        >
                          {has ? '✓ ' : '+ '}
                          {PERM_LABELS[perm][language]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {invitations.length > 0 && (
            <div className="pt-3 border-t border-[#27345C]/10 space-y-2">
              <p className="text-xs font-extrabold text-[#27345C]/70">
                {language === 'ar' ? 'دعوات بانتظار القبول:' : 'Pending Invitations:'}
              </p>
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-2.5 rounded-xl bg-[#FFF8E9] border border-[#FFD84D]/50 text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-bold text-[#27345C]">
                    {inv.email} ({roleBadge(inv.role)})
                  </span>
                  <span className="text-[11px] text-[#27345C]/65">
                    {language === 'ar' ? 'تنتهي' : 'Expires'} {formatDate(inv.expiresAt, language)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
