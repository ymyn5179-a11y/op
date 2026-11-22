import React, { useEffect } from 'react';
import { ExternalLink, FileText, ShieldCheck, X } from 'lucide-react';
import {
  LEGAL_POLICY_META,
  PRIVACY_POLICY_SECTIONS,
  TERMS_OF_USE_SECTIONS,
} from '../data/legalPolicies';
import type { Language } from '../types/nonoland';

interface Props {
  open: boolean;
  activeDoc: 'privacy' | 'terms';
  language: Language;
  onChangeDoc: (doc: 'privacy' | 'terms') => void;
  onClose: () => void;
}

export const LegalDocumentsModal: React.FC<Props> = ({
  open,
  activeDoc,
  language,
  onChangeDoc,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sections = activeDoc === 'privacy' ? PRIVACY_POLICY_SECTIONS : TERMS_OF_USE_SECTIONS;
  const publicHref = activeDoc === 'privacy' ? `/privacy?lang=${language}` : `/terms?lang=${language}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        activeDoc === 'privacy'
          ? language === 'ar'
            ? 'سياسة الخصوصية'
            : 'Privacy Policy'
          : language === 'ar'
            ? 'شروط الاستخدام'
            : 'Terms of Use'
      }
      className="fixed inset-0 z-50 bg-[#27345C]/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl bg-white border-2 border-[#047857]/25 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#064E3B] to-[#047857] text-white flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {activeDoc === 'privacy' ? (
                <ShieldCheck className="w-5 h-5 text-[#FDE68A]" />
              ) : (
                <FileText className="w-5 h-5 text-[#FDE68A]" />
              )}
              <h2 className="text-base sm:text-lg font-extrabold">
                {activeDoc === 'privacy'
                  ? language === 'ar'
                    ? 'سياسة الخصوصية وحماية الطفل'
                    : 'Privacy Policy & Child Data Protection'
                  : language === 'ar'
                    ? 'شروط الاستخدام وتكامل Quran Foundation'
                    : 'Terms of Use & Quran Foundation Compliance'}
              </h2>
            </div>
            <p className="text-[11px] font-bold text-[#FDE68A]">
              {language === 'ar'
                ? `تاريخ السريان: ${LEGAL_POLICY_META.effectiveDateDisplay.ar} · الإصدار ${LEGAL_POLICY_META.policyVersion}`
                : `Effective Date: ${LEGAL_POLICY_META.effectiveDateDisplay.en} · Version ${LEGAL_POLICY_META.policyVersion}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center gap-1"
            >
              <span>{language === 'ar' ? 'فتح الصفحة المستقلة' : 'Open Public Page'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'ar' ? 'إغلاق' : 'Close'}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Switcher Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-[#27345C]/10 bg-[#FFFDF7] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeDoc('privacy')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
              activeDoc === 'privacy'
                ? 'bg-[#047857] text-white'
                : 'bg-white border border-[#27345C]/15 text-[#27345C]'
            }`}
          >
            {language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </button>
          <button
            type="button"
            onClick={() => onChangeDoc('terms')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-extrabold cursor-pointer transition-colors ${
              activeDoc === 'terms'
                ? 'bg-[#047857] text-white'
                : 'bg-white border border-[#27345C]/15 text-[#27345C]'
            }`}
          >
            {language === 'ar' ? 'شروط الاستخدام' : 'Terms of Use'}
          </button>
          <span className="ms-auto text-[11px] font-bold text-[#27345C]/65" dir="ltr">
            {LEGAL_POLICY_META.quranFoundationAttribution}
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-[#27345C] leading-relaxed">
          {sections.map((section) => (
            <section
              key={section.id}
              className="p-4 rounded-2xl bg-[#FFFDF7] border border-[#27345C]/10 space-y-2"
            >
              <h3 className="text-sm sm:text-base font-extrabold text-[#047857]">
                {section.heading[language]}
              </h3>
              {section.paragraphs.map((p, idx) => (
                <p key={idx} className="font-semibold text-[#27345C]/90">
                  {p[language]}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="list-disc ps-5 space-y-1.5 text-[#27345C]/85 font-semibold">
                  {section.bullets.map((b, idx) => (
                    <li key={idx} className="break-words">
                      {b[language]}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:px-5 bg-[#ECFDF5] border-t border-[#10B981]/25 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#065F46]">
          <span>
            {language === 'ar'
              ? `للتواصل وحقوق البيانات: ${LEGAL_POLICY_META.contactEmail}`
              : `Privacy & Data Rights Contact: ${LEGAL_POLICY_META.contactEmail}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-4 rounded-xl bg-[#047857] text-white font-extrabold cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
