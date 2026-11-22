import {
  ALL_LEVEL1_LESSONS,
  LEVEL1_ARABIC_LESSONS,
  LEVEL1_COLOR_LESSONS,
  LEVEL1_ENGLISH_LESSONS,
  LEVEL1_NUMBER_LESSONS,
} from './level1Curriculum';
import { Level1QuestionItem } from '../types/nonoland';

function rotateOptions<T>(arr: T[], shift: number): T[] {
  if (arr.length === 0) return arr;
  const s = ((shift % arr.length) + arr.length) % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

function buildArabicBank(): Level1QuestionItem[] {
  const items: Level1QuestionItem[] = [];

  LEVEL1_ARABIC_LESSONS.forEach((lesson, idx) => {
    const d1 = LEVEL1_ARABIC_LESSONS[(idx + 3) % LEVEL1_ARABIC_LESSONS.length];
    const d2 = LEVEL1_ARABIC_LESSONS[(idx + 7) % LEVEL1_ARABIC_LESSONS.length];
    const d3 = LEVEL1_ARABIC_LESSONS[(idx + 12) % LEVEL1_ARABIC_LESSONS.length];

    const vTeach1 = lesson.teachingVocab[0];
    const vTeach2 = lesson.teachingVocab[1];
    const vUnseen1 = lesson.unseenVocab[0];
    const vUnseen2 = lesson.unseenVocab[1] || vUnseen1;
    const vOther = d1.teachingVocab[0];

    const wrongTip = {
      ar: `انتبه لشكل حرف (${lesson.targetSymbol}) وصوته في كلمة "${vTeach1.text}"، وجرب مرة أخرى!`,
      en: `Look closely at (${lesson.targetSymbol}) and listen to "${vTeach1.text}". Try again!`,
    };

    const letterChoices3 = (shift: number) =>
      rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
          { id: 'd1', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
          { id: 'd2', label: { ar: d2.targetSymbol, en: d2.targetSymbol }, visual: d2.targetSymbol },
        ],
        shift,
      );

    // Q1 — VISUAL IDENTIFICATION
    items.push({
      id: `${lesson.id}-Q01`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'visual-id',
      prompt: {
        ar: `اضغط على حرف (${lesson.targetSymbol}) من بين الحروف التالية:`,
        en: `Tap the Arabic letter (${lesson.targetSymbol}):`,
      },
      audioText: `اختر حرف ${lesson.targetSymbol}`,
      audioLang: 'ar',
      options: letterChoices3(idx + 1),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q2 — AUDIO IDENTIFICATION
    items.push({
      id: `${lesson.id}-Q02`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'audio-id',
      prompt: {
        ar: 'اسمع اسم الحرف ثم اختر الشكل الصحيح:',
        en: 'Listen to the letter name and select it:',
      },
      audioText: `${lesson.title.ar}`,
      audioLang: 'ar',
      options: letterChoices3(idx + 2),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q3 — PICTURE MATCHING
    items.push({
      id: `${lesson.id}-Q03`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'picture-match',
      prompt: {
        ar: `صورة (${vTeach1.text}) — اختر الحرف الذي تبدأ به:`,
        en: `Picture of ${vTeach1.secondaryText || vTeach1.text} — pick its starting Arabic letter:`,
      },
      visualCue: `${vTeach1.emoji} ${vTeach1.text}`,
      audioText: `${vTeach1.text}`,
      audioLang: 'ar',
      options: letterChoices3(idx + 3),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q4 — INITIAL SOUND (YES / NO)
    const isYesCase = idx % 2 === 0;
    const q4Word = isYesCase ? vTeach2 : vOther;
    items.push({
      id: `${lesson.id}-Q04`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'initial-sound',
      prompt: {
        ar: `هل تبدأ كلمة "${q4Word.text}" بحرف (${lesson.targetSymbol})؟`,
        en: `Does "${q4Word.text}" start with (${lesson.targetSymbol})?`,
      },
      visualCue: `${q4Word.emoji} ${q4Word.text}`,
      audioText: `هل كلمة ${q4Word.text} تبدأ بحرف ${lesson.targetSymbol}؟`,
      audioLang: 'ar',
      options: [
        { id: 'yes', label: { ar: 'نعم 👍', en: 'Yes 👍' }, visual: '✅' },
        { id: 'no', label: { ar: 'لا 👎', en: 'No 👎' }, visual: '❌' },
      ],
      correctOptionId: isYesCase ? 'yes' : 'no',
      feedbackOnWrong: wrongTip,
    });

    // Q5 — LETTER FINDER (4 choices)
    items.push({
      id: `${lesson.id}-Q05`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'finder',
      prompt: {
        ar: `ابحث عن حرف (${lesson.targetSymbol}) بين الحروف الأربعة:`,
        en: `Find (${lesson.targetSymbol}) among these 4 letters:`,
      },
      audioText: `ابحث عن حرف ${lesson.targetSymbol}`,
      audioLang: 'ar',
      options: rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
          { id: 'd1', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
          { id: 'd2', label: { ar: d2.targetSymbol, en: d2.targetSymbol }, visual: d2.targetSymbol },
          { id: 'd3', label: { ar: d3.targetSymbol, en: d3.targetSymbol }, visual: d3.targetSymbol },
        ],
        idx + 1,
      ),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q6 — LETTER-PICTURE MATCH
    items.push({
      id: `${lesson.id}-Q06`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'letter-picture',
      prompt: {
        ar: `أي صورة تبدأ بحرف (${lesson.targetSymbol})؟`,
        en: `Which picture begins with (${lesson.targetSymbol})?`,
      },
      audioText: `أي صورة تبدأ بحرف ${lesson.targetSymbol}`,
      audioLang: 'ar',
      options: rotateOptions(
        [
          { id: 'target', label: { ar: vUnseen2.text, en: vUnseen2.text }, visual: vUnseen2.emoji },
          { id: 'd1', label: { ar: vOther.text, en: vOther.text }, visual: vOther.emoji },
        ],
        idx,
      ),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q7 — LISTEN AND CHOOSE
    items.push({
      id: `${lesson.id}-Q07`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'listen-choose',
      prompt: {
        ar: `اسمع الكلمة واختر الصورة التي تبدأ بحرف (${lesson.targetSymbol}):`,
        en: `Listen and pick the word starting with (${lesson.targetSymbol}):`,
      },
      audioText: `${vTeach2.text}`,
      audioLang: 'ar',
      options: rotateOptions(
        [
          { id: 'target', label: { ar: vTeach2.text, en: vTeach2.text }, visual: vTeach2.emoji },
          { id: 'd1', label: { ar: d2.teachingVocab[0].text, en: d2.teachingVocab[0].text }, visual: d2.teachingVocab[0].emoji },
        ],
        idx + 1,
      ),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q8 — ODD ONE OUT (find target among 2 identical distractors)
    items.push({
      id: `${lesson.id}-Q08`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'odd-one-out',
      prompt: {
        ar: `البطاقة المختلفة هي حرف (${lesson.targetSymbol}) — أين هي؟`,
        en: `Spot the unique card showing (${lesson.targetSymbol}):`,
      },
      audioText: `اختر الحرف المختلف ${lesson.targetSymbol}`,
      audioLang: 'ar',
      options: rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
          { id: 'd1', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
          { id: 'd1b', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
        ],
        idx + 2,
      ),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q9 — NEW EXAMPLE (unseen vocab)
    items.push({
      id: `${lesson.id}-Q09`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'new-example',
      prompt: {
        ar: `كلمة جديدة: (${vUnseen1.text}) — ما الحرف الأول فيها؟`,
        en: `New word: "${vUnseen1.text}" — which Arabic letter is first?`,
      },
      visualCue: `${vUnseen1.emoji} ${vUnseen1.text}`,
      audioText: `${vUnseen1.text}`,
      audioLang: 'ar',
      options: letterChoices3(idx),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });

    // Q10 — INDEPENDENT CHALLENGE (no visual hint)
    items.push({
      id: `${lesson.id}-Q10`,
      lessonId: lesson.id,
      subject: 'arabic',
      qType: 'independent',
      prompt: {
        ar: `تحدٍّ مستقل: اختر حرف (${lesson.title.ar.replace('اكتشف حرف ', '')}) بمفردك!`,
        en: `Independent challenge: select ${lesson.targetSymbol} on your own!`,
      },
      audioText: `${lesson.targetSymbol}`,
      audioLang: 'ar',
      options: rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
          { id: 'd1', label: { ar: d2.targetSymbol, en: d2.targetSymbol }, visual: d2.targetSymbol },
          { id: 'd2', label: { ar: d3.targetSymbol, en: d3.targetSymbol }, visual: d3.targetSymbol },
        ],
        idx + 1,
      ),
      correctOptionId: 'target',
      feedbackOnWrong: wrongTip,
    });
  });

  return items;
}

function buildEnglishBank(): Level1QuestionItem[] {
  const items: Level1QuestionItem[] = [];

  LEVEL1_ENGLISH_LESSONS.forEach((lesson, idx) => {
    const d1 = LEVEL1_ENGLISH_LESSONS[(idx + 4) % LEVEL1_ENGLISH_LESSONS.length];
    const d2 = LEVEL1_ENGLISH_LESSONS[(idx + 9) % LEVEL1_ENGLISH_LESSONS.length];
    const d3 = LEVEL1_ENGLISH_LESSONS[(idx + 14) % LEVEL1_ENGLISH_LESSONS.length];

    const vTeach1 = lesson.teachingVocab[0];
    const vTeach2 = lesson.teachingVocab[1];
    const vUnseen1 = lesson.unseenVocab[0];
    const vUnseen2 = lesson.unseenVocab[1] || vUnseen1;
    const vOther = d1.teachingVocab[0];

    const wrongTip = {
      ar: `تذكّر شكل الحرف الكبير (${lesson.targetSymbol}) والصغير (${lesson.secondarySymbol}) في كلمة ${vTeach1.text}.`,
      en: `Remember uppercase ${lesson.targetSymbol} and lowercase ${lesson.secondarySymbol} as in ${vTeach1.text}!`,
    };

    const upperChoices = (shift: number) =>
      rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
          { id: 'd1', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
          { id: 'd2', label: { ar: d2.targetSymbol, en: d2.targetSymbol }, visual: d2.targetSymbol },
        ],
        shift,
      );

    items.push(
      {
        id: `${lesson.id}-Q01`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'visual-id',
        prompt: { ar: `اضغط على حرف (${lesson.targetSymbol}):`, en: `Tap the letter ${lesson.targetSymbol}:` },
        audioText: `Find letter ${lesson.targetSymbol}`,
        audioLang: 'en',
        options: upperChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q02`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'audio-id',
        prompt: { ar: `اسمع اسم الحرف واختره:`, en: `Listen to the letter name and tap it:` },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'en',
        options: upperChoices(idx + 2),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q03`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'picture-match',
        prompt: { ar: `صورة (${vTeach1.text}) تبدأ بأي حرف إنجليزي؟`, en: `Which letter does "${vTeach1.text}" start with?` },
        visualCue: `${vTeach1.emoji} ${vTeach1.text}`,
        audioText: `${vTeach1.text}`,
        audioLang: 'en',
        options: upperChoices(idx),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q04`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'initial-sound',
        prompt: {
          ar: `اختر الحرف الصغير (Lowercase) لحرف (${lesson.targetSymbol}):`,
          en: `Match uppercase ${lesson.targetSymbol} to its lowercase twin:`,
        },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: lesson.secondarySymbol || '', en: lesson.secondarySymbol || '' }, visual: lesson.secondarySymbol || '' },
            { id: 'd1', label: { ar: d1.secondarySymbol || '', en: d1.secondarySymbol || '' }, visual: d1.secondarySymbol || '' },
            { id: 'd2', label: { ar: d2.secondarySymbol || '', en: d2.secondarySymbol || '' }, visual: d2.secondarySymbol || '' },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q05`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'finder',
        prompt: { ar: `ابحث عن الحرف (${lesson.targetSymbol}) بين 4 حروف:`, en: `Find letter ${lesson.targetSymbol} among 4 letters:` },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.targetSymbol }, visual: lesson.targetSymbol },
            { id: 'd1', label: { ar: d1.targetSymbol, en: d1.targetSymbol }, visual: d1.targetSymbol },
            { id: 'd2', label: { ar: d2.targetSymbol, en: d2.targetSymbol }, visual: d2.targetSymbol },
            { id: 'd3', label: { ar: d3.targetSymbol, en: d3.targetSymbol }, visual: d3.targetSymbol },
          ],
          idx + 2,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q06`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'letter-picture',
        prompt: { ar: `أي صورة تبدأ بحرف (${lesson.targetSymbol})؟`, en: `Which picture begins with ${lesson.targetSymbol}?` },
        audioText: `Which picture starts with ${lesson.targetSymbol}?`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vTeach2.text, en: vTeach2.text }, visual: vTeach2.emoji },
            { id: 'd1', label: { ar: vOther.text, en: vOther.text }, visual: vOther.emoji },
          ],
          idx,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q07`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'listen-choose',
        prompt: { ar: `اسمع الكلمة واختر الصورة الصحيحة:`, en: `Listen and pick the matching word picture:` },
        audioText: `${vTeach1.text}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vTeach1.text, en: vTeach1.text }, visual: vTeach1.emoji },
            { id: 'd1', label: { ar: d2.teachingVocab[0].text, en: d2.teachingVocab[0].text }, visual: d2.teachingVocab[0].emoji },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q08`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'odd-one-out',
        prompt: { ar: `اضغط على البطاقة المختلفة (${lesson.secondarySymbol}):`, en: `Tap the unique lowercase letter (${lesson.secondarySymbol}):` },
        audioText: `${lesson.secondarySymbol}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: lesson.secondarySymbol || '', en: lesson.secondarySymbol || '' }, visual: lesson.secondarySymbol || '' },
            { id: 'd1', label: { ar: d1.secondarySymbol || '', en: d1.secondarySymbol || '' }, visual: d1.secondarySymbol || '' },
            { id: 'd1b', label: { ar: d1.secondarySymbol || '', en: d1.secondarySymbol || '' }, visual: d1.secondarySymbol || '' },
          ],
          idx + 2,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q09`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'new-example',
        prompt: { ar: `كلمة جديدة: ${vUnseen1.text} — بأي حرف تبدأ؟`, en: `New word: "${vUnseen1.text}" — which letter is first?` },
        visualCue: `${vUnseen1.emoji} ${vUnseen1.text}`,
        audioText: `${vUnseen1.text}`,
        audioLang: 'en',
        options: upperChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q10`,
        lessonId: lesson.id,
        subject: 'english',
        qType: 'independent',
        prompt: { ar: `تحدٍّ مستقل: اختر الكلمة التي تبدأ بحرف (${lesson.targetSymbol}):`, en: `Independent check: pick the picture starting with ${lesson.targetSymbol}:` },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vUnseen2.text, en: vUnseen2.text }, visual: vUnseen2.emoji },
            { id: 'd1', label: { ar: d3.teachingVocab[0].text, en: d3.teachingVocab[0].text }, visual: d3.teachingVocab[0].emoji },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
    );
  });

  return items;
}

function buildNumbersBank(): Level1QuestionItem[] {
  const items: Level1QuestionItem[] = [];

  LEVEL1_NUMBER_LESSONS.forEach((lesson, idx) => {
    const val = lesson.numberValue ?? 0;
    const alt1 = (val + 2) % 11;
    const alt2 = (val + 5) % 11;
    const alt3 = (val + 7) % 11;

    const repeatEmoji = (n: number, icon: string) =>
      n === 0 ? '🧺 (فارغ / 0)' : Array.from({ length: n }).map(() => icon).join(' ');

    const wrongTip = {
      ar:
        val === 0
          ? 'تذكّر: الصفر (0) يعني لا توجد أي عناصر (السلة فارغة).'
          : `عدّ العناصر واحداً تلو الآخر حتى تصل إلى العدد (${val}).`,
      en:
        val === 0
          ? 'Remember: Zero (0) means none — an empty basket!'
          : `Count each item slowly one by one up to ${val}!`,
    };

    const numChoices = (shift: number) =>
      rotateOptions(
        [
          { id: 'target', label: { ar: `${val}`, en: `${val}` }, visual: `${val}` },
          { id: 'd1', label: { ar: `${alt1}`, en: `${alt1}` }, visual: `${alt1}` },
          { id: 'd2', label: { ar: `${alt2}`, en: `${alt2}` }, visual: `${alt2}` },
        ],
        shift,
      );

    items.push(
      {
        id: `${lesson.id}-Q01`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'visual-id',
        prompt: { ar: `اختر الرقم (${val}):`, en: `Tap the number ${val}:` },
        audioText: `${val}`,
        audioLang: 'ar',
        options: numChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q02`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'audio-id',
        prompt: { ar: `اسمع اسم الرقم (${lesson.secondarySymbol}) ثم اختره:`, en: `Listen and pick number ${val}:` },
        audioText: `${lesson.secondarySymbol}`,
        audioLang: 'ar',
        options: numChoices(idx + 2),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q03`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'picture-match',
        prompt: { ar: `كم عنصراً في الصورة؟`, en: `How many objects do you count?` },
        visualCue: repeatEmoji(val, '🍎'),
        audioText: `كم تفاحة في الصورة؟`,
        audioLang: 'ar',
        options: numChoices(idx),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q04`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'initial-sound',
        prompt: {
          ar: `هل تمثل هذه الصورة العدد (${val})؟`,
          en: `Does this picture show ${val}?`,
        },
        visualCue: repeatEmoji(val, '⭐'),
        audioText: `${val}`,
        audioLang: 'en',
        options: [
          { id: 'yes', label: { ar: 'نعم 👍', en: 'Yes 👍' }, visual: '✅' },
          { id: 'no', label: { ar: 'لا 👎', en: 'No 👎' }, visual: '❌' },
        ],
        correctOptionId: 'yes',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q05`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'finder',
        prompt: { ar: `ابحث عن العدد (${val}) بين الأربعة أرقام:`, en: `Find number ${val} among these 4:` },
        audioText: `${val}`,
        audioLang: 'en',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: `${val}`, en: `${val}` }, visual: `${val}` },
            { id: 'd1', label: { ar: `${alt1}`, en: `${alt1}` }, visual: `${alt1}` },
            { id: 'd2', label: { ar: `${alt2}`, en: `${alt2}` }, visual: `${alt2}` },
            { id: 'd3', label: { ar: `${alt3}`, en: `${alt3}` }, visual: `${alt3}` },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q06`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'letter-picture',
        prompt: { ar: `أي سلة تحتوي على (${val})؟`, en: `Which group shows ${val}?` },
        audioText: `اختر المجموعة التي تمثل ${val}`,
        audioLang: 'ar',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: repeatEmoji(val, '🎈'), en: repeatEmoji(val, '🎈') }, visual: val === 0 ? '🧺' : '🎈' },
            { id: 'd1', label: { ar: repeatEmoji(alt1, '🎈'), en: repeatEmoji(alt1, '🎈') }, visual: '🎈' },
          ],
          idx,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q07`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'listen-choose',
        prompt: { ar: `اسمع الرقم بالإنجليزية واختره:`, en: `Listen to the English number and tap it:` },
        audioText: `${lesson.teachingVocab[0].secondaryText || val}`,
        audioLang: 'en',
        options: numChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q08`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'odd-one-out',
        prompt: { ar: `الرقم المختلف هو (${val}) — اضغط عليه:`, en: `Spot the unique number (${val}):` },
        options: rotateOptions(
          [
            { id: 'target', label: { ar: `${val}`, en: `${val}` }, visual: `${val}` },
            { id: 'd1', label: { ar: `${alt1}`, en: `${alt1}` }, visual: `${alt1}` },
            { id: 'd1b', label: { ar: `${alt1}`, en: `${alt1}` }, visual: `${alt1}` },
          ],
          idx + 2,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q09`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'new-example',
        prompt: { ar: `عدّ الحيوانات اللطيفة هنا:`, en: `Count these playful animals:` },
        visualCue: repeatEmoji(val, '🐥'),
        options: numChoices(idx + 2),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q10`,
        lessonId: lesson.id,
        subject: 'numbers',
        qType: 'independent',
        prompt: { ar: `تحدٍّ مستقل: كم كرة في هذه المجموعة؟`, en: `Independent challenge: count the balls:` },
        visualCue: repeatEmoji(val, '⚽'),
        options: numChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
    );
  });

  return items;
}

function buildColorsBank(): Level1QuestionItem[] {
  const items: Level1QuestionItem[] = [];

  LEVEL1_COLOR_LESSONS.forEach((lesson, idx) => {
    const d1 = LEVEL1_COLOR_LESSONS[(idx + 2) % LEVEL1_COLOR_LESSONS.length];
    const d2 = LEVEL1_COLOR_LESSONS[(idx + 5) % LEVEL1_COLOR_LESSONS.length];
    const d3 = LEVEL1_COLOR_LESSONS[(idx + 7) % LEVEL1_COLOR_LESSONS.length];

    const vTeach1 = lesson.teachingVocab[0];
    const vTeach2 = lesson.teachingVocab[1];
    const vUnseen1 = lesson.unseenVocab[0];
    const vUnseen2 = lesson.unseenVocab[1] || vUnseen1;

    const wrongTip = {
      ar: `تذكّر اللون ${lesson.targetSymbol} مثل ${vTeach1.text} ${vTeach1.emoji}.`,
      en: `Remember ${lesson.secondarySymbol} like ${vTeach1.secondaryText} ${vTeach1.emoji}!`,
    };

    const colorSwatchChoices = (shift: number) =>
      rotateOptions(
        [
          { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.secondarySymbol || '' }, visual: '🎨', colorHex: lesson.colorHex },
          { id: 'd1', label: { ar: d1.targetSymbol, en: d1.secondarySymbol || '' }, visual: '🎨', colorHex: d1.colorHex },
          { id: 'd2', label: { ar: d2.targetSymbol, en: d2.secondarySymbol || '' }, visual: '🎨', colorHex: d2.colorHex },
        ],
        shift,
      );

    items.push(
      {
        id: `${lesson.id}-Q01`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'visual-id',
        prompt: { ar: `اختر اللون (${lesson.targetSymbol}):`, en: `Tap the color ${lesson.secondarySymbol}:` },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'ar',
        options: colorSwatchChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q02`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'audio-id',
        prompt: { ar: `اسمع اسم اللون بالإنجليزية واختره:`, en: `Listen and pick the color:` },
        audioText: `${lesson.secondarySymbol}`,
        audioLang: 'en',
        options: colorSwatchChoices(idx + 2),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q03`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'picture-match',
        prompt: { ar: `ما لون (${vTeach1.text})؟`, en: `What color is the ${vTeach1.secondaryText}?` },
        visualCue: vTeach1.emoji,
        options: colorSwatchChoices(idx),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q04`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'initial-sound',
        prompt: { ar: `هل (${vTeach2.text}) لونه ${lesson.targetSymbol}؟`, en: `Is ${vTeach2.secondaryText} ${lesson.secondarySymbol}?` },
        visualCue: vTeach2.emoji,
        options: [
          { id: 'yes', label: { ar: 'نعم 👍', en: 'Yes 👍' }, visual: '✅' },
          { id: 'no', label: { ar: 'لا 👎', en: 'No 👎' }, visual: '❌' },
        ],
        correctOptionId: 'yes',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q05`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'finder',
        prompt: { ar: `ابحث عن اللون (${lesson.targetSymbol}) بين 4 ألوان:`, en: `Find ${lesson.secondarySymbol} among 4 colors:` },
        options: rotateOptions(
          [
            { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.secondarySymbol || '' }, visual: '●', colorHex: lesson.colorHex },
            { id: 'd1', label: { ar: d1.targetSymbol, en: d1.secondarySymbol || '' }, visual: '●', colorHex: d1.colorHex },
            { id: 'd2', label: { ar: d2.targetSymbol, en: d2.secondarySymbol || '' }, visual: '●', colorHex: d2.colorHex },
            { id: 'd3', label: { ar: d3.targetSymbol, en: d3.secondarySymbol || '' }, visual: '●', colorHex: d3.colorHex },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q06`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'letter-picture',
        prompt: { ar: `أي شيء لونه (${lesson.targetSymbol})؟`, en: `Which object is ${lesson.secondarySymbol}?` },
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vTeach1.text, en: vTeach1.secondaryText || '' }, visual: vTeach1.emoji },
            { id: 'd1', label: { ar: d1.teachingVocab[0].text, en: d1.teachingVocab[0].secondaryText || '' }, visual: d1.teachingVocab[0].emoji },
          ],
          idx,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q07`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'listen-choose',
        prompt: { ar: `اسمع اللون واختر الصورة المطابقة له:`, en: `Listen to the color and match its picture:` },
        audioText: `${lesson.targetSymbol}`,
        audioLang: 'ar',
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vTeach2.text, en: vTeach2.secondaryText || '' }, visual: vTeach2.emoji },
            { id: 'd1', label: { ar: d2.teachingVocab[0].text, en: d2.teachingVocab[0].secondaryText || '' }, visual: d2.teachingVocab[0].emoji },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q08`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'odd-one-out',
        prompt: { ar: `أي بطاقة لونها (${lesson.targetSymbol}) مختلف عن البقية؟`, en: `Spot the unique ${lesson.secondarySymbol} card:` },
        options: rotateOptions(
          [
            { id: 'target', label: { ar: lesson.targetSymbol, en: lesson.secondarySymbol || '' }, visual: '🎨', colorHex: lesson.colorHex },
            { id: 'd1', label: { ar: d1.targetSymbol, en: d1.secondarySymbol || '' }, visual: '🎨', colorHex: d1.colorHex },
            { id: 'd1b', label: { ar: d1.targetSymbol, en: d1.secondarySymbol || '' }, visual: '🎨', colorHex: d1.colorHex },
          ],
          idx + 2,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q09`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'new-example',
        prompt: { ar: `صورة جديدة: ما لون (${vUnseen1.text})؟`, en: `New example: which color is the ${vUnseen1.secondaryText}?` },
        visualCue: vUnseen1.emoji,
        options: colorSwatchChoices(idx + 1),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
      {
        id: `${lesson.id}-Q10`,
        lessonId: lesson.id,
        subject: 'colors',
        qType: 'independent',
        prompt: { ar: `تحدٍّ مستقل: اختر الصورة ذات اللون (${lesson.targetSymbol}):`, en: `Independent challenge: select the ${lesson.secondarySymbol} object:` },
        options: rotateOptions(
          [
            { id: 'target', label: { ar: vUnseen2.text, en: vUnseen2.secondaryText || '' }, visual: vUnseen2.emoji },
            { id: 'd1', label: { ar: d3.unseenVocab[0].text, en: d3.unseenVocab[0].secondaryText || '' }, visual: d3.unseenVocab[0].emoji },
          ],
          idx + 1,
        ),
        correctOptionId: 'target',
        feedbackOnWrong: wrongTip,
      },
    );
  });

  return items;
}

export const LEVEL1_QUESTION_BANK: Level1QuestionItem[] = [
  ...buildArabicBank(),
  ...buildEnglishBank(),
  ...buildNumbersBank(),
  ...buildColorsBank(),
];

export function getQuestionsForLevel1Lesson(lessonId: string): Level1QuestionItem[] {
  return LEVEL1_QUESTION_BANK.filter((q) => q.lessonId === lessonId);
}

// Sanity check metadata helper
export const LEVEL1_CURRICULUM_COUNTS = {
  totalLessons: ALL_LEVEL1_LESSONS.length, // 75
  arabicLessons: LEVEL1_ARABIC_LESSONS.length, // 28
  englishLessons: LEVEL1_ENGLISH_LESSONS.length, // 26
  numberLessons: LEVEL1_NUMBER_LESSONS.length, // 11
  colorLessons: LEVEL1_COLOR_LESSONS.length, // 10
  totalQuestions: LEVEL1_QUESTION_BANK.length, // 750
};
