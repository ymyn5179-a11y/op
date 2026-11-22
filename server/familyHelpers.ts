import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import { DEFAULT_LEARNING_GARDEN_STATE, GARDEN_ITEMS_CATALOG, sanitizeLearningGarden } from '../src/data/gardenCatalog';
import type {
  ChildProfile,
  ContentPermissionPolicy,
  FamilyAccount,
  FamilyAuditEvent,
  FamilyPrivacySettings,
  GardenRewardEvent,
  GuardianMembership,
  GuardianPermission,
  GuardianRole,
  LocalizedText,
  PrivacyConsentRecord,
  UserRole,
} from '../src/types/nonoland';
import { POLICY_VERSION, sanitizeShortText } from '../src/utils/validation';
import type { AuthenticatedRequest, ServerDb, StoredChildRecord } from './dbTypes';
import { appendSecurityLog, StoredUserRecord } from './security';

export const ALL_GUARDIAN_PERMISSIONS: GuardianPermission[] = [
  'view_profiles',
  'view_progress',
  'view_reports',
  'manage_learning_settings',
  'manage_credentials',
  'manage_screen_time',
  'approve_content',
  'manage_devices',
  'manage_guardians',
];

export const DEFAULT_GUARDIAN_PERMISSIONS_BY_ROLE: Record<GuardianRole, GuardianPermission[]> = {
  primary_guardian: [...ALL_GUARDIAN_PERMISSIONS],
  secondary_guardian: [
    'view_profiles',
    'view_progress',
    'view_reports',
    'manage_learning_settings',
    'manage_screen_time',
    'approve_content',
  ],
  caregiver: ['view_profiles', 'view_progress'],
};

export function isChildOrStudentRole(role?: UserRole): boolean {
  return role === 'child' || role === 'student';
}

export function isParentOrStaffRole(role?: UserRole): boolean {
  return role === 'parent';
}

export function writeDbAtomic(dbDir: string, dbFile: string, db: ServerDb): void {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const tmpFile = path.join(dbDir, `.nonoland-db-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.tmp`);
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, dbFile);
}

export function ensureFamilyCollections(db: ServerDb): void {
  db.families = db.families || {};
  db.guardianMemberships = db.guardianMemberships || {};
  db.guardianInvitations = db.guardianInvitations || {};
  db.trustedDevices = db.trustedDevices || {};
  db.parentGateCredentials = db.parentGateCredentials || {};
  db.childCredentials = db.childCredentials || {};
  db.childAccessCodeIndex = db.childAccessCodeIndex || {};
  db.archivedChildren = db.archivedChildren || {};
  db.familyAuditEvents = db.familyAuditEvents || [];
  db.contentPolicies = db.contentPolicies || {};
  db.privacySettings = db.privacySettings || {};
  db.privacyConsents = db.privacyConsents || {};
  db.dataRequests = db.dataRequests || {};
  db.aiUsageRecords = db.aiUsageRecords || {};
  db.gardenRewardEvents = db.gardenRewardEvents || {};
  db.quranChildSettings = db.quranChildSettings || {};
  db.quranSurahProgress = db.quranSurahProgress || {};
  db.quranStoryProgress = db.quranStoryProgress || {};
  db.quranStoryDetails = db.quranStoryDetails || {};
  db.quranStoryCms = db.quranStoryCms || {};
  db.quranMannerProgress = db.quranMannerProgress || {};
  db.quranActivityEvents = db.quranActivityEvents || [];
  db.quranContentVerifications = db.quranContentVerifications || {};
}

export function createDefaultContentPolicy(familyId: string, updatedBy?: string): ContentPermissionPolicy {
  return {
    familyId,
    allowStories: true,
    allowSongsAudio: true,
    allowVideos: true,
    allowGamesCreative: true,
    aiCompanionEnabled: true,
    voiceInteractionEnabled: true,
    ageStrictMode: true,
    allowExternalContent: false,
    allowedStoryCategories: ['interactive', 'bedtime', 'originals', 'prediction', 'values'],
    blockedVideoIds: [],
    allowedVideoIds: [],
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}

export function createDefaultPrivacySettings(familyId: string, updatedBy?: string): FamilyPrivacySettings {
  const nowIso = new Date().toISOString();
  return {
    familyId,
    childProfileVisibility: 'private',
    aiFeaturesConsent: true,
    voiceInteractionConsent: true,
    analyticsConsent: true,
    essentialTermsConsent: true,
    policyVersion: POLICY_VERSION,
    updatedAt: nowIso,
    updatedBy,
  };
}

export function ensureFamilyForUser(db: ServerDb, user: StoredUserRecord): FamilyAccount {
  ensureFamilyCollections(db);

  if (user.familyId && db.families![user.familyId]) {
    const fam = db.families![user.familyId];
    if (!db.contentPolicies![fam.id]) db.contentPolicies![fam.id] = createDefaultContentPolicy(fam.id, user.id);
    if (!db.privacySettings![fam.id]) db.privacySettings![fam.id] = createDefaultPrivacySettings(fam.id, user.id);
    return fam;
  }

  // Check existing active guardian membership
  const activeMembership = Object.values(db.guardianMemberships!).find(
    (m) => m.userId === user.id && m.status === 'active',
  );
  if (activeMembership && db.families![activeMembership.familyId]) {
    user.familyId = activeMembership.familyId;
    const fam = db.families![activeMembership.familyId];
    if (!db.contentPolicies![fam.id]) db.contentPolicies![fam.id] = createDefaultContentPolicy(fam.id, user.id);
    if (!db.privacySettings![fam.id]) db.privacySettings![fam.id] = createDefaultPrivacySettings(fam.id, user.id);
    return fam;
  }

  // Create deterministic private family space for this parent
  const nowIso = new Date().toISOString();
  const familyId = `fam_${user.id}`;
  const existingFam = db.families![familyId];
  const fam: FamilyAccount = existingFam || {
    id: familyId,
    name: user.displayName ? `${user.displayName}` : 'NonoLand Family',
    primaryGuardianId: user.id,
    createdAt: user.createdAt || nowIso,
    updatedAt: nowIso,
  };
  db.families![familyId] = fam;
  user.familyId = familyId;

  const memId = `gm_${familyId}_${user.id}`;
  if (!db.guardianMemberships![memId]) {
    db.guardianMemberships![memId] = {
      id: memId,
      familyId,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: 'primary_guardian',
      permissions: [...ALL_GUARDIAN_PERMISSIONS],
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  if (!db.contentPolicies![familyId]) {
    db.contentPolicies![familyId] = createDefaultContentPolicy(familyId, user.id);
  }
  if (!db.privacySettings![familyId]) {
    db.privacySettings![familyId] = createDefaultPrivacySettings(familyId, user.id);
  }
  if (!db.privacyConsents![familyId]) {
    db.privacyConsents![familyId] = [
      {
        id: `con_${crypto.randomBytes(4).toString('hex')}`,
        familyId,
        consentKey: 'essential_terms',
        granted: true,
        policyVersion: POLICY_VERSION,
        grantedByUserId: user.id,
        grantedByName: user.displayName,
        grantedAt: user.termsAcceptedAt || nowIso,
      },
      {
        id: `con_${crypto.randomBytes(4).toString('hex')}`,
        familyId,
        consentKey: 'ai_features',
        granted: true,
        policyVersion: POLICY_VERSION,
        grantedByUserId: user.id,
        grantedByName: user.displayName,
        grantedAt: nowIso,
      },
      {
        id: `con_${crypto.randomBytes(4).toString('hex')}`,
        familyId,
        consentKey: 'voice_interaction',
        granted: true,
        policyVersion: POLICY_VERSION,
        grantedByUserId: user.id,
        grantedByName: user.displayName,
        grantedAt: nowIso,
      },
    ];
  }

  return fam;
}

export function ensureChildFamilyAndGarden(db: ServerDb, child: StoredChildRecord): string {
  ensureFamilyCollections(db);
  if (!child.familyId && child.parentId && db.users[child.parentId]) {
    const fam = ensureFamilyForUser(db, db.users[child.parentId]);
    child.familyId = fam.id;
  } else if (!child.familyId && child.parentId) {
    child.familyId = `fam_${child.parentId}`;
  }
  child.learningGarden = sanitizeLearningGarden(child.learningGarden || DEFAULT_LEARNING_GARDEN_STATE);
  return child.familyId || `fam_${child.parentId}`;
}

export function getActiveGuardianMembership(
  db: ServerDb,
  user: StoredUserRecord,
  familyId: string,
): GuardianMembership | null {
  ensureFamilyCollections(db);
  const fam = db.families![familyId];
  if (fam && fam.primaryGuardianId === user.id) {
    const directMem = Object.values(db.guardianMemberships!).find(
      (m) => m.familyId === familyId && m.userId === user.id,
    );
    if (directMem) return directMem;
    return {
      id: `gm_${familyId}_${user.id}`,
      familyId,
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: 'primary_guardian',
      permissions: [...ALL_GUARDIAN_PERMISSIONS],
      status: 'active',
      createdAt: fam.createdAt,
      updatedAt: fam.updatedAt,
    };
  }

  const membership = Object.values(db.guardianMemberships!).find(
    (m) => m.familyId === familyId && m.userId === user.id && m.status === 'active',
  );
  return membership || null;
}

export function resolveFamilyIdForUser(db: ServerDb, user: StoredUserRecord): string | null {
  ensureFamilyCollections(db);
  if (isChildOrStudentRole(user.role)) {
    if (!user.linkedChildId) return null;
    const child = db.children[user.linkedChildId];
    return child ? ensureChildFamilyAndGarden(db, child) : null;
  }
  if (user.role === 'parent') {
    if (user.familyId && db.families![user.familyId]) {
      const mem = getActiveGuardianMembership(db, user, user.familyId);
      if (mem) return user.familyId;
    }
    const activeMembership = Object.values(db.guardianMemberships!).find(
      (m) => m.userId === user.id && m.status === 'active',
    );
    if (activeMembership) {
      user.familyId = activeMembership.familyId;
      return activeMembership.familyId;
    }
    // Check if user was revoked from their previous family and has no ownership
    const revokedMem = Object.values(db.guardianMemberships!).find(
      (m) => m.userId === user.id && m.status === 'revoked',
    );
    if (revokedMem) {
      return null;
    }
    const ownChildren = Object.values(db.children).some((c) => c.parentId === user.id);
    if (ownChildren || !user.familyId) {
      return ensureFamilyForUser(db, user).id;
    }
    return null;
  }
  return user.familyId || null;
}

export function hasGuardianPermission(
  db: ServerDb,
  user: StoredUserRecord,
  familyId: string,
  permission: GuardianPermission,
): boolean {
  if (user.role === 'super_admin') return true;
  if (user.role !== 'parent') return false;
  const fam = db.families?.[familyId];
  if (fam?.primaryGuardianId === user.id) return true;
  const membership = getActiveGuardianMembership(db, user, familyId);
  if (!membership || membership.status !== 'active') return false;
  return membership.permissions.includes(permission);
}

export function canUserAccessChild(
  db: ServerDb,
  user: StoredUserRecord,
  child: StoredChildRecord,
  requiredPermission: GuardianPermission = 'view_profiles',
): boolean {
  if (!user || user.status !== 'active') return false;
  if (isChildOrStudentRole(user.role)) {
    return user.linkedChildId === child.id;
  }
  if (user.role === 'super_admin') return true;
  if (user.role === 'parent') {
    if (child.parentId === user.id) return true;
    const familyId = ensureChildFamilyAndGarden(db, child);
    return hasGuardianPermission(db, user, familyId, requiredPermission);
  }
  return false;
}

export function getAccessibleChildrenForUser(db: ServerDb, user: StoredUserRecord): StoredChildRecord[] {
  if (!user || user.status !== 'active') return [];
  if (isChildOrStudentRole(user.role)) {
    const child = user.linkedChildId ? db.children[user.linkedChildId] : undefined;
    return child ? [child] : [];
  }
  if (user.role === 'parent') {
    const famId = resolveFamilyIdForUser(db, user);
    return Object.values(db.children).filter((child) => {
      const cFamId = ensureChildFamilyAndGarden(db, child);
      if (child.parentId === user.id) return true;
      if (famId && cFamId === famId) {
        return hasGuardianPermission(db, user, cFamId, 'view_profiles');
      }
      return false;
    });
  }
  return [];
}

export function toSafeChildProfile(db: ServerDb, child: StoredChildRecord): ChildProfile & { parentId: string } {
  ensureFamilyCollections(db);
  const familyId = ensureChildFamilyAndGarden(db, child);
  const cred = db.childCredentials?.[child.id];
  return {
    ...child,
    familyId,
    hasChildCredentials: Boolean(cred),
    accessCodeMasked: cred ? `NL-••••-${cred.accessCodeLast4}` : undefined,
    learningGarden: sanitizeLearningGarden(child.learningGarden),
  };
}

export function requireParentGate(
  req: AuthenticatedRequest,
  res: express.Response,
): boolean {
  const session = req.authSession?.session;
  const user = req.authSession?.user;
  if (!session || !user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return false;
  }
  if (isChildOrStudentRole(user.role) || session.sessionKind === 'child') {
    res.status(403).json({
      error: 'Child sessions cannot bypass the Parent Gate. Please sign in as a parent.',
      code: 'CHILD_SESSION_FORBIDDEN',
    });
    return false;
  }
  if (user.role !== 'parent' && user.role !== 'super_admin') {
    res.status(403).json({ error: 'Parent role required', code: 'ROLE_FORBIDDEN' });
    return false;
  }
  if (!session.parentGateVerifiedUntil || session.parentGateVerifiedUntil <= Date.now()) {
    res.status(403).json({
      error: 'Parent verification required before accessing sensitive family settings.',
      code: 'PARENT_GATE_REQUIRED',
    });
    return false;
  }
  return true;
}

export function redactSensitiveText(input: string): string {
  return String(input || '')
    .replace(/(password|pin|token|secret|csrf|cookie|accesscode|access_code)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/NL-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'NL-XXXX-[REDACTED]')
    .slice(0, 320);
}

export function recordFamilyEvent(
  db: ServerDb,
  params: {
    familyId: string;
    category: FamilyAuditEvent['category'];
    actionType: string;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    childId?: string;
    childName?: string;
    deviceId?: string;
    severity?: FamilyAuditEvent['severity'];
    title: LocalizedText;
    description: LocalizedText;
    metadata?: Record<string, string | number | boolean>;
    ip?: string;
    securityEventType?: Parameters<typeof appendSecurityLog>[1]['eventType'];
  },
) {
  ensureFamilyCollections(db);
  const nowIso = new Date().toISOString();
  const safeMeta: Record<string, string | number | boolean> | undefined = params.metadata
    ? Object.fromEntries(
        Object.entries(params.metadata).map(([k, v]) => [
          sanitizeShortText(k, 40),
          typeof v === 'string' ? redactSensitiveText(v) : v,
        ]),
      )
    : undefined;

  const evt: FamilyAuditEvent = {
    id: `fevt_${crypto.randomBytes(5).toString('hex')}`,
    familyId: params.familyId,
    category: params.category,
    actionType: params.actionType,
    actorId: params.actorId,
    actorName: params.actorName ? sanitizeShortText(params.actorName, 60) : undefined,
    actorRole: params.actorRole,
    childId: params.childId,
    childName: params.childName ? sanitizeShortText(params.childName, 60) : undefined,
    deviceId: params.deviceId,
    severity: params.severity || 'info',
    title: {
      ar: redactSensitiveText(params.title.ar),
      en: redactSensitiveText(params.title.en),
    },
    description: {
      ar: redactSensitiveText(params.description.ar),
      en: redactSensitiveText(params.description.en),
    },
    metadata: safeMeta,
    ip: params.ip,
    createdAt: nowIso,
  };

  db.familyAuditEvents!.unshift(evt);
  if (db.familyAuditEvents!.length > 2500) {
    db.familyAuditEvents!.length = 2500;
  }

  appendSecurityLog(db.securityLogs, {
    eventType: params.securityEventType || 'PARENT_SETTING_CHANGE',
    familyId: params.familyId,
    actorId: params.actorId,
    role: params.actorRole as UserRole | undefined,
    ip: params.ip,
    summary: `[${params.familyId}] ${evt.description.en}`,
  });

  return evt;
}

export function awardGardenMilestoneIdempotent(
  db: ServerDb,
  child: StoredChildRecord,
  params: {
    milestoneKey: string;
    preferredItemId?: string;
    reason: LocalizedText;
  },
): { awarded: boolean; unlockedItemId?: string; event?: GardenRewardEvent } {
  ensureFamilyCollections(db);
  ensureChildFamilyAndGarden(db, child);
  const garden = sanitizeLearningGarden(child.learningGarden);
  const key = sanitizeShortText(params.milestoneKey, 80);

  const existingEvents = db.gardenRewardEvents![child.id] || [];
  if (garden.milestonesUnlocked.includes(key) || existingEvents.some((e) => e.milestoneKey === key)) {
    child.learningGarden = garden;
    return { awarded: false };
  }

  // Pick requested item if valid & not yet unlocked, otherwise pick next locked catalog item
  const validIds = new Set(GARDEN_ITEMS_CATALOG.map((i) => i.id));
  let itemToUnlock =
    params.preferredItemId && validIds.has(params.preferredItemId) && !garden.unlockedItemIds.includes(params.preferredItemId)
      ? params.preferredItemId
      : GARDEN_ITEMS_CATALOG.find((i) => !garden.unlockedItemIds.includes(i.id))?.id;

  garden.milestonesUnlocked.push(key);
  if (itemToUnlock) {
    garden.unlockedItemIds.push(itemToUnlock);
    const slotCount = garden.placements.length;
    garden.placements.push({
      instanceId: `g-${crypto.randomBytes(4).toString('hex')}`,
      itemId: itemToUnlock,
      x: 18 + ((slotCount * 17) % 68),
      y: 44 + ((slotCount * 13) % 38),
      growthStage: 1,
    });
  } else {
    // All catalog items unlocked: upgrade an existing plant growth stage positively
    if (garden.placements.length > 0) {
      const target = garden.placements[garden.placements.length % garden.placements.length];
      target.growthStage = Math.min(3, target.growthStage + 1) as 1 | 2 | 3;
      itemToUnlock = target.itemId;
    }
  }

  const nowIso = new Date().toISOString();
  const rewardEvent: GardenRewardEvent = {
    id: `grd_${crypto.randomBytes(4).toString('hex')}`,
    childId: child.id,
    milestoneKey: key,
    itemUnlockedId: itemToUnlock || 'garden-sun-flower',
    reason: params.reason,
    awardedAt: nowIso,
  };
  db.gardenRewardEvents![child.id] = [rewardEvent, ...existingEvents].slice(0, 80);
  child.learningGarden = garden;

  return {
    awarded: true,
    unlockedItemId: rewardEvent.itemUnlockedId,
    event: rewardEvent,
  };
}
