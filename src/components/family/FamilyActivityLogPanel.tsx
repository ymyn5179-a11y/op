import React, { useEffect, useState } from 'react';
import { History, Search, ShieldAlert } from 'lucide-react';
import { useNonoLand } from '../../context/NonoLandContext';
import { formatDate } from '../../i18n/translations';
import { FamilyAuditEvent } from '../../types/nonoland';
import { familyApi } from './shared';

export const FamilyActivityLogPanel: React.FC = () => {
  const { authSession, childrenList, language } = useNonoLand();
  const [events, setEvents] = useState<FamilyAuditEvent[]>([]);
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [childId, setChildId] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    if (!authSession.authenticated) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (severity !== 'all') params.set('severity', severity);
    if (childId !== 'all') params.set('childId', childId);
    if (search.trim()) params.set('search', search.trim());
    const res = await familyApi<{ events: FamilyAuditEvent[] }>(
      `/api/family/activity-logs?${params.toString()}`,
      authSession.csrfToken,
    );
    setLoading(false);
    if (res.ok && res.data) {
      setEvents(res.data.events || []);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [authSession.authenticated, category, severity, childId]);

  return (
    <div className="nono-card rounded-3xl p-6 bg-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#27345C] flex items-center gap-2">
            <History className="w-6 h-6 text-[#8054D9]" />
            <span>{language === 'ar' ? 'سجل الأمان ونشاط العائلة' : 'Family Activity & Security Log'}</span>
          </h2>
          <p className="text-xs font-bold text-[#27345C]/70">
            {language === 'ar'
              ? 'جميع أحداث تسجيل الدخول والأجهزة والموافقات والأطفال في عائلتك فقط — بدون كشف أي كلمات مرور أو رموز سرية.'
              : 'Chronological audit timeline strictly scoped to your family — secrets and PINs are never exposed.'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold"
        >
          <option value="all">{language === 'ar' ? 'كل الفئات' : 'All Categories'}</option>
          <option value="auth">{language === 'ar' ? 'المصادقة والدخول' : 'Authentication'}</option>
          <option value="security">{language === 'ar' ? 'الأمان والبوابة' : 'Security & Gate'}</option>
          <option value="device">{language === 'ar' ? 'الأجهزة' : 'Devices'}</option>
          <option value="guardian">{language === 'ar' ? 'أولياء الأمور' : 'Guardians'}</option>
          <option value="profile">{language === 'ar' ? 'ملفات الأطفال' : 'Child Profiles'}</option>
          <option value="content">{language === 'ar' ? 'المحتوى' : 'Content Policy'}</option>
          <option value="privacy">{language === 'ar' ? 'الخصوصية' : 'Privacy'}</option>
          <option value="ai">{language === 'ar' ? 'الذكاء الاصطناعي' : 'Nono AI'}</option>
          <option value="learning">{language === 'ar' ? 'التعلم والحديقة' : 'Learning & Garden'}</option>
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold"
        >
          <option value="all">{language === 'ar' ? 'كل المستويات' : 'All Severity'}</option>
          <option value="info">{language === 'ar' ? 'عادي' : 'Info'}</option>
          <option value="warning">{language === 'ar' ? 'تنبيه' : 'Warning'}</option>
          <option value="critical">{language === 'ar' ? 'حرج' : 'Critical'}</option>
        </select>

        <select
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="h-10 px-3 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-bold"
        >
          <option value="all">{language === 'ar' ? 'كل الأطفال' : 'All Children'}</option>
          {childrenList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>

        <div className="sm:col-span-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#27345C]/45 absolute top-3 start-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث في السجل...' : 'Search timeline...'}
              className="w-full h-10 ps-9 pe-3 rounded-xl border border-[#27345C]/15 text-xs font-bold"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="h-10 px-4 rounded-xl bg-[#27345C] text-white text-xs font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'بحث' : 'Filter'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs font-bold text-[#27345C]/65">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading events...'}</p>
      ) : events.length === 0 ? (
        <p className="text-xs font-bold text-[#27345C]/65 py-6 text-center">
          {language === 'ar' ? 'لا توجد أحداث مطابقة بعد.' : 'No matching family audit events yet.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pe-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`p-3.5 rounded-2xl border text-xs flex flex-wrap items-start justify-between gap-2 ${
                ev.severity === 'warning' || ev.severity === 'critical'
                  ? 'bg-[#FFFBEB] border-[#F59E0B]/40'
                  : 'bg-[#F8FAFC] border-[#27345C]/10'
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-extrabold text-[#27345C] flex items-center gap-1.5">
                  {(ev.severity === 'warning' || ev.severity === 'critical') && (
                    <ShieldAlert className="w-3.5 h-3.5 text-[#B45309]" />
                  )}
                  <span>{ev.title[language]}</span>
                </p>
                <p className="text-[#27345C]/75 font-bold">{ev.description[language]}</p>
              </div>
              <div className="text-end shrink-0">
                <span className="px-2 py-0.5 rounded-lg bg-white border border-[#27345C]/10 font-bold text-[10px] uppercase">
                  {ev.category}
                </span>
                <p className="text-[10px] text-[#27345C]/60 mt-1">{formatDate(ev.createdAt, language)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
