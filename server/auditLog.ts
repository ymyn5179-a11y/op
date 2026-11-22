import crypto from 'crypto';
import type express from 'express';
import type { SecurityEventLog } from '../src/types/nonoland';
import type { AuthenticatedRequest, ServerDb } from './dbTypes';

const SENSITIVE_KEY_PATTERN = /(password|passwordhash|token|secret|apikey|gemini_api_key|csrf|cookie)/i;

function redactValue(val: unknown, depth = 0): unknown {
  if (val === null || val === undefined) return val;
  if (depth > 4) return '[TRUNCATED]';
  if (typeof val === 'string') {
    return val
      .replace(/(password|token|secret|csrf|cookie|apiKey)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .slice(0, 300);
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.slice(0, 20).map((item) => redactValue(item, depth + 1));
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>).slice(0, 24)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(v, depth + 1);
      }
    }
    return out;
  }
  return String(val).slice(0, 120);
}

export interface AuditRecordInput {
  eventType: SecurityEventLog['eventType'];
  actorId?: string;
  actorRole?: string;
  actionType: string;
  recordType: string;
  recordId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  outcome?: 'success' | 'denied' | 'blocked' | 'error';
  ip?: string;
  summary: string;
}

/**
 * Append-only immutable audit record writer.
 * Redacts credentials/secrets before writing and caps memory at 3,000 recent events.
 */
export function recordAuditEvent(db: ServerDb, input: AuditRecordInput): SecurityEventLog {
  const safeSummary = String(input.summary || '')
    .replace(/(password|token|secret|csrf|cookie|apiKey)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, 320);

  const entry: SecurityEventLog = {
    id: `aud_${crypto.randomBytes(6).toString('hex')}`,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    role: input.actorRole,
    actionType: input.actionType,
    recordType: input.recordType,
    recordId: input.recordId,
    previousValue: redactValue(input.previousValue),
    newValue: redactValue(input.newValue),
    reason: input.reason ? String(input.reason).slice(0, 180) : undefined,
    outcome: input.outcome || 'success',
    ip: input.ip,
    summary: safeSummary,
    createdAt: new Date().toISOString(),
  };

  db.securityLogs.unshift(entry);
  if (db.securityLogs.length > 3000) {
    db.securityLogs.length = 3000;
  }
  return entry;
}

export function registerImmutableAuditGuards(
  app: express.Express,
  requireAdminPermission: (
    permission: string,
  ) => (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void,
) {
  const rejectMutation = (req: AuthenticatedRequest, res: express.Response) => {
    return res.status(403).json({
      error: 'Audit logs are strictly append-only and immutable. Modification or deletion is forbidden.',
      code: 'AUDIT_IMMUTABLE',
      method: req.method,
    });
  };

  app.put('/api/admin/audit-logs*', requireAdminPermission('view_security_logs'), rejectMutation);
  app.patch('/api/admin/audit-logs*', requireAdminPermission('view_security_logs'), rejectMutation);
  app.delete('/api/admin/audit-logs*', requireAdminPermission('view_security_logs'), rejectMutation);
  app.post('/api/admin/audit-logs*', requireAdminPermission('view_security_logs'), rejectMutation);
}
