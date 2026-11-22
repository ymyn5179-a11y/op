import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  XCircle,
} from 'lucide-react';
import type {
  QuranAdminConfirmations,
  QuranAudioProbeDiagnostics,
  QuranPhraseAudioAssetConfig,
  QuranReciterSpec,
  QuranSourceVerificationChecklistItem,
} from '../../types/nonoland';
import type { AdminQuranVerificationsPayload } from './QuranSharedTypes';
import {
  extractHtmlTitle,
  isHtmlPayload,
  redactSensitiveText,
  type QfPreviewState,
} from './qfDiagnosticsHelpers';

type AdminConfirmationKey =
  | 'qfDeveloperTermsAndCommercialUse'
  | 'qfAttributionAndReciterCredit'
  | 'sevenDayCachePolicy'
  | 'privacyAndTermsReadiness';

interface Props {
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
  data: AdminQuranVerificationsPayload | null;
  qfConfigured: boolean;
  qfPreview: QfPreviewState | null;
  language: 'ar' | 'en';
  onPatchData: React.Dispatch<React.SetStateAction<AdminQuranVerificationsPayload | null>>;
  onReload: () => Promise<AdminQuranVerificationsPayload | null>;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

interface InternalTestingCandidatePayload {
  configured?: boolean;
  basmalaCandidateAudioUrl?: string | null;
  surahAudioUrls?: Record<string, string>;
  ayahAudioUrls?: Record<string, string>;
  error?: string;
}

const CONFIRMATION_ITEMS: Array<{
  key: AdminConfirmationKey;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  policyVersion: string;
}> = [
  {
    key: 'qfDeveloperTermsAndCommercialUse',
    titleEn: 'Quran Foundation Developer Terms & Permitted Integrated Commercial Use',
    titleAr: 'شروط مطوري Quran Foundation والاستخدام التجاري المدمج المسموح',
    descriptionEn:
      'Confirms compliance with Quran Foundation Developer Terms (updated Nov 20, 2026): end-user integrated app use permitted without standalone redistribution or separate paid API licensing.',
    policyVersion: 'QF-Terms-2026-11-20',
  },
  {
    key: 'qfAttributionAndReciterCredit',
    titleEn: 'Quran Foundation Attribution & Reciter Credit',
    titleAr: 'إسناد Quran Foundation وذكر اسم القارئ',
    descriptionEn:
      'Confirms accessible attribution "Quran data provided by Quran.Foundation." and reciter credit "Sheikh Mahmoud Khalil Al-Husary – Hafs \'an Asim – Murattal".',
    policyVersion: 'Quran.Foundation-Credit-v4',
  },
  {
    key: 'sevenDayCachePolicy',
    titleEn: 'Seven-Day Audio URL Cache Policy',
    titleAr: 'سياسة الاحتفاظ المؤقت بروابط الصوت لمدة ٧ أيام',
    descriptionEn:
      'Confirms audio streams directly from approved Quran Foundation CDN URLs and server-side cache entries follow the 7-day limit without rehosting MP3 files.',
    policyVersion: 'QF-7-Day-Cache-Policy',
  },
  {
    key: 'privacyAndTermsReadiness',
    titleEn: 'Privacy Policy & Terms of Use Readiness',
    titleAr: 'جاهزية سياسة الخصوصية وشروط الاستخدام',
    descriptionEn:
      'Confirms public /privacy and /terms disclosures are complete, accessible to families, and meet Quran Foundation Privacy Policy requirements.',
    policyVersion: 'NonoLand-Policy-2026.04',
  },
];

function badgeForChecklistStatus(status: QuranSourceVerificationChecklistItem['status']): {
  label: string;
  className: string;
} {
  if (status === 'passed') {
    return { label: 'PASSED', className: 'bg-[#DCFCE7] text-[#166534]' };
  }
  if (status === 'failed') {
    return { label: 'FAILED', className: 'bg-[#FEE2E2] text-[#991B1B]' };
  }
  return { label: 'PENDING', className: 'bg-[#FEF3C7] text-[#92400E]' };
}

export const QuranReleaseApprovalSection: React.FC<Props> = ({
  apiFetch,
  data,
  qfConfigured,
  qfPreview,
  language,
  onPatchData,
  onReload,
  onNotice,
  onError,
}) => {
  const husaryRecord = useMemo(
    () => data?.customRecords?.find((r) => r.contentKey === 'adult-husary-muallim'),
    [data],
  );
  const husaryReciter: QuranReciterSpec | undefined = useMemo(
    () => data?.reciters?.find((r) => r.id === 'adult-husary-muallim'),
    [data],
  );
  const readiness = data?.releaseReadiness;
  const basmalaAsset: QuranPhraseAudioAssetConfig | undefined = data?.phraseAssets?.basmala;

  const [fetchedCandidate, setFetchedCandidate] = useState<InternalTestingCandidatePayload | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);
  const autoInspectAttemptedRef = useRef(false);

  // Per-action loading & inline error states
  const [busyConfKeys, setBusyConfKeys] = useState<Partial<Record<AdminConfirmationKey, boolean>>>({});
  const [confCardErrors, setConfCardErrors] = useState<Partial<Record<AdminConfirmationKey, string>>>({});
  const [probingBasmala, setProbingBasmala] = useState<'probe' | 'resolve' | ''>('');
  const [savingBasmalaAction, setSavingBasmalaAction] = useState<'approve' | 'reject' | ''>('');
  const [evaluatingSource, setEvaluatingSource] = useState(false);
  const [savingSourceConfirm, setSavingSourceConfirm] = useState<'confirm' | 'revoke' | ''>('');
  const [releasing, setReleasing] = useState(false);

  // Basmala approval form state (strictly mirrors saved DB state — never pre-checked)
  const [basmalaUrlInput, setBasmalaUrlInput] = useState('');
  const [basmalaReviewer, setBasmalaReviewer] = useState('');
  const [basmalaReviewDate, setBasmalaReviewDate] = useState('');
  const [basmalaLicense, setBasmalaLicense] = useState('');
  const [basmalaNotes, setBasmalaNotes] = useState('');
  const [basmalaListeningChecked, setBasmalaListeningChecked] = useState(false);
  const [basmalaTermsChecked, setBasmalaTermsChecked] = useState(false);
  const [latestProbeOverride, setLatestProbeOverride] = useState<QuranAudioProbeDiagnostics | null>(null);

  // Sync local Basmala form state whenever backend payload reloads
  useEffect(() => {
    const candidateFromBackend =
      data?.basmalaCandidate?.audioUrl || basmalaAsset?.audioUrl || '';
    if (candidateFromBackend) {
      setBasmalaUrlInput(candidateFromBackend);
    }
    if (basmalaAsset) {
      setBasmalaReviewer(basmalaAsset.reviewedBy || '');
      setBasmalaReviewDate(basmalaAsset.reviewedAt || '');
      setBasmalaLicense(
        basmalaAsset.licenseOrPermission ||
          'Quran Foundation Developer Terms (integrated app use, Reciter ID 6 Al-Husary 1:1)',
      );
      setBasmalaNotes(basmalaAsset.notes || '');
      setBasmalaListeningChecked(Boolean(basmalaAsset.humanListeningApproved));
      setBasmalaTermsChecked(Boolean(basmalaAsset.licenseConfirmed));
    }
    if (data?.basmalaCandidate?.probe) {
      setLatestProbeOverride(data.basmalaCandidate.probe);
    }
  }, [basmalaAsset, data?.basmalaCandidate]);

  const inspectQfCandidate = useCallback(
    async (silentIfMissing = false) => {
      if (!silentIfMissing) onError('');
      setLoadingCandidate(true);
      try {
        const res = await apiFetch('/api/admin/quran/internal-testing-audio', {
          cache: 'no-store',
        });
        const json = (await res.json().catch(() => ({}))) as InternalTestingCandidatePayload;
        if (res.ok) {
          setFetchedCandidate(json);
          if (!silentIfMissing && !json.basmalaCandidateAudioUrl && !json.ayahAudioUrls?.['1:1']) {
            onError(
              json.error ||
                (language === 'ar'
                  ? 'لم يتم العثور على رابط مرشح البسملة (1:1) من Quran Foundation.'
                  : 'Quran Foundation did not return a Reciter ID 6 (1:1) Basmala URL.'),
            );
          }
        } else if (!silentIfMissing) {
          onError(json.error || 'Failed to inspect Quran Foundation Reciter ID 6 audio.');
        }
      } catch {
        if (!silentIfMissing) {
          onError('Network error while inspecting Quran Foundation audio candidate.');
        }
      } finally {
        setLoadingCandidate(false);
      }
    },
    [apiFetch, language, onError],
  );

  useEffect(() => {
    if (
      !autoInspectAttemptedRef.current &&
      data &&
      qfConfigured &&
      !data.basmalaCandidate?.audioUrl &&
      !qfPreview?.ayahAudioUrls?.['1:1']
    ) {
      autoInspectAttemptedRef.current = true;
      void inspectQfCandidate(true);
    }
  }, [data, qfConfigured, qfPreview, inspectQfCandidate]);

  const basmalaCandidateUrl =
    basmalaUrlInput.trim() ||
    data?.basmalaCandidate?.audioUrl ||
    qfPreview?.ayahAudioUrls?.['1:1'] ||
    fetchedCandidate?.basmalaCandidateAudioUrl ||
    fetchedCandidate?.ayahAudioUrls?.['1:1'] ||
    basmalaAsset?.audioUrl ||
    '';

  const activeBasmalaProbe: QuranAudioProbeDiagnostics | null = useMemo(() => {
    if (latestProbeOverride && latestProbeOverride.url === basmalaCandidateUrl) {
      return latestProbeOverride;
    }
    if (data?.basmalaCandidate?.probe && data.basmalaCandidate.probe.url === basmalaCandidateUrl) {
      return data.basmalaCandidate.probe;
    }
    return null;
  }, [latestProbeOverride, data?.basmalaCandidate?.probe, basmalaCandidateUrl]);

  const basmalaPlayableVerified = Boolean(
    activeBasmalaProbe?.ok && activeBasmalaProbe?.browserPlayable,
  );

  const setCardError = (key: AdminConfirmationKey, msg: string | null) => {
    setConfCardErrors((prev) => {
      if (!msg) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: msg };
    });
  };

  // 1. Administrator Confirmations — validate API response and update counters ONLY after verified DB persistence
  const handleToggleConfirmation = async (
    key: AdminConfirmationKey,
    nextConfirmed: boolean,
    policyVersion: string,
  ) => {
    if (busyConfKeys[key]) return;
    onError('');
    setCardError(key, null);
    setBusyConfKeys((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await apiFetch(
        `/api/admin/quran/release-confirmations/${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmed: nextConfirmed, policyVersion }),
        },
      );

      const contentType = res.headers.get('content-type') || 'unknown';
      const rawText = await res.text();
      if (isHtmlPayload(contentType, rawText)) {
        const htmlTitle = extractHtmlTitle(rawText);
        const msg = `Backend routing error: received HTML${htmlTitle ? ` ("${htmlTitle}")` : ''} instead of API JSON (HTTP ${res.status}).`;
        setCardError(key, msg);
        onError(msg);
        return;
      }

      let parsed: Record<string, unknown> | null = null;
      if (rawText.trim()) {
        try {
          const maybe = JSON.parse(rawText);
          if (maybe && typeof maybe === 'object' && !Array.isArray(maybe)) {
            parsed = maybe as Record<string, unknown>;
          }
        } catch {
          const msg = `Server returned invalid JSON (HTTP ${res.status}): ${redactSensitiveText(rawText, 120)}`;
          setCardError(key, msg);
          onError(msg);
          return;
        }
      }

      if (!res.ok) {
        const serverErr =
          typeof parsed?.error === 'string' && parsed.error.trim()
            ? parsed.error.trim()
            : `Failed to persist confirmation (${key}): HTTP ${res.status}.`;
        setCardError(key, serverErr);
        onError(serverErr);
        return;
      }

      const json = (parsed || {}) as {
        ok?: unknown;
        persisted?: unknown;
        confirmationKey?: unknown;
        confirmation?: {
          confirmed?: unknown;
          confirmedBy?: unknown;
          confirmedAt?: unknown;
        };
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      const confValid =
        json.ok !== false &&
        json.persisted === true &&
        json.confirmationKey === key &&
        json.confirmation &&
        typeof json.confirmation.confirmed === 'boolean' &&
        json.confirmation.confirmed === nextConfirmed &&
        (!nextConfirmed ||
          (typeof json.confirmation.confirmedAt === 'string' &&
            json.confirmation.confirmedAt.length > 0 &&
            typeof json.confirmation.confirmedBy === 'string' &&
            json.confirmation.confirmedBy.length > 0));

      const readinessValid =
        Boolean(json.releaseReadiness) &&
        typeof json.releaseReadiness?.adminConfirmationsCount === 'number' &&
        json.releaseReadiness?.confirmations?.[key]?.confirmed === nextConfirmed;

      if (!confValid || !readinessValid) {
        const msg = `Confirmation ${key} response failed validation for persisted database state. Reloading actual state.`;
        setCardError(key, msg);
        onError(msg);
        await onReload();
        return;
      }

      // Reload authoritative database state BEFORE updating counters / showing success notice
      const reloaded = await onReload();
      const reloadedItem = reloaded?.releaseReadiness?.confirmations?.[key];
      const reloadedConfirmed = reloadedItem?.confirmed;
      const reloadedCount = reloaded?.releaseReadiness?.adminConfirmationsCount;
      const reloadedValid =
        Boolean(reloaded) &&
        typeof reloadedConfirmed === 'boolean' &&
        reloadedConfirmed === nextConfirmed &&
        typeof reloadedCount === 'number' &&
        (!nextConfirmed || (Boolean(reloadedItem?.confirmedAt) && Boolean(reloadedItem?.confirmedBy)));

      if (!reloadedValid) {
        const msg = `Persistence verification failed for ${key}: reloaded database state did not confirm ${nextConfirmed ? 'confirmation' : 'revocation'} (actual: ${String(reloadedConfirmed)}).`;
        setCardError(key, msg);
        onError(msg);
        return;
      }

      onNotice(
        nextConfirmed
          ? `Persisted administrator confirmation: ${key} (${reloadedCount}/4).`
          : `Revoked administrator confirmation: ${key} (${reloadedCount}/4).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error updating confirmation.';
      setCardError(key, msg);
      onError(msg);
    } finally {
      setBusyConfKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // 2. Basmala Probe / Resolve Official QF Reciter ID 6 (1:1)
  const handleProbeOrResolveBasmala = async (resolveAuthorizedSource: boolean) => {
    onError('');
    setProbingBasmala(resolveAuthorizedSource ? 'resolve' : 'probe');
    try {
      const res = await apiFetch('/api/admin/quran/basmala/probe', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateUrl: basmalaCandidateUrl || undefined,
          resolveAuthorizedSource,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        initialProbe?: QuranAudioProbeDiagnostics | null;
        resolvedAuthorizedUrl?: string | null;
        resolvedProbe?: QuranAudioProbeDiagnostics | null;
        resolverError?: string;
        basmalaCandidate?: AdminQuranVerificationsPayload['basmalaCandidate'];
        phraseAssets?: AdminQuranVerificationsPayload['phraseAssets'];
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      if (!res.ok) {
        onError(json.error || 'Failed to probe Basmala URL.');
        return;
      }

      const activeProbe =
        (resolveAuthorizedSource ? json.resolvedProbe : json.initialProbe) ||
        json.basmalaCandidate?.probe ||
        null;
      if (json.basmalaCandidate?.audioUrl) {
        setBasmalaUrlInput(json.basmalaCandidate.audioUrl);
      }
      if (activeProbe) {
        setLatestProbeOverride(activeProbe);
      }

      onPatchData((prev) =>
        prev
          ? {
              ...prev,
              ...(json.basmalaCandidate ? { basmalaCandidate: json.basmalaCandidate } : {}),
              ...(json.phraseAssets ? { phraseAssets: json.phraseAssets } : {}),
              ...(json.releaseReadiness ? { releaseReadiness: json.releaseReadiness } : {}),
            }
          : prev,
      );
      await onReload();

      if (resolveAuthorizedSource) {
        if (json.resolvedProbe?.ok && json.resolvedProbe.browserPlayable) {
          onNotice(
            `Resolved playable official QF Reciter ID 6 Basmala (1:1): HTTP ${json.resolvedProbe.httpStatus}, ${json.resolvedProbe.contentType} (${json.resolvedProbe.magicFormat}). Approval remains pending until you verify playback and approve.`,
          );
        } else {
          onError(
            json.resolverError ||
              'Could not verify a playable official QF Reciter ID 6 (1:1) Basmala recording.',
          );
        }
      } else if (activeProbe?.ok && activeProbe.browserPlayable) {
        onNotice(
          `Basmala candidate playable: HTTP ${activeProbe.httpStatus}, ${activeProbe.contentType} (${activeProbe.magicFormat}).`,
        );
      } else {
        onError(
          `Basmala candidate unavailable (${activeProbe?.reason || `HTTP ${activeProbe?.httpStatus ?? 0}`}). Click "Resolve Official QF Reciter 6 (1:1)" to look up the working Quran Foundation source.`,
        );
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error probing Basmala URL.');
    } finally {
      setProbingBasmala('');
    }
  };

  // 2b. Basmala Approve / Reject
  const handleBasmalaDecision = async (decision: 'approve' | 'reject') => {
    onError('');
    if (decision === 'approve') {
      if (
        !basmalaCandidateUrl ||
        !basmalaReviewer.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(basmalaReviewDate) ||
        !basmalaListeningChecked ||
        !basmalaTermsChecked ||
        !basmalaLicense.trim()
      ) {
        onError(
          language === 'ar'
            ? 'لاعتماد البسملة يجب توفير رابط QF للقارئ ٦، واسم المراجع، وتاريخ المراجعة، وتأكيد الاستماع البشري وشروط الاستخدام.'
            : 'Approving Basmala requires a playable QF Reciter 6 (1:1) URL, reviewer name, review date (YYYY-MM-DD), license terms, and both confirmation checkboxes.',
        );
        return;
      }
    }

    setSavingBasmalaAction(decision);
    try {
      const res = await apiFetch('/api/admin/quran/phrase-assets/basmala', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: decision === 'approve' ? basmalaCandidateUrl : basmalaCandidateUrl || '',
          sourceName: 'Quran Foundation Recitation ID 6 (Al-Husary 1:1 Basmala)',
          licenseOrPermission: basmalaLicense.trim(),
          reviewedBy: basmalaReviewer.trim() || undefined,
          reviewedAt: basmalaReviewDate.trim() || undefined,
          licenseConfirmed: decision === 'approve' ? basmalaTermsChecked : false,
          humanListeningApproved: decision === 'approve' ? basmalaListeningChecked : false,
          verificationStatus: decision === 'approve' ? 'verified' : 'unavailable',
          notes:
            basmalaNotes.trim() ||
            (decision === 'reject' ? 'Rejected during admin release review' : undefined),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        probe?: QuranAudioProbeDiagnostics;
        asset?: QuranPhraseAudioAssetConfig;
        phraseAssets?: AdminQuranVerificationsPayload['phraseAssets'];
        basmalaCandidate?: AdminQuranVerificationsPayload['basmalaCandidate'];
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      if (json.probe) {
        setLatestProbeOverride(json.probe);
      }

      if (!res.ok) {
        onError(json.error || 'Failed to update Basmala asset status.');
        return;
      }

      onPatchData((prev) =>
        prev
          ? {
              ...prev,
              ...(json.phraseAssets ? { phraseAssets: json.phraseAssets } : {}),
              ...(json.basmalaCandidate ? { basmalaCandidate: json.basmalaCandidate } : {}),
              ...(json.releaseReadiness ? { releaseReadiness: json.releaseReadiness } : {}),
            }
          : prev,
      );
      const reloaded = await onReload();
      const expectedApproved = decision === 'approve';
      if (!reloaded || Boolean(reloaded.releaseReadiness?.basmalaApproved) !== expectedApproved) {
        onError('Basmala persistence check did not match after reload.');
        return;
      }

      onNotice(
        decision === 'approve'
          ? 'Approved playable QF Reciter ID 6 Basmala (1:1) asset.'
          : 'Rejected Basmala asset (status set to unavailable). Family access remains blocked.',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error updating Basmala status.');
    } finally {
      setSavingBasmalaAction('');
    }
  };

  // 3a. Evaluate Reciter & Recitation Source Verification (Provider Metadata + SHA-256 + 49 Audio URLs)
  const handleEvaluateSourceVerification = async () => {
    onError('');
    setEvaluatingSource(true);
    try {
      const res = await apiFetch('/api/admin/quran/source-verification/evaluate', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshFromQf: true,
          ...(qfPreview?.surahAudioUrls && Object.keys(qfPreview.surahAudioUrls).length === 9
            ? { audioUrlsJson: qfPreview.surahAudioUrls }
            : {}),
          ...(qfPreview?.ayahAudioUrls && Object.keys(qfPreview.ayahAudioUrls).length === 40
            ? { ayahAudioUrlsJson: qfPreview.ayahAudioUrls }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        evaluationPassed?: boolean;
        verification?: AdminQuranVerificationsPayload['customRecords'][number];
        reciters?: QuranReciterSpec[];
        basmalaCandidate?: AdminQuranVerificationsPayload['basmalaCandidate'];
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      if (!res.ok) {
        onError(json.error || 'Failed to evaluate Reciter & Recitation Source Verification.');
        return;
      }

      onPatchData((prev) => {
        if (!prev) return prev;
        const nextCustom = json.verification
          ? [
              ...prev.customRecords.filter((r) => r.contentKey !== json.verification!.contentKey),
              json.verification,
            ]
          : prev.customRecords;
        return {
          ...prev,
          customRecords: nextCustom,
          ...(json.reciters ? { reciters: json.reciters } : {}),
          ...(json.basmalaCandidate ? { basmalaCandidate: json.basmalaCandidate } : {}),
          ...(json.releaseReadiness ? { releaseReadiness: json.releaseReadiness } : {}),
        };
      });
      await onReload();

      if (json.evaluationPassed) {
        onNotice(
          'Evaluated Quran Foundation Reciter ID 6 metadata, 9/9 Uthmani SHA-256 hashes, and 49/49 audio URLs — all 8 technical checks passed. Explicit administrator confirmation is still required.',
        );
      } else {
        onError(
          `Technical evaluation completed (${json.releaseReadiness?.sourceVerificationChecklistPassedCount ?? 0}/8 checks passed). Resolve any failed checks before confirming.`,
        );
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error during source verification evaluation.');
    } finally {
      setEvaluatingSource(false);
    }
  };

  // 3b. Explicit Administrator Action: Confirm or Revoke Reciter & Recitation Source
  const handleConfirmOrRevokeSourceVerification = async (confirm: boolean) => {
    onError('');
    setSavingSourceConfirm(confirm ? 'confirm' : 'revoke');
    try {
      const res = await apiFetch('/api/admin/quran/source-verification', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: confirm }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        sourceVerification?: NonNullable<AdminQuranVerificationsPayload['releaseReadiness']>['sourceVerification'];
        verification?: AdminQuranVerificationsPayload['customRecords'][number];
        reciters?: QuranReciterSpec[];
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      if (!res.ok) {
        onError(
          json.error ||
            (confirm
              ? 'Failed to confirm Reciter & Recitation Source.'
              : 'Failed to revoke Reciter & Recitation Source.'),
        );
        return;
      }

      onPatchData((prev) => {
        if (!prev) return prev;
        const nextCustom = json.verification
          ? [
              ...prev.customRecords.filter((r) => r.contentKey !== json.verification!.contentKey),
              json.verification,
            ]
          : prev.customRecords;
        return {
          ...prev,
          customRecords: nextCustom,
          ...(json.reciters ? { reciters: json.reciters } : {}),
          ...(json.releaseReadiness ? { releaseReadiness: json.releaseReadiness } : {}),
        };
      });

      const reloaded = await onReload();
      if (!reloaded || Boolean(reloaded.releaseReadiness?.sourceVerificationConfirmed) !== confirm) {
        onError('Reciter & Recitation Source persistence check failed after reload.');
        return;
      }

      onNotice(
        confirm
          ? 'Confirmed Reciter & Recitation Source Verification (ID 6, Quran Foundation).'
          : 'Revoked Reciter & Recitation Source Verification — family audio access is now blocked.',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error updating source verification.');
    } finally {
      setSavingSourceConfirm('');
    }
  };

  // 4. Final Family Release Gate
  const handleFinalReleaseDecision = async (targetStatus: 'verified' | 'pending_verification') => {
    onError('');
    setReleasing(true);
    try {
      const res = await apiFetch('/api/admin/quran/verifications/adult-husary-muallim', {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationStatus: targetStatus,
          sourceName:
            husaryRecord?.sourceName ||
            husaryReciter?.sourceName ||
            'Quran Foundation Content API v4 (Production)',
          licenseOrPermission:
            husaryRecord?.licenseOrPermission ||
            husaryReciter?.licenseOrPermission ||
            'Quran Foundation Developer Terms (integrated app use, direct streaming)',
          notes: husaryRecord?.notes || '',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        verification?: AdminQuranVerificationsPayload['customRecords'][number];
        reciters?: QuranReciterSpec[];
        releaseReadiness?: AdminQuranVerificationsPayload['releaseReadiness'];
      };

      if (!res.ok) {
        onError(json.error || 'Failed to update Quran World family release status.');
        return;
      }

      onPatchData((prev) => {
        if (!prev) return prev;
        const nextCustom = json.verification
          ? [
              ...prev.customRecords.filter((r) => r.contentKey !== json.verification!.contentKey),
              json.verification,
            ]
          : prev.customRecords;
        return {
          ...prev,
          customRecords: nextCustom,
          ...(json.reciters ? { reciters: json.reciters } : {}),
          ...(json.releaseReadiness ? { releaseReadiness: json.releaseReadiness } : {}),
        };
      });

      const reloaded = await onReload();
      const expectEnabled = targetStatus === 'verified';
      if (!reloaded || Boolean(reloaded.releaseReadiness?.familyAccessEnabled) !== expectEnabled) {
        onError('Family release persistence check did not match after reload.');
        return;
      }

      onNotice(
        expectEnabled
          ? 'Quran World approved for families. Verified Reciter ID 6 audio is now live.'
          : 'Paused family release — Quran World reverted to pending verification.',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Network error updating release gate.');
    } finally {
      setReleasing(false);
    }
  };

  const confirmations: QuranAdminConfirmations | undefined = readiness?.confirmations;
  const basmalaStatusLabel =
    readiness?.basmalaApproved && readiness?.basmalaPlayable
      ? 'Approved & Playable'
      : readiness?.basmalaApproved
        ? 'Needs Playability Check'
        : basmalaAsset?.verificationStatus === 'unavailable'
          ? 'Rejected (Unavailable)'
          : basmalaAsset?.status === 'configured_pending_approval'
            ? 'Configured (Pending)'
            : 'Pending';

  const sourceStatus = readiness?.sourceVerificationStatus || 'pending';
  const sourceChecklist = readiness?.sourceVerificationChecklist || [];
  const sourceRecord = readiness?.sourceVerification;

  return (
    <section
      aria-labelledby="quran-release-approval-heading"
      className="rounded-3xl border border-[#27345C]/15 bg-white p-5 sm:p-6 space-y-6 text-xs text-[#27345C]"
    >
      {/* Header + Release State */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#27345C]/10 pb-4">
        <div>
          <h3
            id="quran-release-approval-heading"
            className="text-lg sm:text-xl font-extrabold text-[#27345C] flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-[#047857]" />
            <span>Quran World – Release Approval</span>
          </h3>
          <p className="text-[#27345C]/75 font-bold mt-1">
            {language === 'ar'
              ? 'مسار الاعتماد لإطلاق عالم القرآن للعائلات: تأكيدات المشرف، التحقق من مصدر القارئ والتسجيلات (Reciter ID 6)، اعتماد البسملة الصالحة للتشغيل، وبوابة الإطلاق النهائية.'
              : 'Administrator compliance confirmations, Reciter & Recitation Source Verification, playable Basmala asset approval, and final family release gate. Fail-closed by default.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loadingCandidate}
            onClick={() => void inspectQfCandidate(false)}
            className="min-h-[38px] px-3.5 rounded-xl border border-[#27345C]/20 bg-[#F8FAFC] text-[#27345C] font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCandidate ? 'animate-spin' : ''}`} />
            <span>
              {loadingCandidate ? 'Inspecting QF...' : 'Inspect QF Reciter 6 Candidate'}
            </span>
          </button>

          <span
            dir="ltr"
            className={`px-3 py-1.5 rounded-xl font-mono-num font-extrabold text-xs ${
              readiness?.familyAccessEnabled
                ? 'bg-[#047857] text-white'
                : 'bg-[#92400E] text-white'
            }`}
          >
            Family Release: {readiness?.familyAccessEnabled ? 'Approved' : 'Blocked'}
          </span>
        </div>
      </div>

      {data?.quranSchemaReady === false && (
        <div
          role="alert"
          dir="ltr"
          className="rounded-2xl border border-[#B91C1C]/30 bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B] font-bold flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B91C1C]" />
          <div className="space-y-1">
            <p className="font-extrabold">
              Quran World PostgreSQL tables are pending migration (0002_quran_world.sql)
            </p>
            <p className="text-[11px] font-semibold text-[#7F1D1D]">
              The connected database is healthy for core accounts, but the Quran World storage tables do not exist yet. Confirmations and release actions will return HTTP 409 until additive migration 0002_quran_world.sql is applied.
            </p>
          </div>
        </div>
      )}

      {/* Release Status Dashboard (5 Cards) */}
      {readiness && (
        <div className="space-y-3" dir="ltr">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl border border-[#27345C]/12 bg-[#F8FAFC] space-y-1">
              <p className="text-[11px] font-bold text-[#27345C]/70">Administrator Confirmations</p>
              <p
                data-testid="admin-confirmations-counter"
                className={`text-sm font-extrabold font-mono-num tabular-nums ${
                  readiness.allAdminConfirmationsComplete ? 'text-[#047857]' : 'text-[#92400E]'
                }`}
              >
                {readiness.allAdminConfirmationsComplete ? 'Completed' : 'Pending'} (
                {readiness.adminConfirmationsCount}/{readiness.adminConfirmationsTotal})
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-[#27345C]/12 bg-[#F8FAFC] space-y-1">
              <p className="text-[11px] font-bold text-[#27345C]/70">
                Reciter &amp; Recitation Source Verification
              </p>
              <p
                data-testid="source-verification-status"
                className={`text-sm font-extrabold font-mono-num tabular-nums ${
                  readiness.sourceVerificationConfirmed && readiness.sourceVerificationChecklistPassed
                    ? 'text-[#047857]'
                    : sourceStatus === 'revoked'
                      ? 'text-[#B91C1C]'
                      : 'text-[#92400E]'
                }`}
              >
                {readiness.sourceVerificationConfirmed && readiness.sourceVerificationChecklistPassed
                  ? 'Confirmed'
                  : sourceStatus === 'revoked'
                    ? 'Revoked'
                    : 'Pending'}{' '}
                ({readiness.sourceVerificationChecklistPassedCount}/
                {readiness.sourceVerificationChecklistTotalCount})
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-[#27345C]/12 bg-[#F8FAFC] space-y-1">
              <p className="text-[11px] font-bold text-[#27345C]/70">Basmala Approval</p>
              <p
                className={`text-sm font-extrabold font-mono-num ${
                  readiness.basmalaApproved && readiness.basmalaPlayable
                    ? 'text-[#047857]'
                    : basmalaAsset?.verificationStatus === 'unavailable'
                      ? 'text-[#B91C1C]'
                      : 'text-[#92400E]'
                }`}
              >
                {basmalaStatusLabel}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-[#27345C]/12 bg-[#F8FAFC] space-y-1">
              <p className="text-[11px] font-bold text-[#27345C]/70">
                Closing Phrase (صَدَقَ اللَّهُ الْعَظِيمُ)
              </p>
              <p className="text-sm font-extrabold text-[#27345C]">Disabled / Non-blocking</p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border space-y-1 ${
                readiness.familyAccessEnabled
                  ? 'border-[#047857]/30 bg-[#ECFDF5]'
                  : 'border-[#D97706]/30 bg-[#FFFBEB]'
              }`}
            >
              <p className="text-[11px] font-bold text-[#27345C]/70">Family Release</p>
              <p
                className={`text-sm font-extrabold font-mono-num ${
                  readiness.familyAccessEnabled ? 'text-[#047857]' : 'text-[#92400E]'
                }`}
              >
                {readiness.familyAccessEnabled ? 'Approved' : 'Blocked'}
              </p>
            </div>
          </div>

          {!readiness.familyAccessEnabled && readiness.pendingApprovals.length > 0 && (
            <div className="p-4 rounded-2xl border border-[#D97706]/30 bg-[#FFFBEB] space-y-2">
              <p className="font-extrabold text-[#92400E] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Blocking Reasons ({readiness.pendingApprovals.length}): Family accounts cannot
                  access recitation audio until resolved
                </span>
              </p>
              <ul className="space-y-1.5 text-[#92400E] font-bold">
                {readiness.pendingApprovals.map((blocker) => (
                  <li key={blocker.key} className="p-2 rounded-xl bg-white/70 border border-[#D97706]/20">
                    <p>{language === 'ar' ? blocker.labelAr : blocker.labelEn}</p>
                    {(blocker.actionRequiredEn || blocker.actionRequiredAr) && (
                      <p className="text-[11px] font-semibold text-[#78350F] mt-0.5">
                        Action required:{' '}
                        {language === 'ar'
                          ? blocker.actionRequiredAr || blocker.actionRequiredEn
                          : blocker.actionRequiredEn || blocker.actionRequiredAr}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 1. Administrator Confirmations */}
      <div className="space-y-3 border-t border-[#27345C]/10 pt-5" dir="ltr">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-extrabold text-[#27345C]">
              1. Administrator Confirmations ({readiness?.adminConfirmationsCount ?? 0}/4)
            </h4>
            <p className="text-[#27345C]/70 font-bold">
              Confirm or revoke each compliance requirement individually. Confirmations only show success once PostgreSQL/database persistence is verified.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONFIRMATION_ITEMS.map((item) => {
            const saved = confirmations?.[item.key];
            const isConfirmed = Boolean(saved?.confirmed);
            const isBusy = Boolean(busyConfKeys[item.key]);
            const cardError = confCardErrors[item.key];

            return (
              <div
                key={item.key}
                data-testid={`confirmation-card-${item.key}`}
                className={`p-4 rounded-2xl border space-y-2.5 flex flex-col justify-between ${
                  cardError
                    ? 'border-[#DC2626]/40 bg-[#FEF2F2]/40'
                    : isConfirmed
                      ? 'border-[#047857]/30 bg-[#ECFDF5]/60'
                      : 'border-[#27345C]/15 bg-[#F8FAFC]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-extrabold text-sm text-[#27345C]">
                      {language === 'ar' ? item.titleAr : item.titleEn}
                    </p>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded font-mono-num text-[11px] font-extrabold ${
                        isConfirmed
                          ? 'bg-[#DCFCE7] text-[#166534]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      {isConfirmed ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[#27345C]/75 font-semibold leading-relaxed">
                    {item.descriptionEn}
                  </p>
                  <div className="font-mono-num tabular-nums text-[11px] text-[#27345C]/75 space-y-0.5 pt-1">
                    <p>
                      Policy version: <strong>{saved?.policyVersion || item.policyVersion}</strong>
                    </p>
                    {isConfirmed ? (
                      <p className="text-[#065F46]">
                        Confirmed by <strong>{saved?.confirmedBy || 'admin'}</strong>{' '}
                        {saved?.confirmedByUserId ? `(${saved.confirmedByUserId})` : ''} @{' '}
                        {saved?.confirmedAt || 'recorded'}
                      </p>
                    ) : (
                      <p className="text-[#92400E]">Not yet confirmed by an administrator.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {cardError && (
                    <div
                      role="alert"
                      data-testid={`confirmation-error-${item.key}`}
                      className="p-2.5 rounded-xl bg-[#FEF2F2] border border-[#DC2626]/35 text-[#991B1B] text-[11px] font-bold flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="break-words">{cardError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-busy={isBusy}
                      data-testid={`confirmation-button-${item.key}`}
                      onClick={() =>
                        void handleToggleConfirmation(item.key, !isConfirmed, item.policyVersion)
                      }
                      className={`min-h-[36px] px-4 rounded-xl font-extrabold cursor-pointer disabled:opacity-50 ${
                        isConfirmed
                          ? 'border border-[#27345C]/25 bg-white text-[#27345C] hover:bg-[#FEF2F2] hover:text-[#991B1B]'
                          : 'bg-[#047857] text-white hover:bg-[#065F46]'
                      }`}
                    >
                      {isBusy
                        ? isConfirmed
                          ? 'Revoking...'
                          : 'Confirming...'
                        : isConfirmed
                          ? 'Revoke Confirmation'
                          : 'Confirm Requirement'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Basmala Asset Approval (QF Reciter ID 6 1:1 Candidate) */}
      <div className="space-y-3 border-t border-[#27345C]/10 pt-5" dir="ltr">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-extrabold text-[#27345C]">
              2. Basmala Asset Approval (QF Reciter ID 6 — 1:1 Candidate)
            </h4>
            <p className="text-[#27345C]/70 font-bold">
              Al-Fatihah preserves its 1:1 verse recitation (never receives a duplicate Basmala). The other 8 curated Surahs require this approved, live-playable Basmala asset. Closing phrase "صَدَقَ اللَّهُ الْعَظِيمُ" stays disabled and non-blocking.
            </p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg font-mono-num font-extrabold ${
              readiness?.basmalaApproved && readiness?.basmalaPlayable
                ? 'bg-[#DCFCE7] text-[#166534]'
                : basmalaAsset?.verificationStatus === 'unavailable'
                  ? 'bg-[#FEE2E2] text-[#991B1B]'
                  : 'bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            Status: {basmalaStatusLabel}
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-[#27345C]/15 bg-[#F8FAFC] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-extrabold text-[#27345C] flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[#047857]" />
                <span>QF Reciter ID 6 Basmala Candidate (Sheikh Al-Husary · Chapter 1, Verse 1)</span>
              </p>
              <input
                type="url"
                value={basmalaUrlInput}
                onChange={(e) => setBasmalaUrlInput(e.target.value)}
                placeholder="https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3"
                aria-label="Basmala candidate HTTPS URL"
                className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/20 font-mono-num text-[11px]"
              />
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={probingBasmala !== ''}
                  onClick={() => void handleProbeOrResolveBasmala(false)}
                  className="min-h-[34px] px-3 rounded-xl border border-[#27345C]/20 bg-white text-[#27345C] font-extrabold cursor-pointer hover:bg-[#F1F5F9] disabled:opacity-50"
                >
                  {probingBasmala === 'probe' ? 'Probing URL...' : 'Probe Basmala URL'}
                </button>
                <button
                  type="button"
                  disabled={probingBasmala !== ''}
                  onClick={() => void handleProbeOrResolveBasmala(true)}
                  className="min-h-[34px] px-3 rounded-xl border border-[#047857]/35 bg-[#ECFDF5] text-[#065F46] font-extrabold cursor-pointer hover:bg-[#D1FAE5] disabled:opacity-50"
                >
                  {probingBasmala === 'resolve'
                    ? 'Resolving QF v4...'
                    : 'Resolve Official QF Reciter 6 (1:1)'}
                </button>
              </div>
            </div>

            {basmalaCandidateUrl && basmalaPlayableVerified && (
              <audio
                controls
                preload="none"
                src={basmalaCandidateUrl}
                className="h-9 max-w-full"
              />
            )}
          </div>

          {/* Live HTTP, Redirect, MIME & Signature Diagnostics */}
          <div
            className={`p-3 rounded-xl border font-mono-num text-[11px] space-y-1 ${
              basmalaPlayableVerified
                ? 'bg-[#ECFDF5] border-[#047857]/30 text-[#065F46]'
                : 'bg-[#FFFBEB] border-[#D97706]/30 text-[#92400E]'
            }`}
          >
            {activeBasmalaProbe ? (
              <>
                <p className="font-extrabold flex items-center gap-1.5">
                  {basmalaPlayableVerified ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#047857]" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                  )}
                  <span>
                    HTTP Probe: HTTP {activeBasmalaProbe.httpStatus} · Playable:{' '}
                    {String(activeBasmalaProbe.ok && activeBasmalaProbe.browserPlayable)} · Redirected:{' '}
                    {String(activeBasmalaProbe.redirected)}
                  </span>
                </p>
                <p>
                  MIME Content-Type: <strong>{activeBasmalaProbe.contentType}</strong> · Binary
                  Signature: <strong>{activeBasmalaProbe.magicFormat}</strong> · Bytes sampled:{' '}
                  {activeBasmalaProbe.byteLength}
                </p>
                {activeBasmalaProbe.finalUrl && activeBasmalaProbe.redirected && (
                  <p className="break-all">Final URL: {activeBasmalaProbe.finalUrl}</p>
                )}
                {activeBasmalaProbe.reason && (
                  <p className="text-[#991B1B] font-bold">Reason: {activeBasmalaProbe.reason}</p>
                )}
              </>
            ) : (
              <p className="font-bold">
                Live HTTP/MIME/audio-signature probe not yet run for this URL — click &quot;Probe Basmala URL&quot; or &quot;Resolve Official QF Reciter 6 (1:1)&quot;.
              </p>
            )}

            {data?.basmalaCandidate?.configuredMirrorProbe &&
              !data.basmalaCandidate.configuredMirrorProbe.ok && (
                <p className="text-[#991B1B] font-bold pt-1 border-t border-[#D97706]/25">
                  Mirror check note: {data.basmalaCandidate.configuredMirrorUrl} returned HTTP{' '}
                  {data.basmalaCandidate.configuredMirrorProbe.httpStatus} (
                  {data.basmalaCandidate.configuredMirrorProbe.contentType}). Official QF API v4
                  Reciter 6 source is {data.basmalaCandidate.authorizedFallbackUrl}.
                </p>
              )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-bold">
            <label className="space-y-1">
              <span>Listening &amp; Rights Verifier Name *</span>
              <input
                type="text"
                value={basmalaReviewer}
                onChange={(e) => setBasmalaReviewer(e.target.value)}
                placeholder="Authorized administrator name"
                className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/20"
              />
            </label>
            <label className="space-y-1">
              <span>Verification Date *</span>
              <input
                type="date"
                value={basmalaReviewDate}
                onChange={(e) => setBasmalaReviewDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/20 font-mono-num"
              />
            </label>
            <label className="space-y-1">
              <span>Notes</span>
              <input
                type="text"
                value={basmalaNotes}
                onChange={(e) => setBasmalaNotes(e.target.value)}
                placeholder="Playback & source verification notes"
                className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/20"
              />
            </label>
          </div>

          <label className="block space-y-1 font-bold">
            <span>Applicable Usage Terms / License Reference *</span>
            <input
              type="text"
              value={basmalaLicense}
              onChange={(e) => setBasmalaLicense(e.target.value)}
              className="w-full h-9 px-3 rounded-xl bg-white border border-[#27345C]/20"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-xl bg-white border border-[#27345C]/12 font-bold">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={basmalaListeningChecked}
                onChange={(e) => setBasmalaListeningChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>Verified authentic Reciter ID 6 Basmala (1:1) playback (never TTS/substituted)</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={basmalaTermsChecked}
                onChange={(e) => setBasmalaTermsChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>Source &amp; usage rights confirmed under Quran Foundation terms</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={savingBasmalaAction !== ''}
              onClick={() => void handleBasmalaDecision('reject')}
              className="min-h-[38px] px-4 rounded-xl border border-[#DC2626]/35 bg-white text-[#991B1B] font-extrabold cursor-pointer hover:bg-[#FEF2F2] disabled:opacity-50"
            >
              {savingBasmalaAction === 'reject' ? 'Rejecting...' : 'Reject Basmala Asset'}
            </button>
            <button
              type="button"
              disabled={savingBasmalaAction !== '' || !basmalaCandidateUrl || !basmalaPlayableVerified}
              onClick={() => void handleBasmalaDecision('approve')}
              className="min-h-[38px] px-4 rounded-xl bg-[#047857] text-white font-extrabold cursor-pointer hover:bg-[#065F46] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingBasmalaAction === 'approve' ? 'Approving...' : 'Approve Basmala Asset'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Reciter & Recitation Source Verification (التحقق من مصدر القارئ والتسجيلات) */}
      <div className="space-y-4 border-t border-[#27345C]/10 pt-5" dir="ltr">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-extrabold text-[#27345C]">
              3. Reciter &amp; Recitation Source Verification (التحقق من مصدر القارئ والتسجيلات)
            </h4>
            <p className="text-[#27345C]/75 font-bold mt-0.5">
              {readiness?.sourceVerificationMessage ||
                'Verify Reciter ID 6 against Quran Foundation provider metadata, Uthmani SHA-256 hashes, and live technical audio integrity checks for all 49 audio URLs.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-[#F8FAFC] border border-[#27345C]/15 font-mono-num tabular-nums font-extrabold">
              Checklist: {readiness?.sourceVerificationChecklistPassedCount ?? 0}/
              {readiness?.sourceVerificationChecklistTotalCount ?? 8} passed
            </span>
            <button
              type="button"
              disabled={evaluatingSource}
              onClick={() => void handleEvaluateSourceVerification()}
              className="min-h-[36px] px-4 rounded-xl bg-[#27345C] text-white font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${evaluatingSource ? 'animate-pulse' : ''}`} />
              <span>
                {evaluatingSource
                  ? 'Evaluating QF Metadata & 49 Audio URLs...'
                  : 'Verify Provider Metadata & Probe 49 Audio URLs'}
              </span>
            </button>
          </div>
        </div>

        {/* 8-Point Evidence-Backed Checklist */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {sourceChecklist.map((item) => {
            const badge = badgeForChecklistStatus(item.status);
            return (
              <div
                key={item.key}
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  item.status === 'passed'
                    ? 'border-[#047857]/30 bg-[#ECFDF5]/45'
                    : item.status === 'failed'
                      ? 'border-[#DC2626]/30 bg-[#FEF2F2]/45'
                      : 'border-[#27345C]/15 bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-extrabold text-[#27345C]">
                    {item.order}. {language === 'ar' ? item.labelAr : item.labelEn}
                  </p>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded font-mono-num text-[10px] font-extrabold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-[#27345C]/70">
                  Expected: {language === 'ar' ? item.expectedAr : item.expectedEn}
                </p>
                <p className="text-[11px] font-semibold text-[#27345C]/85 break-words">
                  Evidence: {language === 'ar' ? item.evidenceAr : item.evidenceEn}
                </p>
                {item.checkedAt && (
                  <p className="font-mono-num text-[10px] text-[#27345C]/60">
                    Checked UTC: {item.checkedAt}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Explicit Admin Confirmation & Persistence Details */}
        <div className="p-4 rounded-2xl border border-[#27345C]/15 bg-[#F8FAFC] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-extrabold text-sm text-[#27345C]">
                {sourceRecord?.confirmed
                  ? 'Reciter and recitation source verified against Quran Foundation provider metadata and technical audio integrity checks.'
                  : sourceRecord?.status === 'revoked'
                    ? 'Reciter & Recitation Source Verification revoked — family audio access is blocked.'
                    : 'Awaiting explicit administrator confirmation (Confirm Reciter & Recitation Source).'}
              </p>
              <div className="font-mono-num text-[11px] text-[#27345C]/75 space-y-0.5">
                <p>
                  Provider: <strong>{sourceRecord?.provider || 'Quran Foundation'}</strong> · Reciter
                  ID: <strong>{sourceRecord?.reciterId ?? 6}</strong> (
                  {sourceRecord?.reciterIdentity || 'Sheikh Mahmoud Khalil Al-Husary'}) · Style:{' '}
                  <strong>{sourceRecord?.recitationStyle || 'Murattal'}</strong> · Riwayah:{' '}
                  <strong>{sourceRecord?.riwayah || "Hafs 'an Asim"}</strong>
                </p>
                <p>
                  Evidence version: <strong>{sourceRecord?.evidenceVersion || 'QF-Source-v1'}</strong>
                  {sourceRecord?.confirmed && sourceRecord.confirmedBy
                    ? ` · Confirmed by ${sourceRecord.confirmedBy} (${sourceRecord.confirmedByUserId || 'admin'}) @ ${sourceRecord.confirmedAt}`
                    : sourceRecord?.status === 'revoked' && sourceRecord.revokedAt
                      ? ` · Revoked by ${sourceRecord.revokedBy || 'admin'} (${sourceRecord.revokedByUserId || 'admin'}) @ ${sourceRecord.revokedAt}`
                      : ' · Not yet confirmed'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {sourceRecord?.confirmed ? (
                <button
                  type="button"
                  disabled={savingSourceConfirm !== ''}
                  onClick={() => void handleConfirmOrRevokeSourceVerification(false)}
                  className="min-h-[38px] px-4 rounded-xl border border-[#DC2626]/35 bg-white text-[#991B1B] font-extrabold cursor-pointer hover:bg-[#FEF2F2] disabled:opacity-50"
                >
                  {savingSourceConfirm === 'revoke'
                    ? 'Revoking...'
                    : 'Revoke Source Confirmation'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    savingSourceConfirm !== '' || !readiness?.sourceVerificationChecklistPassed
                  }
                  onClick={() => void handleConfirmOrRevokeSourceVerification(true)}
                  className="min-h-[38px] px-4 rounded-xl bg-[#047857] text-white font-extrabold cursor-pointer hover:bg-[#065F46] disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {savingSourceConfirm === 'confirm'
                    ? 'Confirming...'
                    : 'Confirm Reciter & Recitation Source'}
                </button>
              )}
            </div>
          </div>

          {!readiness?.sourceVerificationChecklistPassed && (
            <p className="text-[11px] font-bold text-[#92400E] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Run &quot;Verify Provider Metadata &amp; Probe 49 Audio URLs&quot; so all 8 source
                checks pass before clicking &quot;Confirm Reciter &amp; Recitation Source&quot;. Requires
                an authenticated administrator session with manage_lessons permission.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* 4. Final Family Release Gate (6 Mandatory Requirements) */}
      <div className="space-y-4 border-t border-[#27345C]/10 pt-5" dir="ltr">
        <div>
          <h4 className="text-base font-extrabold text-[#27345C]">
            4. Final Family Release Gate
          </h4>
          <p className="text-[#27345C]/70 font-bold">
            Family recitation audio unlocks only when all 6 mandatory requirements pass simultaneously. Closing phrase &quot;صَدَقَ اللَّهُ الْعَظِيمُ&quot; stays disabled and non-blocking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 font-bold">
          {[
            {
              ok: Boolean(readiness?.sourceVerificationConfirmed),
              label: '1. Confirmed Reciter & Recitation Source Verification',
              detail: readiness?.sourceVerificationConfirmed ? 'Confirmed' : 'Pending confirmation',
            },
            {
              ok: Boolean(readiness?.textIntegrityVerified),
              label: '2. Verified Quran Text Integrity (SHA-256)',
              detail: `${sourceRecord?.textSha256VerifiedCount ?? 0}/9 Surahs · ${sourceRecord?.textAyahsVerifiedCount ?? 0}/40 Ayahs`,
            },
            {
              ok: Boolean(readiness?.audioUrlsComplete && readiness?.audioTechnicalIntegrityVerified),
              label: '3. Verified 49 Audio URLs & Technical Integrity',
              detail: `${readiness?.surahAudioUrlsCount ?? 0}/9 Surahs · ${readiness?.ayahAudioUrlsCount ?? 0}/40 Ayahs (${sourceRecord?.audioProbePassedCount ?? 0}/49 probed)`,
            },
            {
              ok: Boolean(readiness?.basmalaApproved && readiness?.basmalaPlayable),
              label: '4. Approved & Playable Basmala Asset (1:1)',
              detail: basmalaStatusLabel,
            },
            {
              ok: Boolean(readiness?.allAdminConfirmationsComplete),
              label: '5. All 4 Administrator Compliance Confirmations',
              detail: `${readiness?.adminConfirmationsCount ?? 0}/${readiness?.adminConfirmationsTotal ?? 4} confirmed`,
            },
            {
              ok: true,
              label: '6. Security, Ownership & 7-Day Cache Cap',
              detail: 'Enforced server-side (QF direct HTTPS · Closing disabled)',
            },
          ].map((reqItem) => (
            <div
              key={reqItem.label}
              className={`p-3 rounded-2xl border space-y-1 ${
                reqItem.ok
                  ? 'border-[#047857]/30 bg-[#ECFDF5]/60'
                  : 'border-[#27345C]/15 bg-[#F8FAFC]'
              }`}
            >
              <p className="text-[#27345C] font-extrabold">{reqItem.label}</p>
              <p
                className={`font-mono-num text-[11px] ${
                  reqItem.ok ? 'text-[#047857]' : 'text-[#92400E]'
                }`}
              >
                {reqItem.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-[#27345C]/15 bg-white">
          <div className="space-y-0.5">
            <p className="font-extrabold text-sm text-[#27345C]">
              {readiness?.familyAccessEnabled
                ? 'Quran World is currently Approved and Live for Families'
                : readiness?.canApproveFamilyRelease
                  ? 'All 6 release gates passed — Ready to Approve Quran World for Families'
                  : 'Final release locked until Source Verification, 49 audio URLs, playable Basmala, and all 4 admin confirmations are completed'}
            </p>
            <p className="font-mono-num text-[11px] text-[#27345C]/70">
              Reciter record: adult-husary-muallim ({readiness?.reciterStatus || 'pending_verification'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {readiness?.familyAccessEnabled ? (
              <button
                type="button"
                disabled={releasing}
                onClick={() => void handleFinalReleaseDecision('pending_verification')}
                className="min-h-[42px] px-5 rounded-xl border border-[#92400E]/35 bg-[#FFFBEB] text-[#92400E] font-extrabold cursor-pointer disabled:opacity-50"
              >
                {releasing ? 'Updating...' : 'Pause Family Release'}
              </button>
            ) : (
              <button
                type="button"
                disabled={releasing || !readiness?.canApproveFamilyRelease}
                onClick={() => void handleFinalReleaseDecision('verified')}
                className="min-h-[42px] px-5 rounded-xl bg-[#047857] text-white font-extrabold flex items-center gap-2 cursor-pointer hover:bg-[#065F46] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {releasing ? 'Approving...' : 'Approve Quran World for Families'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
