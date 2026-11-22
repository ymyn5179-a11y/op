export interface ApiTimingSample {
  path: string;
  method: string;
  status: number;
  durationMs: number;
  recordedAt: string;
}

const MAX_SAMPLES = 50;
const apiSamples: ApiTimingSample[] = [];

export function recordApiLatency(sample: ApiTimingSample): void {
  apiSamples.unshift(sample);
  if (apiSamples.length > MAX_SAMPLES) {
    apiSamples.length = MAX_SAMPLES;
  }
}

export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const timeoutMs = init?.timeoutMs ?? 30000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const upstreamSignal = init?.signal;

  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onUpstreamAbort = () => controller?.abort();

  if (controller) {
    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort();
      } else {
        upstreamSignal.addEventListener('abort', onUpstreamAbort, { once: true });
      }
    }
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }
  }

  const fetchInit: RequestInit = {
    ...init,
    ...(controller ? { signal: controller.signal } : {}),
  };

  try {
    const res = await fetch(input, fetchInit);
    const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const path = typeof input === 'string' ? input.split('?')[0] : 'request';
    recordApiLatency({
      path,
      method: (init?.method || 'GET').toUpperCase(),
      status: res.status,
      durationMs: Math.round(ended - started),
      recordedAt: new Date().toISOString(),
    });
    return res;
  } catch (err) {
    if (timedOut) {
      const timeoutErr = new Error('Request timed out');
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener('abort', onUpstreamAbort);
    }
  }
}

export function getPerformanceSummary(): {
  pageLoadMs: number | null;
  avgApiLatencyMs: number | null;
  recentApiSamples: ApiTimingSample[];
} {
  let pageLoadMs: number | null = null;
  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0 && navEntries[0].loadEventEnd > 0) {
      pageLoadMs = Math.round(navEntries[0].loadEventEnd - navEntries[0].startTime);
    }
  }
  const avgApiLatencyMs =
    apiSamples.length > 0
      ? Math.round(apiSamples.reduce((acc, s) => acc + s.durationMs, 0) / apiSamples.length)
      : null;

  return {
    pageLoadMs,
    avgApiLatencyMs,
    recentApiSamples: [...apiSamples],
  };
}
