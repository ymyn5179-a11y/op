import type express from 'express';
import {
  LEGAL_POLICY_META,
  LEGAL_SUB_PROCESSORS,
  PRIVACY_POLICY_SECTIONS,
  TERMS_OF_USE_SECTIONS,
  type LegalSection,
} from '../src/data/legalPolicies';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLegalHtmlDocument(docType: 'privacy' | 'terms', lang: 'en' | 'ar'): string {
  const isAr = lang === 'ar';
  const sections: LegalSection[] =
    docType === 'privacy' ? PRIVACY_POLICY_SECTIONS : TERMS_OF_USE_SECTIONS;

  const titleText =
    docType === 'privacy'
      ? isAr
        ? 'سياسة الخصوصية وحماية الطفل — نونو لاند (NonoLand)'
        : 'Privacy Policy & Child Data Protection — NonoLand'
      : isAr
        ? 'شروط الاستخدام وتكامل Quran Foundation — نونو لاند (NonoLand)'
        : 'Terms of Use & Quran Foundation Compliance — NonoLand';

  const switchLangUrl =
    docType === 'privacy'
      ? `/privacy?lang=${isAr ? 'en' : 'ar'}`
      : `/terms?lang=${isAr ? 'en' : 'ar'}`;
  const siblingUrl =
    docType === 'privacy'
      ? `/terms?lang=${lang}`
      : `/privacy?lang=${lang}`;

  const sectionsHtml = sections
    .map((sec) => {
      const paragraphsHtml = sec.paragraphs
        .map((p) => `<p>${escapeHtml(p[lang])}</p>`)
        .join('\n');
      const bulletsHtml = sec.bullets?.length
        ? `<ul>${sec.bullets.map((b) => `<li>${escapeHtml(b[lang])}</li>`).join('\n')}</ul>`
        : '';
      return `
        <section id="${escapeHtml(sec.id)}" class="card">
          <h2>${escapeHtml(sec.heading[lang])}</h2>
          ${paragraphsHtml}
          ${bulletsHtml}
        </section>
      `;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(titleText)}</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #fff9ed;
      color: #27345c;
      line-height: 1.7;
    }
    .wrap {
      max-width: 860px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }
    header {
      background: #064e3b;
      color: #ffffff;
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 20px;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 1.6rem;
    }
    .meta {
      font-size: 0.9rem;
      color: #fde68a;
      font-weight: 700;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .nav a {
      display: inline-block;
      padding: 7px 14px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.85rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid rgba(39, 52, 92, 0.12);
      border-radius: 16px;
      padding: 20px 22px;
      margin-bottom: 16px;
    }
    .card h2 {
      margin-top: 0;
      font-size: 1.12rem;
      color: #047857;
    }
    ul {
      padding-inline-start: 22px;
      margin-bottom: 0;
    }
    li {
      margin-bottom: 8px;
    }
    footer {
      margin-top: 24px;
      padding: 16px 20px;
      border-radius: 14px;
      background: #ecf7f2;
      border: 1px solid rgba(4, 120, 87, 0.25);
      font-size: 0.88rem;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>${escapeHtml(titleText)}</h1>
      <div class="meta">
        ${isAr ? 'تاريخ السريان' : 'Effective Date'}: ${escapeHtml(LEGAL_POLICY_META.effectiveDateDisplay[lang])} (${escapeHtml(LEGAL_POLICY_META.effectiveDate)}) ·
        ${isAr ? 'الإصدار' : 'Version'}: ${escapeHtml(LEGAL_POLICY_META.policyVersion)}
      </div>
      <div class="nav">
        <a href="/">${isAr ? 'العودة إلى نونو لاند' : 'Back to NonoLand App'}</a>
        <a href="${escapeHtml(siblingUrl)}">${
          docType === 'privacy'
            ? isAr
              ? 'شروط الاستخدام'
              : 'Terms of Use'
            : isAr
              ? 'سياسة الخصوصية'
              : 'Privacy Policy'
        }</a>
        <a href="${escapeHtml(switchLangUrl)}">${isAr ? 'English Version' : 'النسخة العربية'}</a>
      </div>
    </header>

    ${sectionsHtml}

    <footer>
      <div>${escapeHtml(LEGAL_POLICY_META.quranFoundationAttribution)} · ${escapeHtml(LEGAL_POLICY_META.reciterAttribution)}</div>
      <div>${isAr ? 'بريد الخصوصية والبيانات:' : 'Privacy Contact:'} <a href="mailto:${escapeHtml(LEGAL_POLICY_META.contactEmail)}">${escapeHtml(LEGAL_POLICY_META.contactEmail)}</a> · ${escapeHtml(LEGAL_POLICY_META.postalAddress)}</div>
    </footer>
  </div>
</body>
</html>`;
}

export function registerLegalRoutes(app: express.Express) {
  app.get('/privacy', (req, res) => {
    const lang: 'en' | 'ar' = req.query.lang === 'ar' ? 'ar' : 'en';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(renderLegalHtmlDocument('privacy', lang));
  });

  app.get('/terms', (req, res) => {
    const lang: 'en' | 'ar' = req.query.lang === 'ar' ? 'ar' : 'en';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(renderLegalHtmlDocument('terms', lang));
  });

  app.get('/api/legal/policies', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      meta: LEGAL_POLICY_META,
      subProcessors: LEGAL_SUB_PROCESSORS,
      privacySections: PRIVACY_POLICY_SECTIONS,
      termsSections: TERMS_OF_USE_SECTIONS,
      publicUrls: {
        privacy: '/privacy',
        terms: '/terms',
      },
    });
  });
}
