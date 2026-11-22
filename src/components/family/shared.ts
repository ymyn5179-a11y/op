import type { ChildProfile, Language } from '../../types/nonoland';

export async function familyApi<T = Record<string, unknown>>(
  url: string,
  csrfToken: string | null | undefined,
  options?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string; code?: string }> {
  try {
    const method = (options?.method || 'GET').toUpperCase();
    const headers: Record<string, string> = {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' && method !== 'HEAD' && csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    };
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });
    const parsed = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: parsed,
        error: parsed?.error || `Request failed (${res.status})`,
        code: parsed?.code,
      };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Network connection failed. Please try again.',
    };
  }
}

export function formatChildAgeLabel(child: ChildProfile, language: Language): string {
  const now = new Date();
  const totalMonths =
    child.birthYear && child.birthMonth
      ? Math.max(12, (now.getUTCFullYear() - child.birthYear) * 12 + (now.getUTCMonth() + 1 - child.birthMonth))
      : child.ageMonths || 36;
  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;

  if (language === 'ar') {
    return remMonths > 0 ? `${years} سنوات و${remMonths} شهور` : `${years} سنوات`;
  }
  return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yrs`;
}
