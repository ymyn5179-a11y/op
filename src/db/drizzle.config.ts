import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const isGenerateOnly = process.argv.some((arg) => arg === 'generate');

function resolveDrizzleCredentials() {
  const directUrl = (process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  const host = (
    process.env.SQL_DIRECT_HOST ||
    process.env.NONOLAND_DB_DIRECT_HOST ||
    process.env.SQL_HOST ||
    process.env.NONOLAND_DB_HOST ||
    ''
  ).trim();
  const explicitDatabase = (process.env.SQL_DB_NAME || process.env.NONOLAND_DB_NAME || '').trim();
  const database = explicitDatabase || 'neondb';
  const user = (process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.NONOLAND_DB_USER || '').trim();
  const password = (
    process.env.SQL_ADMIN_PASSWORD ||
    process.env.SQL_PASSWORD ||
    process.env.NONOLAND_DB_PASSWORD ||
    ''
  ).trim();
  const port = Number(process.env.SQL_PORT) || 5432;

  if (host || explicitDatabase || user) {
    if (!isGenerateOnly) {
      if (!host) throw new Error('SQL_DIRECT_HOST, NONOLAND_DB_DIRECT_HOST, SQL_HOST, or NONOLAND_DB_HOST must be set in environment variables.');
      if (!database) throw new Error('SQL_DB_NAME or NONOLAND_DB_NAME must be set in environment variables.');
      if (!user) throw new Error('SQL_ADMIN_USER, SQL_USER, or NONOLAND_DB_USER must be set in environment variables.');
      if (!password) throw new Error('SQL_ADMIN_PASSWORD, SQL_PASSWORD, or NONOLAND_DB_PASSWORD must be set in environment variables.');
    }

    const rawSsl = (process.env.SQL_SSL || '').trim().toLowerCase();
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) || host.startsWith('/');
    const useSsl =
      rawSsl === 'false' || rawSsl === 'disable'
        ? false
        : rawSsl === 'no-verify'
          ? { rejectUnauthorized: false }
          : rawSsl === 'true' || rawSsl === 'require' || host.toLowerCase().includes('.neon.tech') || !isLocal
            ? ('require' as const)
            : false;

    return {
      host: host || 'localhost',
      port,
      user: user || 'postgres',
      password: password || 'postgres',
      database: database || 'nonoland',
      ssl: useSsl,
    };
  }

  if (directUrl) {
    return {
      url: directUrl,
    };
  }

  if (!isGenerateOnly) {
    throw new Error(
      'PostgreSQL credentials are not configured. Set SQL_HOST (or SQL_DIRECT_HOST), SQL_DB_NAME, SQL_USER (or SQL_ADMIN_USER), and SQL_PASSWORD (or SQL_ADMIN_PASSWORD).',
    );
  }

  return {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'placeholder_for_generate',
    database: 'nonoland',
    ssl: false as const,
  };
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: resolveDrizzleCredentials(),
  verbose: true,
});

