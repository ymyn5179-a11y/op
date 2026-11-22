import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export const REQUIRED_SECRET_NAMES = [
  'SQL_HOST',
  'SQL_USER',
  'SQL_PASSWORD',
  'NONOLAND_SESSION_SECRET',
  'NONOLAND_ADMIN_SETUP_SECRET',
] as const;

export const OPTIONAL_SECRET_NAMES = [
  'SESSION_SECRET',
  'SQL_DIRECT_HOST',
  'SQL_ADMIN_USER',
  'SQL_ADMIN_PASSWORD',
  'DATABASE_URL',
  'NONOLAND_DB_HOST',
  'NONOLAND_DB_DIRECT_HOST',
  'NONOLAND_DB_NAME',
  'NONOLAND_DB_USER',
  'NONOLAND_DB_PASSWORD',
] as const;

export type RequiredSecretName = (typeof REQUIRED_SECRET_NAMES)[number];
export type OptionalSecretName = (typeof OPTIONAL_SECRET_NAMES)[number];
export type ManagedSecretName = RequiredSecretName | OptionalSecretName;

export const NON_SENSITIVE_DB_DEFAULTS = {
  SQL_DB_NAME: 'neondb',
  SQL_PORT: 5432,
  SQL_SSL: true,
} as const;

export type SecretItemSource = 'environment' | 'secret-manager' | 'missing';
export type OverallSecretSource = 'environment' | 'secret-manager' | 'mixed' | 'none';
export type SecretManagerProbeStatus =
  | 'available'
  | 'disabled_by_config'
  | 'no_project_id'
  | 'no_adc'
  | 'api_disabled'
  | 'iam_denied'
  | 'unauthenticated'
  | 'network_error'
  | 'not_probed';

export interface SecretManagerCapabilityReport {
  capable: boolean;
  adcAvailable: boolean;
  adcMethod: 'adc_file' | 'metadata_service_identity' | 'none';
  projectIdAvailable: boolean;
  projectIdSource: 'env' | 'metadata_server' | 'sdk' | 'none';
  projectId: string | null;
  serviceAccountEmail: string | null;
  outboundHttpsSupported: boolean;
  apiEnabled: boolean;
  iamPermitted: boolean;
  status: SecretManagerProbeStatus;
  detail: string;
}

export interface SecretProviderSnapshot {
  initialized: boolean;
  secretSource: OverallSecretSource;
  presentRequired: RequiredSecretName[];
  missingRequired: RequiredSecretName[];
  sources: Record<RequiredSecretName, SecretItemSource>;
  optionalSources: Record<OptionalSecretName, SecretItemSource>;
  secretManager: SecretManagerCapabilityReport;
  configurationError: string | null;
}

const resolvedSecretVault = new Map<ManagedSecretName, { value: string; source: 'environment' | 'secret-manager' }>();
let cachedSnapshot: SecretProviderSnapshot | null = null;
let initPromise: Promise<SecretProviderSnapshot> | null = null;

function safeHttpRequest(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 1800,
): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        if (body.length < 16384) body += String(chunk);
      });
      res.on('end', () => {
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          body,
        });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, body: '', error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, body: '', error: err.message });
    });
  });
}

function getExplicitEnvProjectId(): string | null {
  const candidates = [
    process.env.SECRET_MANAGER_PROJECT_ID,
    process.env.GOOGLE_CLOUD_PROJECT,
    process.env.GCP_PROJECT,
    process.env.GCLOUD_PROJECT,
  ];
  for (const val of candidates) {
    const trimmed = (val || '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function detectAdcFilePath(): string | null {
  const explicit = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }
  const defaultPath = path.join(
    process.env.HOME || os.homedir() || '/root',
    '.config',
    'gcloud',
    'application_default_credentials.json',
  );
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
}

async function probeMetadataIdentity(): Promise<{
  reachable: boolean;
  projectId: string | null;
  serviceAccountEmail: string | null;
  tokenAvailable: boolean;
}> {
  const headers = { 'Metadata-Flavor': 'Google' };
  const [projRes, emailRes, tokenRes] = await Promise.all([
    safeHttpRequest('http://metadata.google.internal/computeMetadata/v1/project/project-id', headers, 1200),
    safeHttpRequest(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
      headers,
      1200,
    ),
    safeHttpRequest(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      headers,
      1200,
    ),
  ]);

  let tokenAvailable = false;
  if (tokenRes.ok) {
    try {
      const parsed = JSON.parse(tokenRes.body) as { access_token?: string };
      tokenAvailable = Boolean(parsed.access_token);
    } catch {
      tokenAvailable = false;
    }
  }

  return {
    reachable: projRes.ok || emailRes.ok || tokenRes.ok,
    projectId: projRes.ok ? projRes.body.trim() || null : null,
    serviceAccountEmail: emailRes.ok ? emailRes.body.trim() || null : null,
    tokenAvailable,
  };
}

function classifySecretManagerGrpcError(err: unknown): {
  status: SecretManagerProbeStatus;
  apiEnabled: boolean;
  iamPermitted: boolean;
  detail: string;
} {
  const e = err as { code?: number | string; message?: string; details?: string };
  const code = e?.code;
  const msg = String(e?.details || e?.message || '');

  // gRPC 5 = NOT_FOUND -> API is enabled and caller has permission to query the resource; secret simply isn't created
  if (code === 5 || /NOT_FOUND/i.test(String(code))) {
    return {
      status: 'available',
      apiEnabled: true,
      iamPermitted: true,
      detail: 'Secret Manager API and IAM permissions are active (one or more secrets do not exist yet).',
    };
  }

  // gRPC 7 = PERMISSION_DENIED
  if (code === 7 || /PERMISSION_DENIED/i.test(String(code))) {
    if (/has not been used in project|is disabled/i.test(msg)) {
      return {
        status: 'api_disabled',
        apiEnabled: false,
        iamPermitted: false,
        detail: 'Google Cloud Secret Manager API is disabled in the active GCP project.',
      };
    }
    return {
      status: 'iam_denied',
      apiEnabled: true,
      iamPermitted: false,
      detail: 'Attached Google Cloud service identity lacks Secret Manager IAM access (roles/secretmanager.secretAccessor).',
    };
  }

  // gRPC 16 = UNAUTHENTICATED
  if (code === 16 || /UNAUTHENTICATED|Could not load the default credentials/i.test(msg)) {
    return {
      status: 'unauthenticated',
      apiEnabled: false,
      iamPermitted: false,
      detail: 'Google Cloud Application Default Credentials are missing or unauthenticated.',
    };
  }

  return {
    status: 'network_error',
    apiEnabled: false,
    iamPermitted: false,
    detail: 'Unable to reach Google Cloud Secret Manager API.',
  };
}

async function probeAndLoadFromSecretManager(
  missingNames: ManagedSecretName[],
): Promise<{
  loaded: Map<ManagedSecretName, string>;
  report: SecretManagerCapabilityReport;
}> {
  const loaded = new Map<ManagedSecretName, string>();

  if (process.env.DISABLE_SECRET_MANAGER === 'true') {
    return {
      loaded,
      report: {
        capable: false,
        adcAvailable: false,
        adcMethod: 'none',
        projectIdAvailable: false,
        projectIdSource: 'none',
        projectId: null,
        serviceAccountEmail: null,
        outboundHttpsSupported: false,
        apiEnabled: false,
        iamPermitted: false,
        status: 'disabled_by_config',
        detail: 'Secret Manager lookup disabled via DISABLE_SECRET_MANAGER=true.',
      },
    };
  }

  const [meta, discoveryCheck] = await Promise.all([
    probeMetadataIdentity(),
    safeHttpRequest('https://secretmanager.googleapis.com/$discovery/rest?version=v1', {}, 1500),
  ]);

  const adcFile = detectAdcFilePath();
  const adcAvailable = Boolean(adcFile || meta.tokenAvailable);
  const adcMethod: SecretManagerCapabilityReport['adcMethod'] = adcFile
    ? 'adc_file'
    : meta.tokenAvailable
      ? 'metadata_service_identity'
      : 'none';

  const explicitProj = getExplicitEnvProjectId();
  let projectId = explicitProj || meta.projectId;
  let projectIdSource: SecretManagerCapabilityReport['projectIdSource'] = explicitProj
    ? 'env'
    : meta.projectId
      ? 'metadata_server'
      : 'none';

  const outboundHttpsSupported = discoveryCheck.ok;

  if (!adcAvailable) {
    return {
      loaded,
      report: {
        capable: false,
        adcAvailable: false,
        adcMethod: 'none',
        projectIdAvailable: Boolean(projectId),
        projectIdSource,
        projectId,
        serviceAccountEmail: meta.serviceAccountEmail,
        outboundHttpsSupported,
        apiEnabled: false,
        iamPermitted: false,
        status: 'no_adc',
        detail: 'No Application Default Credentials or attached Cloud Run service identity found.',
      },
    };
  }

  let client: SecretManagerServiceClient;
  try {
    client = new SecretManagerServiceClient(projectId ? { projectId } : {});
    if (!projectId) {
      const sdkProj = await client.getProjectId().catch(() => null);
      if (sdkProj) {
        projectId = sdkProj;
        projectIdSource = 'sdk';
      }
    }
  } catch {
    return {
      loaded,
      report: {
        capable: false,
        adcAvailable,
        adcMethod,
        projectIdAvailable: Boolean(projectId),
        projectIdSource,
        projectId,
        serviceAccountEmail: meta.serviceAccountEmail,
        outboundHttpsSupported,
        apiEnabled: false,
        iamPermitted: false,
        status: 'no_adc',
        detail: 'Failed to initialize Google Cloud Secret Manager SDK client with ADC.',
      },
    };
  }

  if (!projectId) {
    return {
      loaded,
      report: {
        capable: false,
        adcAvailable,
        adcMethod,
        projectIdAvailable: false,
        projectIdSource: 'none',
        projectId: null,
        serviceAccountEmail: meta.serviceAccountEmail,
        outboundHttpsSupported,
        apiEnabled: false,
        iamPermitted: false,
        status: 'no_project_id',
        detail: 'No Google Cloud Project ID detected for Secret Manager.',
      },
    };
  }

  const probeTargets: ManagedSecretName[] =
    missingNames.length > 0 ? missingNames : ['SQL_HOST'];

  let apiEnabled = false;
  let iamPermitted = false;
  let status: SecretManagerProbeStatus = 'not_probed';
  let detail = '';

  // First test listSecrets (1 item) or direct secret access; accessSecretVersion works even with least-privilege secretAccessor role
  for (const secretName of probeTargets) {
    const resourceName = `projects/${projectId}/secrets/${secretName}/versions/latest`;
    try {
      const [version] = await client.accessSecretVersion(
        { name: resourceName },
        { timeout: 2500, retry: null },
      );
      apiEnabled = true;
      iamPermitted = true;
      status = 'available';
      detail = 'Google Cloud Secret Manager is accessible via attached ADC identity.';
      const rawPayload = version.payload?.data;
      const val =
        typeof rawPayload === 'string'
          ? rawPayload.trim()
          : rawPayload
            ? Buffer.from(rawPayload).toString('utf8').trim()
            : '';
      if (val && missingNames.includes(secretName)) {
        loaded.set(secretName, val);
      }
    } catch (err) {
      const classified = classifySecretManagerGrpcError(err);
      apiEnabled = classified.apiEnabled;
      iamPermitted = classified.iamPermitted;
      status = classified.status;
      detail = classified.detail;
      // If API is disabled, IAM denied, unauthenticated, or network unreachable, stop probing further secrets immediately
      if (classified.status !== 'available') {
        break;
      }
    }
  }

  try {
    await client.close();
  } catch {
    // ignore close errors
  }

  return {
    loaded,
    report: {
      capable: status === 'available' && apiEnabled && iamPermitted,
      adcAvailable,
      adcMethod,
      projectIdAvailable: Boolean(projectId),
      projectIdSource,
      projectId,
      serviceAccountEmail: meta.serviceAccountEmail,
      outboundHttpsSupported,
      apiEnabled,
      iamPermitted,
      status,
      detail,
    },
  };
}

function buildSnapshotFromVault(smReport: SecretManagerCapabilityReport): SecretProviderSnapshot {
  const sources = {} as Record<RequiredSecretName, SecretItemSource>;
  const presentRequired: RequiredSecretName[] = [];
  const missingRequired: RequiredSecretName[] = [];

  let envCount = 0;
  let smCount = 0;

  const resolveDirectSource = (name: ManagedSecretName): SecretItemSource => {
    const envVal = (process.env[name] || '').trim();
    const vaulted = resolvedSecretVault.get(name);
    if (envVal && vaulted?.source !== 'secret-manager') {
      return 'environment';
    }
    if (vaulted?.source === 'secret-manager' && vaulted.value) {
      return 'secret-manager';
    }
    return 'missing';
  };

  const requiredAliasMap: Partial<Record<RequiredSecretName, ManagedSecretName>> = {
    SQL_HOST: 'NONOLAND_DB_HOST',
    SQL_USER: 'NONOLAND_DB_USER',
    SQL_PASSWORD: 'NONOLAND_DB_PASSWORD',
    NONOLAND_SESSION_SECRET: 'SESSION_SECRET',
  };

  for (const name of REQUIRED_SECRET_NAMES) {
    let resolvedSource = resolveDirectSource(name);
    const aliasName = requiredAliasMap[name];
    if (resolvedSource === 'missing' && aliasName) {
      resolvedSource = resolveDirectSource(aliasName);
    }
    sources[name] = resolvedSource;
    if (resolvedSource === 'environment') {
      presentRequired.push(name);
      envCount += 1;
    } else if (resolvedSource === 'secret-manager') {
      presentRequired.push(name);
      smCount += 1;
    } else {
      missingRequired.push(name);
    }
  }

  const optionalSources = {} as Record<OptionalSecretName, SecretItemSource>;
  for (const name of OPTIONAL_SECRET_NAMES) {
    optionalSources[name] = resolveDirectSource(name);
  }

  let secretSource: OverallSecretSource = 'none';
  if (envCount > 0 && smCount > 0) secretSource = 'mixed';
  else if (envCount > 0) secretSource = 'environment';
  else if (smCount > 0) secretSource = 'secret-manager';

  let configurationError: string | null = null;
  if (missingRequired.length > 0) {
    configurationError = `Missing required configuration secret(s): ${missingRequired.join(', ')}. ${smReport.detail}`;
  }

  return {
    initialized: true,
    secretSource,
    presentRequired,
    missingRequired,
    sources,
    optionalSources,
    secretManager: smReport,
    configurationError,
  };
}

export async function initializeSecretProvider(options?: {
  forceProbeSecretManager?: boolean;
}): Promise<SecretProviderSnapshot> {
  if (initPromise && !options?.forceProbeSecretManager) {
    return initPromise;
  }

  const run = (async (): Promise<SecretProviderSnapshot> => {
    resolvedSecretVault.clear();

    // Priority 1: Existing process.env variables
    const missingNames: ManagedSecretName[] = [];
    for (const name of [...REQUIRED_SECRET_NAMES, ...OPTIONAL_SECRET_NAMES]) {
      const envVal = (process.env[name] || '').trim();
      if (envVal) {
        resolvedSecretVault.set(name, { value: envVal, source: 'environment' });
      } else {
        missingNames.push(name);
      }
    }

    const requiredAliasMap: Partial<Record<RequiredSecretName, ManagedSecretName>> = {
      SQL_HOST: 'NONOLAND_DB_HOST',
      SQL_USER: 'NONOLAND_DB_USER',
      SQL_PASSWORD: 'NONOLAND_DB_PASSWORD',
      NONOLAND_SESSION_SECRET: 'SESSION_SECRET',
    };
    const missingRequiredAfterAliases = REQUIRED_SECRET_NAMES.filter((name) => {
      if ((process.env[name] || '').trim()) return false;
      const alias = requiredAliasMap[name];
      return !(alias && (process.env[alias] || '').trim());
    });

    // Priority 2: Google Cloud Secret Manager (only if required keys are missing or diagnostic probe explicitly requested)
    let smReport: SecretManagerCapabilityReport;
    if (missingRequiredAfterAliases.length > 0 || options?.forceProbeSecretManager) {
      const smResult = await probeAndLoadFromSecretManager(missingNames);
      smReport = smResult.report;
      for (const [name, val] of smResult.loaded.entries()) {
        // Never overwrite existing process.env variables (Priority 1 wins)
        if (!(process.env[name] || '').trim() && val) {
          resolvedSecretVault.set(name, { value: val, source: 'secret-manager' });
          process.env[name] = val;
        }
      }
    } else {
      smReport = {
        capable: false,
        adcAvailable: false,
        adcMethod: 'none',
        projectIdAvailable: false,
        projectIdSource: 'none',
        projectId: null,
        serviceAccountEmail: null,
        outboundHttpsSupported: false,
        apiEnabled: false,
        iamPermitted: false,
        status: 'not_probed',
        detail: 'All required secrets resolved from process.env; Secret Manager probe skipped.',
      };
    }

    const snap = buildSnapshotFromVault(smReport);
    cachedSnapshot = snap;
    return snap;
  })();

  if (!options?.forceProbeSecretManager) {
    initPromise = run;
  }
  return run;
}

function getSingleSecret(name: ManagedSecretName): string | undefined {
  // Always honor Priority 1 (live process.env) first
  const envVal = (process.env[name] || '').trim();
  const vaulted = resolvedSecretVault.get(name);
  if (envVal) {
    return envVal;
  }
  return vaulted?.value || undefined;
}

export function getSecret(name: ManagedSecretName): string | undefined {
  if (name === 'NONOLAND_SESSION_SECRET') {
    return getSingleSecret('NONOLAND_SESSION_SECRET') || getSingleSecret('SESSION_SECRET');
  }
  if (name === 'SESSION_SECRET') {
    return getSingleSecret('SESSION_SECRET') || getSingleSecret('NONOLAND_SESSION_SECRET');
  }
  if (name === 'SQL_HOST') {
    return getSingleSecret('SQL_HOST') || getSingleSecret('NONOLAND_DB_HOST');
  }
  if (name === 'SQL_DIRECT_HOST') {
    return getSingleSecret('SQL_DIRECT_HOST') || getSingleSecret('NONOLAND_DB_DIRECT_HOST');
  }
  if (name === 'SQL_USER') {
    return getSingleSecret('SQL_USER') || getSingleSecret('NONOLAND_DB_USER');
  }
  if (name === 'SQL_PASSWORD') {
    return getSingleSecret('SQL_PASSWORD') || getSingleSecret('NONOLAND_DB_PASSWORD');
  }
  return getSingleSecret(name);
}

export function getNonSensitiveDbSettings(): {
  SQL_DB_NAME: string;
  SQL_PORT: number;
  SQL_SSL: boolean;
} {
  const dbName =
    (process.env.NONOLAND_DB_NAME || process.env.SQL_DB_NAME || '').trim() ||
    NON_SENSITIVE_DB_DEFAULTS.SQL_DB_NAME;
  const rawPort = Number((process.env.SQL_PORT || '').trim());
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : NON_SENSITIVE_DB_DEFAULTS.SQL_PORT;
  const rawSsl = (process.env.SQL_SSL || '').trim().toLowerCase();
  const ssl =
    rawSsl === 'false' || rawSsl === 'disable' || rawSsl === '0'
      ? false
      : NON_SENSITIVE_DB_DEFAULTS.SQL_SSL;
  return { SQL_DB_NAME: dbName, SQL_PORT: port, SQL_SSL: ssl };
}

export function getSecretProviderSnapshotSync(): SecretProviderSnapshot {
  if (cachedSnapshot) {
    // Re-evaluate live process.env in case test harness mutated env
    return buildSnapshotFromVault(cachedSnapshot.secretManager);
  }
  return buildSnapshotFromVault({
    capable: false,
    adcAvailable: false,
    adcMethod: 'none',
    projectIdAvailable: false,
    projectIdSource: 'none',
    projectId: null,
    serviceAccountEmail: null,
    outboundHttpsSupported: false,
    apiEnabled: false,
    iamPermitted: false,
    status: 'not_probed',
    detail: 'Secret provider not yet probed.',
  });
}

export function resetSecretProviderForTesting(): void {
  resolvedSecretVault.clear();
  cachedSnapshot = null;
  initPromise = null;
}
