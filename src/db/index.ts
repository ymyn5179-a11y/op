import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export type PgConfigSource = 'NONOLAND_DB_*' | 'SQL_*' | 'DATABASE_URL' | 'none';

export interface PgConnectionDiagnostics {
  configured: boolean;
  configComplete: boolean;
  source: 'sql_vars' | 'database_url' | 'none';
  configSource: PgConfigSource;
  databaseName: string | null;
  missingEnvVars: string[];
  sslEnabled: boolean;
  isNeonHost: boolean;
  isPooledEndpoint: boolean;
  hasDirectMigrationHost: boolean;
}

function isLocalOrSocketHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return true;
  if (h.startsWith('/')) return true;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function resolveSslOption(host: string, urlSslMode?: string | null): PoolConfig['ssl'] {
  const rawSsl = (process.env.SQL_SSL || '').trim().toLowerCase();
  if (rawSsl === 'false' || rawSsl === 'disable' || rawSsl === '0') {
    return false;
  }
  if (rawSsl === 'no-verify') {
    return { rejectUnauthorized: false };
  }
  if (rawSsl === 'true' || rawSsl === 'require' || rawSsl === '1') {
    return { rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  const mode = (urlSslMode || '').trim().toLowerCase();
  if (mode === 'disable') {
    return false;
  }
  if (mode === 'no-verify' || mode === 'allow' || mode === 'prefer') {
    return { rejectUnauthorized: false };
  }
  if (
    mode === 'require' ||
    mode === 'verify-ca' ||
    mode === 'verify-full' ||
    host.toLowerCase().endsWith('.neon.tech') ||
    !isLocalOrSocketHost(host) ||
    process.env.NODE_ENV === 'production'
  ) {
    return { rejectUnauthorized: process.env.SQL_SSL_REJECT_UNAUTHORIZED !== 'false' };
  }
  return false;
}

function sanitizePgErrorMessage(msg: string): string {
  return String(msg || 'Unknown PostgreSQL error').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, 'postgresql://[REDACTED]');
}

function getResolvedSqlHost(): string {
  return (process.env.NONOLAND_DB_HOST || '').trim() || (process.env.SQL_HOST || '').trim();
}

function getResolvedSqlDirectHost(): string {
  return (process.env.NONOLAND_DB_DIRECT_HOST || '').trim() || (process.env.SQL_DIRECT_HOST || '').trim();
}

function getResolvedSqlDbName(): string {
  return (process.env.NONOLAND_DB_NAME || '').trim() || (process.env.SQL_DB_NAME || '').trim();
}

function getResolvedSqlUser(): string {
  return (process.env.NONOLAND_DB_USER || '').trim() || (process.env.SQL_USER || '').trim();
}

function getResolvedSqlPassword(): string {
  if ((process.env.NONOLAND_DB_PASSWORD || '').trim()) {
    return process.env.NONOLAND_DB_PASSWORD as string;
  }
  return process.env.SQL_PASSWORD ?? '';
}

interface ResolvedPgConfig {
  diagnostics: PgConnectionDiagnostics;
  poolConfig: PoolConfig;
}

function resolvePgConfig(): ResolvedPgConfig {
  const max = Number(process.env.SQL_POOL_MAX) || 10;
  const connectionTimeoutMillis = Number(process.env.SQL_CONNECTION_TIMEOUT_MS) || 15000;
  const idleTimeoutMillis = Number(process.env.SQL_IDLE_TIMEOUT_MS) || 30000;
  const sqlPort = Number(process.env.SQL_PORT) || 5432;

  const nonolandHost = (process.env.NONOLAND_DB_HOST || '').trim();
  const nonolandDb = (process.env.NONOLAND_DB_NAME || '').trim();
  const nonolandUser = (process.env.NONOLAND_DB_USER || '').trim();
  const nonolandPassword = process.env.NONOLAND_DB_PASSWORD ?? '';
  const hasAnyNonoland = Boolean(nonolandHost || nonolandDb || nonolandUser || nonolandPassword.trim());

  const rawSqlHost = (process.env.SQL_HOST || '').trim();
  const rawSqlDb = (process.env.SQL_DB_NAME || '').trim();
  const rawSqlUser = (process.env.SQL_USER || '').trim();
  const rawSqlPassword = process.env.SQL_PASSWORD ?? '';
  const hasAnySql = Boolean(rawSqlHost || rawSqlDb || rawSqlUser || rawSqlPassword.trim());

  const sqlHost = getResolvedSqlHost();
  const explicitSqlDb = getResolvedSqlDbName();
  const sqlDb = explicitSqlDb || 'neondb';
  const sqlUser = getResolvedSqlUser();
  const sqlPassword = getResolvedSqlPassword();
  const trimmedPassword = sqlPassword.trim();
  const hasDirectMigrationHost = Boolean(
    getResolvedSqlDirectHost() || (process.env.DIRECT_DATABASE_URL || '').trim(),
  );

  const individualComplete = Boolean(
    sqlHost && sqlDb && sqlUser && (trimmedPassword || isLocalOrSocketHost(sqlHost)),
  );
  const individualConfigSource: PgConfigSource = nonolandHost
    ? 'NONOLAND_DB_*'
    : hasAnySql && !nonolandUser && !nonolandPassword.trim()
      ? 'SQL_*'
      : hasAnyNonoland
        ? 'NONOLAND_DB_*'
        : 'SQL_*';

  if (individualComplete) {
    const sslOpt = resolveSslOption(sqlHost);
    return {
      diagnostics: {
        configured: true,
        configComplete: true,
        source: 'sql_vars',
        configSource: individualConfigSource,
        databaseName: sqlDb,
        missingEnvVars: [],
        sslEnabled: Boolean(sslOpt),
        isNeonHost: sqlHost.toLowerCase().includes('.neon.tech'),
        isPooledEndpoint: sqlHost.toLowerCase().includes('-pooler.'),
        hasDirectMigrationHost,
      },
      poolConfig: {
        host: sqlHost,
        port: sqlPort,
        user: sqlUser,
        password: sqlPassword,
        database: sqlDb,
        ssl: sslOpt,
        max,
        connectionTimeoutMillis,
        idleTimeoutMillis,
      },
    };
  }

  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const host = parsed.hostname || '';
      const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      const user = decodeURIComponent(parsed.username || '');
      const password = decodeURIComponent(parsed.password || '');
      const sslMode = parsed.searchParams.get('sslmode');
      const sslOpt = resolveSslOption(host, sslMode);
      const complete = Boolean(host && dbName && user);
      return {
        diagnostics: {
          configured: complete,
          configComplete: complete,
          source: 'database_url',
          configSource: 'DATABASE_URL',
          databaseName: dbName || null,
          missingEnvVars: complete ? [] : ['DATABASE_URL (missing host, user, or database name)'],
          sslEnabled: Boolean(sslOpt),
          isNeonHost: host.toLowerCase().includes('.neon.tech'),
          isPooledEndpoint: host.toLowerCase().includes('-pooler.'),
          hasDirectMigrationHost,
        },
        poolConfig: complete
          ? {
              host,
              port: Number(parsed.port) || sqlPort,
              user,
              password,
              database: dbName,
              ssl: sslOpt,
              max,
              connectionTimeoutMillis,
              idleTimeoutMillis,
            }
          : {
              host: undefined,
              user: undefined,
              password: undefined,
              database: undefined,
              max,
              connectionTimeoutMillis,
              idleTimeoutMillis,
            },
      };
    } catch {
      return {
        diagnostics: {
          configured: false,
          configComplete: false,
          source: 'database_url',
          configSource: 'DATABASE_URL',
          databaseName: null,
          missingEnvVars: ['DATABASE_URL (invalid connection URI format)'],
          sslEnabled: false,
          isNeonHost: false,
          isPooledEndpoint: false,
          hasDirectMigrationHost: false,
        },
        poolConfig: {
          host: undefined,
          user: undefined,
          password: undefined,
          database: undefined,
          max,
          connectionTimeoutMillis,
          idleTimeoutMillis,
        },
      };
    }
  }

  if (hasAnyNonoland || hasAnySql) {
    const missing: string[] = [];
    if (!sqlHost) missing.push('SQL_HOST');
    if (!sqlUser) missing.push('SQL_USER');
    if (!trimmedPassword && !isLocalOrSocketHost(sqlHost)) missing.push('SQL_PASSWORD');
    const sslOpt = resolveSslOption(sqlHost);
    return {
      diagnostics: {
        configured: false,
        configComplete: false,
        source: 'sql_vars',
        configSource: individualConfigSource,
        databaseName: sqlDb,
        missingEnvVars: missing,
        sslEnabled: Boolean(sslOpt),
        isNeonHost: sqlHost.toLowerCase().includes('.neon.tech'),
        isPooledEndpoint: sqlHost.toLowerCase().includes('-pooler.'),
        hasDirectMigrationHost,
      },
      poolConfig: {
        host: undefined,
        user: undefined,
        password: undefined,
        database: undefined,
        max,
        connectionTimeoutMillis,
        idleTimeoutMillis,
      },
    };
  }

  return {
    diagnostics: {
      configured: false,
      configComplete: false,
      source: 'none',
      configSource: 'none',
      databaseName: null,
      missingEnvVars: ['SQL_HOST', 'SQL_DB_NAME', 'SQL_USER', 'SQL_PASSWORD'],
      sslEnabled: false,
      isNeonHost: false,
      isPooledEndpoint: false,
      hasDirectMigrationHost: false,
    },
    poolConfig: {
      host: undefined,
      user: undefined,
      password: undefined,
      database: undefined,
      max,
      connectionTimeoutMillis,
      idleTimeoutMillis,
    },
  };
}

export function getPgConnectionDiagnostics(): PgConnectionDiagnostics {
  return resolvePgConfig().diagnostics;
}

function buildPoolConfig(): PoolConfig {
  return resolvePgConfig().poolConfig;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());

    global._postgresPool.on('error', (err) => {
      const safeCode = (err as { code?: string })?.code || 'POOL_ERROR';
      console.error(`PostgreSQL idle pool error [${safeCode}]:`, sanitizePgErrorMessage(err.message));
    });
  }
  return global._postgresPool;
};

export function resetPoolForResolvedSecrets(): void {
  if (global._postgresPool) {
    const oldPool = global._postgresPool;
    global._postgresPool = new Pool(buildPoolConfig());
    global._postgresPool.on('error', (err) => {
      const safeCode = (err as { code?: string })?.code || 'POOL_ERROR';
      console.error(`PostgreSQL idle pool error [${safeCode}]:`, sanitizePgErrorMessage(err.message));
    });
    pool = global._postgresPool;
    db = drizzle(pool, { schema });
    void oldPool.end().catch(() => {});
  }
}

export let pool = createPool();
export let db = drizzle(pool, { schema });

