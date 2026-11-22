import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Lock,
  Printer,
  Share2,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { formatDate, t, UI_COPY } from '../i18n/translations';
import { Certificate, Language } from '../types/nonoland';
import { getSafeStageShortLabel } from '../utils/ageAdaptation';
import { soundEngine } from '../utils/soundEngine';
import { NonoLandLogo } from './NonoLandLogo';

interface CertificateModalProps {
  certificate: Certificate;
  language: Language;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  language,
  onClose,
}) => {
  const [verifyResult, setVerifyResult] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [copiedShare, setCopiedShare] = useState(false);

  // Deterministic 7x7 verification matrix derived from uniqueCode
  const qrCells = useMemo(() => {
    const code = certificate.uniqueCode || 'NONOLAND';
    const cells: boolean[] = [];
    for (let i = 0; i < 49; i++) {
      const charCode = code.charCodeAt(i % code.length);
      const isCorner =
        (i < 3 || i % 7 === 0) ||
        (i % 7 < 2 && Math.floor(i / 7) < 2) ||
        (i % 7 > 4 && Math.floor(i / 7) < 2) ||
        (i % 7 < 2 && Math.floor(i / 7) > 4);
      cells.push(isCorner || (charCode + i * 7) % 3 === 0);
    }
    return cells;
  }, [certificate.uniqueCode]);

  const handleVerifyServer = async () => {
    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(certificate.uniqueCode)}`);
      if (!res.ok) {
        setVerifyResult('invalid');
        return;
      }
      const data = await res.json();
      setVerifyResult(data.valid ? 'valid' : 'invalid');
      soundEngine.playSuccess();
    } catch {
      setVerifyResult(certificate.isOfficialExam ? 'invalid' : 'valid');
    }
  };

  const handleDownloadSvg = () => {
    const title = t(certificate.achievementTitle, language);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
      <rect width="900" height="620" rx="28" fill="#FFF8E9" stroke="#FFD84D" stroke-width="18"/>
      <rect x="28" y="28" width="844" height="564" rx="20" fill="none" stroke="#8054D9" stroke-width="4"/>
      <text x="450" y="95" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#8054D9">NonoLand Official Academy</text>
      <text x="450" y="160" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="bold" fill="#27345C">Certificate of Achievement</text>
      <text x="450" y="220" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#525F80">Proudly presented to</text>
      <text x="450" y="290" text-anchor="middle" font-family="sans-serif" font-size="46" font-weight="bold" fill="#8054D9">${certificate.childName}</text>
      <text x="450" y="360" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="#27345C">${title}</text>
      ${
        typeof certificate.score === 'number'
          ? `<text x="450" y="420" text-anchor="middle" font-family="monospace" font-size="22" font-weight="bold" fill="#55D98B">Score: ${certificate.score}/${certificate.totalQuestions} (${certificate.percentage}%)</text>`
          : ''
      }
      <text x="120" y="535" font-family="monospace" font-size="16" fill="#27345C">Date: ${certificate.issuedAt.slice(0, 10)}</text>
      <text x="780" y="535" text-anchor="end" font-family="monospace" font-size="16" fill="#27345C">ID: ${certificate.uniqueCode}</text>
    </svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${certificate.uniqueCode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleParentShare = async () => {
    const shareText = `NonoLand Official Certificate\nStudent: ${certificate.childName}\nAchievement: ${t(certificate.achievementTitle, language)}\n${
      typeof certificate.score === 'number'
        ? `Score: ${certificate.score}/${certificate.totalQuestions} (${certificate.percentage}%)\n`
        : ''
    }Certificate ID: ${certificate.uniqueCode}`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedShare(true);
      soundEngine.playPop();
      window.setTimeout(() => setCopiedShare(false), 2600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#27345C]/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-[#27345C]/70 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#55D98B]" />
            <span>
              {certificate.isOfficialExam
                ? language === 'ar'
                  ? 'شهادة امتحان رسمية موثّقة من نونو لاند'
                  : 'Official NonoLand Certified Exam Record'
                : language === 'ar'
                  ? 'شهادة إنجاز رسمية من نونو لاند'
                  : 'Official NonoLand Achievement Certificate'}
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-[#8054D9] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{language === 'ar' ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-3.5 py-2 rounded-xl bg-[#39BDF2] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'ar' ? 'تنزيل' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={handleParentShare}
              className="px-3.5 py-2 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-[#27345C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title={language === 'ar' ? 'مشاركة بإشراف الأهل' : 'Parent-controlled share'}
            >
              <Lock className="w-3.5 h-3.5 text-[#8054D9]" />
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedShare ? (language === 'ar' ? 'تم النسخ ✓' : 'Copied ✓') : language === 'ar' ? 'نسخ للمشاركة' : 'Share'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close certificate"
              className="p-2 rounded-xl bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Official Certificate Artwork */}
        <div
          id="printable-certificate"
          className="rounded-3xl border-8 border-[#FFD84D] bg-gradient-to-br from-[#FFF8E9] via-white to-[#F2EBFF] p-6 sm:p-8 text-center space-y-4 relative overflow-hidden"
        >
          <div className="flex items-center justify-center">
            <NonoLandLogo
              variant="compact"
              size="sm"
              language={language}
              wordmarkClassName="text-[#8054D9]"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#27345C]">
            {certificate.isOfficialExam
              ? language === 'ar'
                ? 'شهادة اجتياز الامتحان الرسمي'
                : 'Official Examination Certificate'
              : language === 'ar'
                ? 'شهادة تقدير وإنجاز'
                : 'Certificate of Achievement'}
          </h2>

          <p className="text-sm text-[#27345C]/75">
            {language === 'ar' ? 'تُمنح هذه الشهادة بفخر إلى المستكشف' : 'Proudly awarded to Explorer'}
          </p>

          <p className="text-3xl sm:text-4xl font-extrabold text-[#8054D9] py-2 border-y-2 border-[#FFD84D]/70">
            {certificate.childName}
          </p>

          <div className="space-y-1">
            <p className="text-base sm:text-lg font-extrabold text-[#27345C]">
              {t(certificate.achievementTitle, language)}
            </p>
            <p className="text-sm text-[#27345C]/75">
              {t(certificate.worldName, language)} ·{' '}
              {language === 'ar' ? `المستوى ${certificate.levelCompleted}` : `Level ${certificate.levelCompleted}`}
              {certificate.ageGroup && ` · ${getSafeStageShortLabel(certificate.ageGroup, language)}`}
            </p>
          </div>

          {typeof certificate.score === 'number' && typeof certificate.totalQuestions === 'number' && (
            <div className="inline-flex flex-wrap items-center justify-center gap-4 px-5 py-2.5 rounded-2xl bg-[#E2F9EC] border border-[#55D98B] text-sm font-extrabold font-mono-num text-[#27345C]">
              <span>
                {language === 'ar' ? 'النتيجة:' : 'Score:'} {certificate.score} / {certificate.totalQuestions}
              </span>
              <span>
                {certificate.percentage}% ({language === 'ar' ? `النجاح ≥ ${certificate.passingPercentage || 70}%` : `Pass ≥ ${certificate.passingPercentage || 70}%`})
              </span>
            </div>
          )}

          {/* Bottom verification strip with deterministic QR matrix */}
          <div className="pt-4 border-t border-[#27345C]/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#27345C]/75 font-mono-num">
            <div className="text-start space-y-0.5">
              <div>{formatDate(certificate.issuedAt, language)}</div>
              <div className="font-bold text-[#27345C]">ID: {certificate.uniqueCode}</div>
            </div>

            <div className="flex items-center gap-1 text-[#FF9360] font-bold">
              <Star className="w-4 h-4 fill-[#FFD84D]" />
              <span>NonoLand Verified Record</span>
            </div>

            {/* Scannable-style verification matrix */}
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-7 gap-0.5 p-1.5 rounded-lg bg-white border border-[#27345C]/20" dir="ltr">
                {qrCells.map((filled, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 ${filled ? 'bg-[#27345C]' : 'bg-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live Server Verification Footer */}
        {certificate.isOfficialExam && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleVerifyServer}
              className="px-4 py-2 rounded-xl bg-[#FFF8E9] border border-[#27345C]/15 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#8054D9]" />
              <span>{language === 'ar' ? 'تحقق من الشهادة عبر الخادم' : 'Verify Authenticity on Server'}</span>
            </button>
            {verifyResult === 'valid' && (
              <span className="text-xs font-extrabold text-[#55D98B] flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {language === 'ar'
                  ? 'شهادة رسمية سارية ومسجلة في قاعدة بيانات الخادم ✓'
                  : 'Authentic & verified in server certificate registry ✓'}
              </span>
            )}
            {verifyResult === 'invalid' && (
              <span className="text-xs font-extrabold text-[#FF4D6D]">
                {language === 'ar' ? 'الشهادة غير صالحة أو ملغاة' : 'Certificate not found or revoked'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
