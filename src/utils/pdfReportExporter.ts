import { formatNumber } from '../i18n/translations';
import { Language, MonthlyReportData } from '../types/nonoland';
import { getSafeStageDisplay } from './ageAdaptation';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function buildPdfFromJpegPages(
  pages: Array<{ jpeg: Uint8Array; pxWidth: number; pxHeight: number }>,
): Blob {
  const enc = new TextEncoder();
  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  // Objects layout:
  // 1: Catalog
  // 2: Pages
  // For each page i (0..N-1):
  //   pageObj = 3 + i*3
  //   contentObj = 4 + i*3
  //   imageObj = 5 + i*3
  const objects: Uint8Array[] = [];

  const catalogId = 1;
  const pagesId = 2;
  const pageIds: number[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    pageIds.push(3 + i * 3);
  }

  objects.push(enc.encode(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`));
  objects.push(
    enc.encode(
      `${pagesId} 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    ),
  );

  for (let i = 0; i < pages.length; i += 1) {
    const p = pages[i];
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;
    const streamCmd = `q ${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm /Im${i} Do Q\n`;
    const streamBytes = enc.encode(streamCmd);

    objects.push(
      enc.encode(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im${i} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`,
      ),
    );

    objects.push(
      enc.encode(
        `${contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamCmd}endstream\nendobj\n`,
      ),
    );

    const imgHeader = enc.encode(
      `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pxWidth} /Height ${p.pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    const imgFooter = enc.encode(`\nendstream\nendobj\n`);
    objects.push(concatChunks([imgHeader, p.jpeg, imgFooter]));
  }

  const header = enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  const offsets: number[] = [0];
  let cursor = header.length;
  const bodyChunks: Uint8Array[] = [header];

  for (const objBytes of objects) {
    offsets.push(cursor);
    bodyChunks.push(objBytes);
    cursor += objBytes.length;
  }

  const xrefOffset = cursor;
  const totalObjCount = objects.length + 1;
  let xref = `xref\n0 ${totalObjCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${totalObjCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  bodyChunks.push(enc.encode(xref + trailer));

  const finalBytes = concatChunks(bodyChunks);
  return new Blob([finalBytes as unknown as BlobPart], { type: 'application/pdf' });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

function drawRoundedBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export async function exportMonthlyReportPdf(
  report: MonthlyReportData,
  language: Language,
): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fallback cleanly to installed system fonts
    }
  }

  const W = 1240;
  const H = 1754;
  const isAr = language === 'ar';
  const fontFamily = isAr
    ? "'Cairo', 'Segoe UI', Tahoma, sans-serif"
    : "'Outfit', 'Segoe UI', Arial, sans-serif";

  const createPageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.direction = isAr ? 'rtl' : 'ltr';
    ctx.fillStyle = '#FFFDF7';
    ctx.fillRect(0, 0, W, H);
    return { canvas, ctx };
  };

  // ---------------- PAGE 1: Header, KPIs & 6-Subject Breakdown ----------------
  const p1 = createPageCanvas();
  {
    const { ctx } = p1;

    // Header gradient banner
    const grad = ctx.createLinearGradient(0, 0, W, 240);
    grad.addColorStop(0, '#6236B8');
    grad.addColorStop(0.6, '#8054D9');
    grad.addColorStop(1, '#39BDF2');
    ctx.beginPath();
    ctx.roundRect(48, 44, W - 96, 195, 28);
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw official NonoLand logo on opposite side of banner text
    let logoDrawn = false;
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = '/assets/aistudio/NonoLand_Magical_Learning_World_c827ccb2.png';
      });
      const logoW = 180;
      const logoH = 120;
      const logoX = isAr ? 84 : W - 84 - logoW;
      const logoY = 82;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoW, logoH, 16);
      ctx.clip();
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      ctx.restore();
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }

    ctx.textAlign = isAr ? 'right' : 'left';
    const textX = isAr ? W - 90 : 90;
    void logoDrawn;

    ctx.fillStyle = '#FFD84D';
    ctx.font = `700 24px ${fontFamily}`;
    ctx.fillText(
      isAr ? 'نونو لاند — التقرير الشهري لتطور الطفل' : 'NonoLand — Monthly Child Development Report',
      textX,
      100,
    );

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 42px ${fontFamily}`;
    ctx.fillText(`${report.childName} · ${report.monthKey}`, textX, 158);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 22px ${fontFamily}`;
    const stageLabel = getSafeStageDisplay(report.ageGroup, language);
    ctx.fillText(
      isAr
        ? `المرحلة التعليمية: ${stageLabel} · النجوم: ${formatNumber(report.starsEarnedTotal, language)} · السلسلة التعليمية: ${formatNumber(report.learningStreakDays, language)} يوم`
        : `Stage: ${stageLabel} · Stars: ${report.starsEarnedTotal} · Learning Streak: ${report.learningStreakDays} day(s)`,
      textX,
      206,
    );

    // 6 KPI tiles
    const kpis = [
      {
        label: isAr ? 'أيام التعلم' : 'Learning Days',
        value: formatNumber(report.learningDaysCount, language),
        color: '#8054D9',
      },
      {
        label: isAr ? 'إجمالي الدقائق' : 'Total Minutes',
        value: `${formatNumber(report.totalLearningMinutes, language)}m`,
        color: '#39BDF2',
      },
      {
        label: isAr ? 'الدروس المكتملة' : 'Lessons Done',
        value: formatNumber(report.completedLessonsCount, language),
        color: '#55D98B',
      },
      {
        label: isAr ? 'الأنشطة والألعاب' : 'Activities Done',
        value: formatNumber(report.completedActivitiesCount, language),
        color: '#FF9360',
      },
      {
        label: isAr ? 'تجارب المختبر' : 'Lab Experiments',
        value: formatNumber(report.completedLabCount, language),
        color: '#6366F1',
      },
      {
        label: isAr ? 'القصص والتقييمات' : 'Stories & Exams',
        value: `${formatNumber(report.completedStoriesCount + report.assessmentsCount, language)}`,
        color: '#FF78B7',
      },
    ];

    const colW = (W - 96 - 40) / 3;
    kpis.forEach((k, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const bx = 48 + col * (colW + 20);
      const by = 270 + row * 124;
      drawRoundedBox(ctx, bx, by, colW, 108, 20, '#FFFFFF', 'rgba(39,52,92,0.12)');
      ctx.textAlign = 'center';
      ctx.fillStyle = k.color;
      ctx.font = `800 36px ${fontFamily}`;
      ctx.fillText(k.value, bx + colW / 2, by + 54);
      ctx.fillStyle = '#27345C';
      ctx.font = `700 20px ${fontFamily}`;
      ctx.fillText(k.label, bx + colW / 2, by + 88);
    });

    // Subject Performance Section
    ctx.textAlign = isAr ? 'right' : 'left';
    ctx.fillStyle = '#27345C';
    ctx.font = `800 30px ${fontFamily}`;
    ctx.fillText(
      isAr ? 'تحليل التطور حسب المجالات السبعة' : '7-Domain Growth Breakdown',
      isAr ? W - 48 : 48,
      556,
    );

    const notEnoughLabel = isAr ? 'لا توجد بيانات كافية' : 'Not enough data';
    report.subjectBreakdown.forEach((s, idx) => {
      const ry = 584 + idx * 148;
      drawRoundedBox(ctx, 48, ry, W - 96, 134, 20, '#FFF8E9', 'rgba(39,52,92,0.12)');

      const titleX = isAr ? W - 78 : 78;
      ctx.textAlign = isAr ? 'right' : 'left';
      ctx.fillStyle = '#27345C';
      ctx.font = `800 24px ${fontFamily}`;
      ctx.fillText(isAr ? s.title.ar : s.title.en, titleX, ry + 38);

      ctx.fillStyle = s.subjectKey === 'quran-values' ? '#047857' : '#8054D9';
      ctx.font = `700 18px ${fontFamily}`;

      const summaryLine =
        s.subjectKey === 'quran-values'
          ? isAr
            ? `مستقل عن درجات الاختبارات  |  الأنشطة المسجلة: ${s.completedLessonsAndActivities}  |  المؤكد من الأهل / المألوف: ${s.demonstratedCount}`
            : `Independent of Exam Scores  |  Logged Moments: ${s.completedLessonsAndActivities}  |  Familiar / Parent-Confirmed: ${s.demonstratedCount}`
          : (() => {
              const baseText =
                s.baselineAvailable && s.baselineAccuracyPct !== null ? `${s.baselineAccuracyPct}%` : notEnoughLabel;
              const currText = s.currentAccuracyPct !== null ? `${s.currentAccuracyPct}%` : notEnoughLabel;
              const deltaText =
                s.improvementDeltaPct !== null
                  ? `${s.improvementDeltaPct >= 0 ? '+' : ''}${s.improvementDeltaPct}%`
                  : notEnoughLabel;
              return isAr
                ? `نقطة البداية: ${baseText}  |  المستوى الحالي: ${currText}  |  التغير: ${deltaText}  |  الأنشطة: ${s.completedLessonsAndActivities}`
                : `Start Baseline: ${baseText}  |  Current: ${currText}  |  Delta: ${deltaText}  |  Completed: ${s.completedLessonsAndActivities}`;
            })();
      ctx.fillText(summaryLine, titleX, ry + 74);

      ctx.fillStyle = '#475569';
      ctx.font = `600 17px ${fontFamily}`;
      const noteText = isAr ? s.note.ar : s.note.en;
      const lines = wrapTextLines(ctx, noteText, W - 180);
      ctx.fillText(lines[0] || '', titleX, ry + 110);
    });

    // Footer P1
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = `600 18px ${fontFamily}`;
    ctx.fillText('NonoLand Educational World · Page 1 / 2', W / 2, H - 36);
  }

  // ---------------- PAGE 2: Achievements, Strengths, Attention & Next Month Plan ----------------
  const p2 = createPageCanvas();
  {
    const { ctx } = p2;
    let cursorY = 64;
    const textX = isAr ? W - 78 : 78;

    const drawSectionBlock = (
      title: string,
      items: string[],
      bg: string,
      accent: string,
    ) => {
      const boxHeight = Math.max(150, 74 + items.length * 46);
      drawRoundedBox(ctx, 48, cursorY, W - 96, boxHeight, 24, bg, 'rgba(39,52,92,0.12)');
      ctx.textAlign = isAr ? 'right' : 'left';
      ctx.fillStyle = accent;
      ctx.font = `800 27px ${fontFamily}`;
      ctx.fillText(title, textX, cursorY + 46);

      ctx.fillStyle = '#27345C';
      ctx.font = `600 20px ${fontFamily}`;
      items.forEach((line, i) => {
        const wrapped = wrapTextLines(ctx, `• ${line}`, W - 170);
        ctx.fillText(wrapped[0] || line, textX, cursorY + 90 + i * 44);
      });
      cursorY += boxHeight + 28;
    };

    const badgeText =
      report.achievementsEarned.length > 0
        ? report.achievementsEarned.map((b) => `${b.emoji} ${isAr ? b.title.ar : b.title.en}`)
        : [isAr ? 'سيظهر سجل الأوسمة بمجرد فتح أول وسام.' : 'Badges earned will appear here as adventures unlock.'];

    drawSectionBlock(
      isAr ? 'الإنجازات والأوسمة المحققة' : 'Achievements & Badges Earned',
      badgeText.slice(0, 5),
      '#F3E8FF',
      '#6236B8',
    );

    drawSectionBlock(
      isAr ? 'أبرز نقاط القوة والتميز' : 'Top Learning Strengths',
      report.strengths.slice(0, 4).map((s) => (isAr ? s.ar : s.en)),
      '#E2F9EC',
      '#166534',
    );

    drawSectionBlock(
      isAr ? 'مجالات تستفيد من دعم لطيف' : 'Areas Benefiting from Gentle Support',
      report.areasNeedingAttention.slice(0, 4).map((s) => (isAr ? s.ar : s.en)),
      '#FFF3D1',
      '#B45309',
    );

    const planItems = (report.nextMonthPlan || [])
      .filter((g) => g.enabled)
      .slice(0, 5)
      .map(
        (g) =>
          `${isAr ? g.title.ar : g.title.en} — ${
            isAr ? `الهدف: ${g.targetCount} أنشطة` : `Target: ${g.targetCount} activities`
          } (${isAr ? g.focusNote.ar : g.focusNote.en})`,
      );

    drawSectionBlock(
      isAr ? 'خطة التعلم للشهر القادم (قابلة للتخصيص من ولي الأمر)' : 'Next Month Learning Plan',
      planItems.length > 0
        ? planItems
        : [isAr ? 'الاستمرار في ١٠–١٥ دقيقة يومياً عبر القصص والمختبر.' : 'Continue gentle 10–15 min daily sessions.'],
      '#E5F6FF',
      '#0369A1',
    );

    // Note on data honesty
    ctx.textAlign = 'center';
    ctx.fillStyle = '#475569';
    ctx.font = `600 18px ${fontFamily}`;
    ctx.fillText(
      isAr
        ? 'ملاحظة: تعكس هذه الأرقام النشاط الفعلي المسجل لطفلك ولا تمثل تشخيصاً طبياً.'
        : 'Note: Metrics reflect recorded educational activity only and do not constitute medical diagnosis.',
      W / 2,
      H - 76,
    );
    ctx.fillStyle = '#64748B';
    ctx.fillText('NonoLand Educational World · Page 2 / 2', W / 2, H - 36);
  }

  const page1Jpeg = dataUrlToUint8Array(p1.canvas.toDataURL('image/jpeg', 0.92));
  const page2Jpeg = dataUrlToUint8Array(p2.canvas.toDataURL('image/jpeg', 0.92));
  const pdfBlob = buildPdfFromJpegPages([
    { jpeg: page1Jpeg, pxWidth: W, pxHeight: H },
    { jpeg: page2Jpeg, pxWidth: W, pxHeight: H },
  ]);

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = report.childName.replace(/[^\w\u0600-\u06FF-]+/g, '_') || 'Child';
  a.download = `NonoLand-Monthly-Report-${safeName}-${report.monthKey}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
