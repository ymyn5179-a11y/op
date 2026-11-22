import React, { useEffect, useState } from 'react';
import { Bot, ShieldAlert, Volume2 } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import { AiUsageRecord } from '../../types/nonoland';
import { soundEngine } from '../../utils/soundEngine';
import { familyApi } from './shared';

interface Props {
  gateVerified: boolean;
  onRequestGateUnlock: () => void;
}

export const NonoAiControlsPanel: React.FC<Props> = ({ gateVerified, onRequestGateUnlock }) => {
  const { activeChild, authSession, language, navigate, refreshChildrenList } = useNonoLand();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [usedToday, setUsedToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(40);
  const [records, setRecords] = useState<AiUsageRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!activeChild || !authSession.authenticated || activeChild.id.startsWith('demo-')) return;
    void familyApi<{
      aiAssistantEnabled: boolean;
      voiceEnabled: boolean;
      usedToday: number;
      dailyLimit: number;
      records: AiUsageRecord[];
    }>(`/api/family/children/${encodeURIComponent(activeChild.id)}/ai-usage`, authSession.csrfToken).then((res) => {
      if (res.ok && res.data) {
        setAiEnabled(res.data.aiAssistantEnabled);
        setVoiceEnabled(res.data.voiceEnabled);
        setUsedToday(res.data.usedToday);
        setDailyLimit(res.data.dailyLimit);
        setRecords(res.data.records || []);
      }
    });
  }, [activeChild?.id, authSession.authenticated, authSession.csrfToken]);

  if (!activeChild) {
    return (
      <div className="nono-card rounded-3xl p-8 bg-white text-center space-y-3">
        <Bot className="w-8 h-8 text-[#8054D9] mx-auto" />
        <p className="text-base font-extrabold text-[#27345C]">
          {language === 'ar'
            ? 'أضف ملف طفل لإدارة ضوابط رفيق نونو الذكي'
            : 'Add a child profile to manage Nono AI & Voice controls'}
        </p>
        <button
          type="button"
          onClick={() => navigate('create-child')}
          className="nono-btn-tactile px-5 py-2.5 rounded-xl bg-[#8054D9] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
        >
          {language === 'ar' ? '+ إضافة طفل' : '+ Add Child'}
        </button>
      </div>
    );
  }

  const updateAiControls = async (patch: { aiAssistantEnabled?: boolean; voiceInteractionEnabled?: boolean }) => {
    if (!gateVerified) {
      onRequestGateUnlock();
      return;
    }
    setSaving(true);
    setErr('');
    setNotice('');
    const res = await familyApi<{ aiAssistantEnabled: boolean; voiceInteractionEnabled: boolean }>(
      `/api/family/children/${encodeURIComponent(activeChild.id)}/ai-controls`,
      authSession.csrfToken,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
    setSaving(false);
    if (!res.ok) {
      if (res.code === 'PARENT_GATE_REQUIRED') onRequestGateUnlock();
      setErr(res.error || 'Could not update AI controls');
      return;
    }
    if (res.data) {
      setAiEnabled(res.data.aiAssistantEnabled);
      setVoiceEnabled(res.data.voiceInteractionEnabled);
      await refreshChildrenList();
      soundEngine.playPop();
      setNotice(language === 'ar' ? 'تم حفظ ضوابط رفيق نونو الذكي ✓' : 'Nono AI & Voice controls saved ✓');
    }
  };

  return (
    <div className="nono-card rounded-3xl p-6 bg-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <Bot className="w-6 h-6 text-[#8054D9]" />
            <span>
              {language === 'ar'
                ? `إدارة رفيق نونو الذكي والصوتي — ${activeChild.displayName}`
                : `Nono AI & Voice Companion Controls — ${activeChild.displayName}`}
            </span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'ملخص استخدام آمن بدون تخزين رسائل حساسة أو بيانات شخصية للطفل.'
              : 'Safe usage telemetry — never exposes raw child PII or private conversations.'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-[#F4EEFF] text-[#8054D9] text-xs font-extrabold font-mono-num">
          {usedToday} / {dailyLimit} {language === 'ar' ? 'اليوم' : 'today'}
        </span>
      </div>

      {err && <p className="text-xs font-extrabold text-[#DC2626]">{err}</p>}
      {notice && <p className="text-xs font-extrabold text-[#15803D]">{notice}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="p-4 rounded-2xl bg-[#FFF8E9] border border-[#27345C]/10 flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-extrabold text-sm text-[#27345C]">
              {language === 'ar' ? 'تفعيل مساعد نونو النصي لهذا الطفل' : 'Enable Nono AI Tutor for Child'}
            </p>
            <p className="text-[11px] text-[#27345C]/70">
              {language === 'ar' ? 'بحد أقصى ٤٠ رسالة تعليمية يومياً' : 'Curriculum-scoped, 40 messages/day max'}
            </p>
          </div>
          <input
            type="checkbox"
            disabled={saving}
            checked={aiEnabled}
            onChange={(e) => void updateAiControls({ aiAssistantEnabled: e.target.checked })}
            className="w-5 h-5 accent-[#8054D9]"
          />
        </label>

        <label className="p-4 rounded-2xl bg-[#E5F6FF]/60 border border-[#39BDF2]/30 flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-extrabold text-sm text-[#27345C] flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-[#0369A1]" />
              <span>{language === 'ar' ? 'التفاعل الصوتي لنونو' : 'Nono Voice Narration & Speech'}</span>
            </p>
            <p className="text-[11px] text-[#27345C]/70">
              {language === 'ar' ? 'صوت لطيف بدون تسجيل خلفي للميكروفون' : 'Playful TTS & tap-only speech input'}
            </p>
          </div>
          <input
            type="checkbox"
            disabled={saving}
            checked={voiceEnabled}
            onChange={(e) => void updateAiControls({ voiceInteractionEnabled: e.target.checked })}
            className="w-5 h-5 accent-[#8054D9]"
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold text-[#27345C]/70">
          {language === 'ar' ? 'سجل التفاعلات التعليمية الأخيرة:' : 'Recent Sanitized AI Topics & Safety Events:'}
        </p>
        {records.length === 0 ? (
          <p className="text-xs text-[#27345C]/65">
            {language === 'ar' ? 'لا توجد تفاعلات مسجلة بعد.' : 'No AI interactions recorded yet.'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pe-1">
            {records.slice(0, 15).map((r) => (
              <div
                key={r.id}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  r.blocked ? 'bg-[#FEF3C7] border-[#F59E0B]/40' : 'bg-[#F8FAFC] border-[#27345C]/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  {r.blocked && <ShieldAlert className="w-3.5 h-3.5 text-[#B45309]" />}
                  <span className="font-extrabold text-[#27345C]">
                    {r.mode} · {r.topic || 'general'} {r.voiceUsed ? '🔊' : ''}
                  </span>
                </div>
                <span className="text-[11px] text-[#27345C]/65">{formatDate(r.createdAt, language)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
