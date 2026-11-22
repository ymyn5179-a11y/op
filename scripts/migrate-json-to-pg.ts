import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { count, eq } from 'drizzle-orm';
import { db, pool } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import type { ServerDb } from '../server/dbTypes.ts';
import { DEFAULT_LEARNING_GARDEN_STATE, sanitizeLearningGarden } from '../src/data/gardenCatalog.ts';

const SOURCE_JSON_PATH = path.resolve(process.cwd(), 'data/nonoland-server-db.json');
const DRIZZLE_DIR = path.resolve(process.cwd(), 'drizzle');
const MIGRATION_SQL_FILE = fs.existsSync(DRIZZLE_DIR)
  ? fs.readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql')).sort()[0] || '0000_clear_maddog.sql'
  : '0000_clear_maddog.sql';
const MIGRATION_SQL_PATH = path.resolve(DRIZZLE_DIR, MIGRATION_SQL_FILE);
const MIGRATION_VERSION = MIGRATION_SQL_FILE.replace(/\.sql$/, '');

async function getPgCounts() {
  const tables = [
    ['users', schema.users],
    ['families', schema.families],
    ['guardian_memberships', schema.guardianMemberships],
    ['guardian_invitations', schema.guardianInvitations],
    ['trusted_devices', schema.trustedDevices],
    ['sessions', schema.sessions],
    ['action_tokens', schema.actionTokens],
    ['parent_gate_credentials', schema.parentGateCredentials],
    ['children', schema.children],
    ['child_credentials', schema.childCredentials],
    ['archived_children', schema.archivedChildren],
    ['content_policies', schema.contentPolicies],
    ['privacy_settings', schema.privacySettings],
    ['privacy_consents', schema.privacyConsents],
    ['data_requests', schema.dataRequests],
    ['family_audit_events', schema.familyAuditEvents],
    ['security_logs', schema.securityLogs],
    ['ai_usage_records', schema.aiUsageRecords],
    ['ai_usage_daily', schema.aiUsageDaily],
    ['garden_reward_events', schema.gardenRewardEvents],
    ['custom_lessons', schema.customLessons],
    ['custom_questions', schema.customQuestions],
    ['checkout_sessions', schema.checkoutSessions],
    ['exam_attempts', schema.examAttempts],
    ['level1_attempts', schema.level1Attempts],
    ['level2_attempts', schema.level2Attempts],
    ['smart_assessment_sessions', schema.smartAssessmentSessions],
    ['certificates', schema.certificates],
    ['processed_sync_keys', schema.processedSyncKeys],
    ['classes', schema.classes],
    ['teacher_questions', schema.teacherQuestions],
    ['teacher_exams', schema.teacherExams],
    ['exam_assignments', schema.examAssignments],
    ['assigned_exam_attempts', schema.assignedExamAttempts],
    ['homeworks', schema.homeworks],
    ['homework_submissions', schema.homeworkSubmissions],
    ['homework_attachments', schema.homeworkAttachments],
    ['import_batches', schema.importBatches],
    ['app_configs', schema.appConfigs],
    ['schema_migrations', schema.schemaMigrations],
  ] as const;

  const out: Record<string, number> = {};
  for (const [name, table] of tables) {
    const res = await db.select({ value: count() }).from(table);
    out[name] = Number(res[0]?.value ?? 0);
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SOURCE_JSON_PATH)) {
    throw new Error(`Source JSON database not found at ${SOURCE_JSON_PATH}`);
  }

  console.log('=== PHASE A: Source JSON Audit ===');
  const rawJson = fs.readFileSync(SOURCE_JSON_PATH, 'utf-8');
  const source = JSON.parse(rawJson) as ServerDb;

  const usersArr = Object.values(source.users || {});
  const familiesArr = Object.values(source.families || {});
  const membershipsArr = Object.values(source.guardianMemberships || {});
  const invitationsArr = Object.values(source.guardianInvitations || {});
  const devicesArr = Object.values(source.trustedDevices || {});
  const sessionsArr = Object.values(source.sessions || {});
  const actionTokensArr = Object.values(source.actionTokens || {});
  const gateCredsArr = Object.values(source.parentGateCredentials || {});
  const childrenArr = Object.values(source.children || {});
  const childCredsArr = Object.values(source.childCredentials || {});
  const archivedChildrenArr = Object.values(source.archivedChildren || {});
  const contentPoliciesArr = Object.values(source.contentPolicies || {});
  const privacySettingsArr = Object.values(source.privacySettings || {});
  const privacyConsentsArr = Object.values(source.privacyConsents || {}).flat();
  const dataRequestsArr = Object.values(source.dataRequests || {}).flat();
  const familyAuditArr = source.familyAuditEvents || [];
  const securityLogsArr = source.securityLogs || [];
  const aiUsageRecordsArr = Object.values(source.aiUsageRecords || {}).flat();
  const aiUsageDailyEntries = Object.entries(source.aiUsageDaily || {});
  const gardenRewardArr = Object.values(source.gardenRewardEvents || {}).flat();
  const customLessonsArr = source.customLessons || [];
  const customQuestionsArr = source.customQuestions || [];
  const checkoutSessionsArr = Object.values(source.checkoutSessions || {});
  const examAttemptsArr = Object.values(source.examAttempts || {});
  const level1AttemptsArr = Object.values(source.level1Attempts || {});
  const level2AttemptsArr = Object.values(source.level2Attempts || {});
  const smartSessionsArr = Object.values(source.smartAssessmentSessions || {});
  const certificatesArr = Object.values(source.certificates || {});
  const processedSyncEntries = Object.entries(source.processedSyncKeys || {});
  const classesArr = Object.values(source.classes || {});
  const teacherQuestionsArr = Object.values(source.teacherQuestions || {});
  const teacherExamsArr = Object.values(source.teacherExams || {});
  const examAssignmentsArr = Object.values(source.examAssignments || {});
  const assignedExamAttemptsArr = Object.values(source.assignedExamAttempts || {});
  const homeworksArr = Object.values(source.homeworks || {});
  const homeworkSubmissionsArr = Object.values(source.homeworkSubmissions || {});
  const homeworkAttachmentsArr = Object.values(source.homeworkAttachments || {});
  const importBatchesArr = Object.values(source.importBatches || {});

  const expectedCounts: Record<string, number> = {
    users: usersArr.length,
    families: familiesArr.length,
    guardian_memberships: membershipsArr.length,
    guardian_invitations: invitationsArr.length,
    trusted_devices: devicesArr.length,
    sessions: sessionsArr.length,
    action_tokens: actionTokensArr.length,
    parent_gate_credentials: gateCredsArr.length,
    children: childrenArr.length,
    child_credentials: childCredsArr.length,
    archived_children: archivedChildrenArr.length,
    content_policies: contentPoliciesArr.length,
    privacy_settings: privacySettingsArr.length,
    privacy_consents: privacyConsentsArr.length,
    data_requests: dataRequestsArr.length,
    family_audit_events: familyAuditArr.length,
    security_logs: securityLogsArr.length,
    ai_usage_records: aiUsageRecordsArr.length,
    ai_usage_daily: aiUsageDailyEntries.length,
    garden_reward_events: gardenRewardArr.length,
    custom_lessons: customLessonsArr.length,
    custom_questions: customQuestionsArr.length,
    checkout_sessions: checkoutSessionsArr.length,
    exam_attempts: examAttemptsArr.length,
    level1_attempts: level1AttemptsArr.length,
    level2_attempts: level2AttemptsArr.length,
    smart_assessment_sessions: smartSessionsArr.length,
    certificates: certificatesArr.length,
    processed_sync_keys: processedSyncEntries.length,
    classes: classesArr.length,
    teacher_questions: teacherQuestionsArr.length,
    teacher_exams: teacherExamsArr.length,
    exam_assignments: examAssignmentsArr.length,
    assigned_exam_attempts: assignedExamAttemptsArr.length,
    homeworks: homeworksArr.length,
    homework_submissions: homeworkSubmissionsArr.length,
    homework_attachments: homeworkAttachmentsArr.length,
    import_batches: importBatchesArr.length,
    app_configs: 4,
  };

  console.log('Source counts:', JSON.stringify(expectedCounts));

  console.log('=== PHASE B: Pre-Migration PostgreSQL State ===');
  const beforeCounts = await getPgCounts();
  console.log('PG counts before:', JSON.stringify(beforeCounts));

  console.log('=== PHASE C: Dependency-Ordered Transactional Import ===');
  const nowIso = new Date().toISOString();
  const migrationChecksum = fs.existsSync(MIGRATION_SQL_PATH)
    ? crypto.createHash('sha256').update(fs.readFileSync(MIGRATION_SQL_PATH, 'utf-8')).digest('hex')
    : 'initial';

  await db.transaction(async (tx) => {
    // 1. Insert users with familyId initially null to break circular FK cleanly
    if (usersArr.length > 0) {
      await tx
        .insert(schema.users)
        .values(
          usersArr.map((u) => ({
            id: u.id,
            email: u.email,
            normalizedEmail: u.normalizedEmail,
            displayName: u.displayName,
            passwordHash: u.passwordHash,
            role: u.role,
            emailVerified: Boolean(u.emailVerified),
            status: u.status,
            phone: u.phone ?? null,
            bio: u.bio ?? null,
            linkedChildId: u.linkedChildId ?? null,
            familyId: null,
            teacherProfile: u.teacherProfile ?? null,
            policyVersion: u.policyVersion || '2026.04',
            termsAcceptedAt: u.termsAcceptedAt || u.createdAt || nowIso,
            failedLoginAttempts: Number(u.failedLoginAttempts || 0),
            lockedUntil: u.lockedUntil ?? null,
            createdAt: u.createdAt || nowIso,
            updatedAt: u.updatedAt || u.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    // 2. Insert families
    if (familiesArr.length > 0) {
      await tx
        .insert(schema.families)
        .values(
          familiesArr.map((f) => ({
            id: f.id,
            name: f.name,
            primaryGuardianId: f.primaryGuardianId,
            createdAt: f.createdAt || nowIso,
            updatedAt: f.updatedAt || f.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    // 3. Re-link users.familyId now that families exist
    for (const u of usersArr) {
      if (u.familyId) {
        await tx
          .update(schema.users)
          .set({ familyId: u.familyId })
          .where(eq(schema.users.id, u.id));
      }
    }

    // 4. Guardian memberships, invitations, trusted devices, gate credentials
    if (membershipsArr.length > 0) {
      await tx
        .insert(schema.guardianMemberships)
        .values(
          membershipsArr.map((m) => ({
            id: m.id,
            familyId: m.familyId,
            userId: m.userId,
            displayName: m.displayName,
            email: m.email,
            role: m.role,
            permissions: m.permissions || [],
            status: m.status,
            invitedByUserId: m.invitedByUserId ?? null,
            createdAt: m.createdAt || nowIso,
            updatedAt: m.updatedAt || m.createdAt || nowIso,
            revokedAt: m.revokedAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (invitationsArr.length > 0) {
      await tx
        .insert(schema.guardianInvitations)
        .values(
          invitationsArr.map((inv) => ({
            id: inv.id,
            familyId: inv.familyId,
            email: inv.email,
            role: inv.role,
            permissions: inv.permissions || [],
            invitedByUserId: inv.invitedByUserId,
            invitedByName: inv.invitedByName,
            status: inv.status,
            tokenHash: inv.tokenHash,
            createdAt: inv.createdAt || nowIso,
            expiresAt: inv.expiresAt,
            acceptedAt: inv.acceptedAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (devicesArr.length > 0) {
      await tx
        .insert(schema.trustedDevices)
        .values(
          devicesArr.map((d) => ({
            id: d.id,
            familyId: d.familyId,
            userId: d.userId,
            tokenHash: d.tokenHash,
            deviceName: d.deviceName,
            deviceType: d.deviceType,
            browser: d.browser,
            os: d.os,
            userAgent: d.userAgent || '',
            ip: d.ip || '127.0.0.1',
            trusted: Boolean(d.trusted),
            revoked: Boolean(d.revoked),
            firstRegisteredAt: d.firstRegisteredAt || nowIso,
            lastActiveAt: d.lastActiveAt || nowIso,
            revokedAt: d.revokedAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (gateCredsArr.length > 0) {
      await tx
        .insert(schema.parentGateCredentials)
        .values(
          gateCredsArr.map((g) => ({
            userId: g.userId,
            familyId: g.familyId,
            pinHash: g.pinHash,
            failedAttempts: Number(g.failedAttempts || 0),
            lockedUntil: g.lockedUntil ?? null,
            createdAt: g.createdAt || nowIso,
            updatedAt: g.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    // 5. Sessions & action tokens
    if (sessionsArr.length > 0) {
      await tx
        .insert(schema.sessions)
        .values(
          sessionsArr.map((s) => ({
            tokenHash: s.tokenHash,
            userId: s.userId,
            csrfToken: s.csrfToken,
            createdAt: Number(s.createdAt),
            lastActiveAt: Number(s.lastActiveAt),
            expiresAt: Number(s.expiresAt),
            ip: s.ip || '127.0.0.1',
            userAgent: s.userAgent || '',
            sessionKind: s.sessionKind ?? null,
            childId: s.childId ?? null,
            familyId: s.familyId && source.families?.[s.familyId] ? s.familyId : null,
            deviceId: s.deviceId ?? null,
            rememberMe: Boolean(s.rememberMe),
            parentGateVerifiedUntil: s.parentGateVerifiedUntil ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (actionTokensArr.length > 0) {
      await tx
        .insert(schema.actionTokens)
        .values(
          actionTokensArr.map((t) => ({
            tokenHash: t.tokenHash,
            userId: t.userId,
            type: t.type,
            expiresAt: Number(t.expiresAt),
            used: Boolean(t.used),
          })),
        )
        .onConflictDoNothing();
    }

    // 6. Children & child credentials & archived children
    const userIds = new Set(usersArr.map((u) => u.id));
    if (childrenArr.length > 0) {
      await tx
        .insert(schema.children)
        .values(
          childrenArr.map((c) => {
            const famId = c.familyId || (source.users[c.parentId]?.familyId ?? null);
            return {
              id: c.id,
              parentId: c.parentId,
              familyId: famId,
              studentUserId: c.studentUserId && userIds.has(c.studentUserId) ? c.studentUserId : null,
              displayName: c.displayName,
              birthYear: Number(c.birthYear || 2023),
              birthMonth: Number(c.birthMonth || 1),
              ageMonths: c.ageMonths ?? null,
              ageGroup: c.ageGroup,
              language: c.language || 'ar',
              interests: c.interests || [],
              companionId: c.companionId || 'nono',
              companionScarfColor: c.companionScarfColor || '#FF9360',
              stars: Math.max(0, Number(c.stars || 0)),
              level: Math.max(1, Number(c.level || 1)),
              completedBaseline: Boolean(c.completedBaseline),
              favoriteWorldId: c.favoriteWorldId ?? null,
              recentActivityId: c.recentActivityId ?? null,
              unlockedWorlds: c.unlockedWorlds || [],
              completedActivityIds: c.completedActivityIds || [],
              unlockedCharacters: c.unlockedCharacters || [],
              unlockedBadges: c.unlockedBadges || [],
              unlockedRoomItems: c.unlockedRoomItems || [],
              placedRoomItems: c.placedRoomItems || [],
              savedDrawings: c.savedDrawings || [],
              certificates: c.certificates || [],
              skillProgress: c.skillProgress || ({} as any),
              conceptMastery: c.conceptMastery ?? null,
              level1Progress: c.level1Progress ?? null,
              level2Progress: c.level2Progress ?? null,
              level2Unlocked: Boolean(c.level2Unlocked),
              completedDeepLessons: c.completedDeepLessons ?? null,
              examHistory: c.examHistory ?? null,
              characterOutfits: c.characterOutfits ?? null,
              unlockedFunRewards: c.unlockedFunRewards ?? null,
              attempts: c.attempts || [],
              assessmentHistory: c.assessmentHistory || [],
              completedStoryIds: c.completedStoryIds || [],
              completedMissionsToday: c.completedMissionsToday || [],
              totalLearningMinutes: Number(c.totalLearningMinutes || 0),
              downloadedWorldIds: c.downloadedWorldIds || [],
              avatarConfig: c.avatarConfig ?? null,
              roomConfig: c.roomConfig ?? null,
              petState: c.petState ?? null,
              completedLabIds: c.completedLabIds ?? null,
              labHistory: c.labHistory ?? null,
              customStories: c.customStories ?? null,
              creativeProjects: c.creativeProjects ?? null,
              ownedShopItemIds: c.ownedShopItemIds ?? null,
              rewardTransactions: c.rewardTransactions ?? null,
              claimedMissionsDate: c.claimedMissionsDate ?? null,
              claimedMissionIdsToday: c.claimedMissionIdsToday ?? null,
              learningStreakDays: Number(c.learningStreakDays || 0),
              activeDaysHistory: c.activeDaysHistory ?? null,
              monthlySnapshots: c.monthlySnapshots ?? null,
              parentSchedule: c.parentSchedule ?? null,
              nextMonthPlan: c.nextMonthPlan ?? null,
              activityTimeline: c.activityTimeline ?? null,
              aiAssistantEnabled: c.aiAssistantEnabled ?? true,
              readingStageProgress: c.readingStageProgress ?? null,
              familyActivitiesCompleted: c.familyActivitiesCompleted ?? null,
              musicCompositions: c.musicCompositions ?? null,
              buildConstructions: c.buildConstructions ?? null,
              completedDiscoveryThemes: c.completedDiscoveryThemes ?? null,
              completedRecipes: c.completedRecipes ?? null,
              completedTheaterScenes: c.completedTheaterScenes ?? null,
              learningGarden: sanitizeLearningGarden(c.learningGarden || DEFAULT_LEARNING_GARDEN_STATE),
              createdAt: nowIso,
              updatedAt: nowIso,
            };
          }),
        )
        .onConflictDoNothing();
    }

    if (childCredsArr.length > 0) {
      await tx
        .insert(schema.childCredentials)
        .values(
          childCredsArr.map((cc) => ({
            childId: cc.childId,
            familyId: cc.familyId,
            accessCodeHash: cc.accessCodeHash,
            accessCodeEncrypted: cc.accessCodeEncrypted,
            accessCodeLast4: cc.accessCodeLast4,
            pinHash: cc.pinHash,
            failedAttempts: Number(cc.failedAttempts || 0),
            lockedUntil: cc.lockedUntil ?? null,
            createdAt: cc.createdAt || nowIso,
            updatedAt: cc.updatedAt || nowIso,
            rotatedAt: cc.rotatedAt ?? null,
            lastLoginAt: cc.lastLoginAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (archivedChildrenArr.length > 0) {
      await tx
        .insert(schema.archivedChildren)
        .values(
          archivedChildrenArr.map((ac) => ({
            childId: ac.childId,
            familyId: ac.familyId,
            parentId: ac.parentId,
            displayName: ac.displayName,
            deletedByUserId: ac.deletedByUserId,
            deletedAt: ac.deletedAt,
            reason: ac.reason ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    // 7. Policies, privacy settings, consents, data requests, audit/security logs
    if (contentPoliciesArr.length > 0) {
      await tx
        .insert(schema.contentPolicies)
        .values(
          contentPoliciesArr.map((cp) => ({
            familyId: cp.familyId,
            allowStories: Boolean(cp.allowStories),
            allowSongsAudio: Boolean(cp.allowSongsAudio),
            allowVideos: Boolean(cp.allowVideos),
            allowGamesCreative: Boolean(cp.allowGamesCreative),
            aiCompanionEnabled: Boolean(cp.aiCompanionEnabled),
            voiceInteractionEnabled: Boolean(cp.voiceInteractionEnabled),
            ageStrictMode: Boolean(cp.ageStrictMode),
            allowExternalContent: Boolean(cp.allowExternalContent),
            allowedStoryCategories: cp.allowedStoryCategories || [],
            blockedVideoIds: cp.blockedVideoIds || [],
            allowedVideoIds: cp.allowedVideoIds || [],
            updatedAt: cp.updatedAt || nowIso,
            updatedBy: cp.updatedBy ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (privacySettingsArr.length > 0) {
      await tx
        .insert(schema.privacySettings)
        .values(
          privacySettingsArr.map((ps) => ({
            familyId: ps.familyId,
            childProfileVisibility: ps.childProfileVisibility || 'private',
            aiFeaturesConsent: Boolean(ps.aiFeaturesConsent),
            voiceInteractionConsent: Boolean(ps.voiceInteractionConsent),
            analyticsConsent: Boolean(ps.analyticsConsent),
            essentialTermsConsent: Boolean(ps.essentialTermsConsent),
            policyVersion: ps.policyVersion || '2026.04',
            updatedAt: ps.updatedAt || nowIso,
            updatedBy: ps.updatedBy ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (privacyConsentsArr.length > 0) {
      await tx
        .insert(schema.privacyConsents)
        .values(
          privacyConsentsArr.map((pc) => ({
            id: pc.id,
            familyId: pc.familyId,
            consentKey: pc.consentKey,
            granted: Boolean(pc.granted),
            policyVersion: pc.policyVersion || '2026.04',
            grantedByUserId: pc.grantedByUserId,
            grantedByName: pc.grantedByName,
            grantedAt: pc.grantedAt || nowIso,
            withdrawnAt: pc.withdrawnAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (dataRequestsArr.length > 0) {
      await tx
        .insert(schema.dataRequests)
        .values(
          dataRequestsArr.map((dr) => ({
            id: dr.id,
            familyId: dr.familyId,
            type: dr.type,
            status: dr.status,
            requestedByUserId: dr.requestedByUserId,
            requestedByName: dr.requestedByName,
            note: dr.note ?? null,
            requestedAt: dr.requestedAt || nowIso,
            completedAt: dr.completedAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (familyAuditArr.length > 0) {
      await tx
        .insert(schema.familyAuditEvents)
        .values(
          familyAuditArr.map((ev) => ({
            id: ev.id,
            familyId: ev.familyId,
            category: ev.category,
            actionType: ev.actionType,
            actorId: ev.actorId ?? null,
            actorName: ev.actorName ?? null,
            actorRole: ev.actorRole ?? null,
            childId: ev.childId ?? null,
            childName: ev.childName ?? null,
            deviceId: ev.deviceId ?? null,
            severity: ev.severity ?? null,
            title: ev.title,
            description: ev.description,
            metadata: ev.metadata ?? null,
            ip: ev.ip ?? null,
            createdAt: ev.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (securityLogsArr.length > 0) {
      // Batch in chunks of 200 to stay well below parameter limit
      for (let i = 0; i < securityLogsArr.length; i += 200) {
        const chunk = securityLogsArr.slice(i, i + 200);
        await tx
          .insert(schema.securityLogs)
          .values(
            chunk.map((sl) => ({
              id: sl.id,
              eventType: sl.eventType,
              familyId: sl.familyId ?? null,
              actorId: sl.actorId ?? null,
              actorRole: sl.actorRole ?? null,
              role: sl.role ?? null,
              actionType: sl.actionType ?? null,
              recordType: sl.recordType ?? null,
              recordId: sl.recordId ?? null,
              previousValue: sl.previousValue ?? null,
              newValue: sl.newValue ?? null,
              reason: sl.reason ?? null,
              outcome: sl.outcome ?? null,
              ip: sl.ip ?? null,
              summary: sl.summary,
              createdAt: sl.createdAt || nowIso,
            })),
          )
          .onConflictDoNothing();
      }
    }

    // 8. AI Usage & Garden Rewards
    if (aiUsageRecordsArr.length > 0) {
      await tx
        .insert(schema.aiUsageRecords)
        .values(
          aiUsageRecordsArr.map((a) => ({
            id: a.id,
            childId: a.childId,
            familyId: a.familyId ?? null,
            actorId: a.actorId ?? null,
            mode: a.mode,
            language: a.language,
            topic: a.topic ?? null,
            blocked: Boolean(a.blocked),
            voiceUsed: Boolean(a.voiceUsed),
            createdAt: a.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (aiUsageDailyEntries.length > 0) {
      await tx
        .insert(schema.aiUsageDaily)
        .values(
          aiUsageDailyEntries.map(([usageKey, cnt]) => ({
            usageKey,
            count: Number(cnt || 0),
            updatedAt: nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (gardenRewardArr.length > 0) {
      await tx
        .insert(schema.gardenRewardEvents)
        .values(
          gardenRewardArr.map((gr) => ({
            id: gr.id,
            childId: gr.childId,
            milestoneKey: gr.milestoneKey,
            itemUnlockedId: gr.itemUnlockedId,
            reason: gr.reason,
            awardedAt: gr.awardedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    // 9. CMS Lessons & Questions
    if (customLessonsArr.length > 0) {
      await tx
        .insert(schema.customLessons)
        .values(
          customLessonsArr.map((cl) => ({
            id: cl.id,
            domain: cl.domain,
            title: cl.title,
            summary: cl.summary,
            ageGroups: cl.ageGroups,
            recommendedAgeRange: cl.recommendedAgeRange ?? null,
            targetSymbol: cl.targetSymbol,
            colorHex: cl.colorHex ?? null,
            imageUrl: cl.imageUrl ?? null,
            audioUrl: cl.audioUrl ?? null,
            examples: cl.examples || [],
            level: cl.level ?? null,
            subject: cl.subject ?? null,
            published: Boolean(cl.published),
            updatedAt: cl.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (customQuestionsArr.length > 0) {
      await tx
        .insert(schema.customQuestions)
        .values(
          customQuestionsArr.map((cq) => ({
            id: cq.id,
            subject: cq.subject,
            ageGroups: cq.ageGroups,
            recommendedAgeRange: cq.recommendedAgeRange ?? null,
            type: cq.type,
            difficulty: Number(cq.difficulty),
            lessonRefId: cq.lessonRefId,
            lessonTitle: cq.lessonTitle,
            prompt: cq.prompt,
            audioText: cq.audioText ?? null,
            audioLang: cq.audioLang ?? null,
            visualCue: cq.visualCue ?? null,
            options: cq.options,
            correctOptionId: cq.correctOptionId,
            explanation: cq.explanation,
            published: cq.published ?? true,
          })),
        )
        .onConflictDoNothing();
    }

    // 10. Attempts, Checkout, Certificates, Sync Keys
    if (checkoutSessionsArr.length > 0) {
      await tx
        .insert(schema.checkoutSessions)
        .values(
          checkoutSessionsArr.map((cs) => ({
            id: cs.id,
            childId: cs.childId,
            parentId: cs.parentId ?? null,
            subject: cs.subject,
            amountEgp: Number(cs.amountEgp),
            status: cs.status,
            paymentToken: cs.paymentToken ?? null,
            tokenConsumed: Boolean(cs.tokenConsumed),
            createdAt: cs.createdAt || nowIso,
            verifiedAt: cs.verifiedAt ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (examAttemptsArr.length > 0) {
      await tx
        .insert(schema.examAttempts)
        .values(
          examAttemptsArr.map((ea) => ({
            id: ea.id,
            childId: ea.childId,
            parentId: ea.parentId ?? null,
            childName: ea.childName,
            ageGroup: ea.ageGroup,
            subject: ea.subject,
            mode: ea.mode,
            questionIds: ea.questionIds,
            paymentVerified: Boolean(ea.paymentVerified),
            amountPaidEgp: Number(ea.amountPaidEgp),
            passingPercentage: Number(ea.passingPercentage),
            submitted: Boolean(ea.submitted),
            summary: ea.summary ?? null,
            certificateCode: ea.certificateCode ?? null,
            createdAt: ea.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (level1AttemptsArr.length > 0) {
      await tx
        .insert(schema.level1Attempts)
        .values(
          level1AttemptsArr.map((la) => ({
            id: la.id,
            childId: la.childId,
            parentId: la.parentId ?? null,
            lessonId: la.lessonId,
            questionIds: la.questionIds,
            submitted: Boolean(la.submitted),
            result: la.result ?? null,
            createdAt: la.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (level2AttemptsArr.length > 0) {
      await tx
        .insert(schema.level2Attempts)
        .values(
          level2AttemptsArr.map((la) => ({
            id: la.id,
            childId: la.childId,
            parentId: la.parentId ?? null,
            lessonId: la.lessonId,
            questionIds: la.questionIds,
            submitted: Boolean(la.submitted),
            result: la.result ?? null,
            createdAt: la.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (smartSessionsArr.length > 0) {
      await tx
        .insert(schema.smartAssessmentSessions)
        .values(
          smartSessionsArr.map((sa) => ({
            id: sa.id,
            childId: sa.childId,
            parentId: sa.parentId ?? null,
            ageGroup: sa.ageGroup,
            difficultyTier: sa.difficultyTier,
            totalQuestions: Number(sa.totalQuestions),
            askedQuestionIds: sa.askedQuestionIds || [],
            results: sa.results || [],
            streak: Number(sa.streak || 0),
            consecutiveMistakes: Number(sa.consecutiveMistakes || 0),
            hintsUsed: Number(sa.hintsUsed || 0),
            finished: Boolean(sa.finished),
            createdAt: sa.createdAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (certificatesArr.length > 0) {
      await tx
        .insert(schema.certificates)
        .values(
          certificatesArr.map((cert) => ({
            uniqueCode: cert.uniqueCode,
            id: cert.id,
            childName: cert.childName,
            worldId: cert.worldId,
            worldName: cert.worldName,
            achievementTitle: cert.achievementTitle,
            issuedAt: cert.issuedAt,
            levelCompleted: Number(cert.levelCompleted || 1),
            isOfficialExam: cert.isOfficialExam ?? null,
            examSubject: cert.examSubject ?? null,
            score: cert.score ?? null,
            totalQuestions: cert.totalQuestions ?? null,
            percentage: cert.percentage ?? null,
            passingPercentage: cert.passingPercentage ?? null,
            ageGroup: cert.ageGroup ?? null,
            verificationUrl: cert.verificationUrl ?? null,
            revoked: Boolean(cert.revoked),
          })),
        )
        .onConflictDoNothing();
    }

    if (processedSyncEntries.length > 0) {
      await tx
        .insert(schema.processedSyncKeys)
        .values(
          processedSyncEntries.map(([idempotencyKey, val]) => ({
            idempotencyKey,
            childId: val.childId,
            processedAt: val.processedAt,
            summary: val.summary,
          })),
        )
        .onConflictDoNothing();
    }

    // 11. Teacher Entities (Classes, Questions, Exams, Assignments, Attempts, Homeworks, Submissions, Attachments, Batches)
    if (classesArr.length > 0) {
      await tx
        .insert(schema.classes)
        .values(
          classesArr.map((cls) => ({
            id: cls.id,
            name: cls.name,
            subject: cls.subject,
            level: String(cls.level),
            description: cls.description ?? null,
            ageGroup: cls.ageGroup ?? null,
            recommendedAgeRange: cls.recommendedAgeRange ?? null,
            teacherId: cls.teacherId,
            studentIds: cls.studentIds || [],
            active: Boolean(cls.active),
            createdAt: cls.createdAt || nowIso,
            updatedAt: cls.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (teacherQuestionsArr.length > 0) {
      await tx
        .insert(schema.teacherQuestions)
        .values(
          teacherQuestionsArr.map((tq) => ({
            id: tq.id,
            teacherId: tq.teacherId,
            subject: tq.subject,
            level: Number(tq.level),
            lessonId: tq.lessonId,
            questionType: tq.questionType,
            promptAr: tq.promptAr,
            promptEn: tq.promptEn,
            imageUrl: tq.imageUrl ?? null,
            audioUrl: tq.audioUrl ?? null,
            audioText: tq.audioText ?? null,
            options: tq.options || [],
            correctOptionId: tq.correctOptionId ?? null,
            correctOptionIds: tq.correctOptionIds ?? null,
            allowMultipleCorrect: tq.allowMultipleCorrect ?? null,
            matchingPairs: tq.matchingPairs ?? null,
            correctOrder: tq.correctOrder ?? null,
            acceptedAnswers: tq.acceptedAnswers ?? null,
            marks: Number(tq.marks),
            difficulty: tq.difficulty,
            recommendedAgeRange: tq.recommendedAgeRange ?? null,
            explanation: tq.explanation,
            feedbackCorrect: tq.feedbackCorrect,
            feedbackIncorrect: tq.feedbackIncorrect,
            active: Boolean(tq.active),
            approvalStatus: tq.approvalStatus ?? null,
            adminFeedback: tq.adminFeedback ?? null,
            reviewedBy: tq.reviewedBy ?? null,
            reviewedAt: tq.reviewedAt ?? null,
            qualityFlags: tq.qualityFlags ?? null,
            version: Number(tq.version || 1),
            versions: tq.versions ?? null,
            createdAt: tq.createdAt || nowIso,
            updatedAt: tq.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (teacherExamsArr.length > 0) {
      await tx
        .insert(schema.teacherExams)
        .values(
          teacherExamsArr.map((te) => ({
            id: te.id,
            teacherId: te.teacherId,
            title: te.title,
            description: te.description,
            subject: te.subject,
            level: Number(te.level),
            ageGroup: te.ageGroup,
            recommendedAgeRange: te.recommendedAgeRange ?? null,
            lessonIds: te.lessonIds || [],
            questionIds: te.questionIds || [],
            questionSnapshots: te.questionSnapshots ?? null,
            totalQuestions: Number(te.totalQuestions),
            totalMarks: Number(te.totalMarks),
            passingPercentage: Number(te.passingPercentage),
            durationMinutes: Number(te.durationMinutes),
            startDate: te.startDate,
            endDate: te.endDate,
            allowedAttempts: Number(te.allowedAttempts),
            randomizeQuestions: Boolean(te.randomizeQuestions),
            randomizeAnswers: Boolean(te.randomizeAnswers),
            showResults: Boolean(te.showResults),
            showCorrectAnswers: Boolean(te.showCorrectAnswers),
            status: te.status,
            adminReviewNote: te.adminReviewNote ?? null,
            reviewedBy: te.reviewedBy ?? null,
            reviewedAt: te.reviewedAt ?? null,
            version: Number(te.version || 1),
            versions: te.versions ?? null,
            createdAt: te.createdAt || nowIso,
            updatedAt: te.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (examAssignmentsArr.length > 0) {
      await tx
        .insert(schema.examAssignments)
        .values(
          examAssignmentsArr.map((ea) => ({
            id: ea.id,
            examId: ea.examId,
            studentId: ea.studentId,
            teacherId: ea.teacherId,
            classId: ea.classId ?? null,
            assignedAt: ea.assignedAt,
            availableStartDate: ea.availableStartDate,
            deadline: ea.deadline,
            extendedDeadline: ea.extendedDeadline ?? null,
            status: ea.status,
          })),
        )
        .onConflictDoNothing();
    }

    if (assignedExamAttemptsArr.length > 0) {
      await tx
        .insert(schema.assignedExamAttempts)
        .values(
          assignedExamAttemptsArr.map((aa) => ({
            id: aa.id,
            assignmentId: aa.assignmentId,
            examId: aa.examId,
            studentId: aa.studentId,
            teacherId: aa.teacherId,
            attemptNumber: Number(aa.attemptNumber),
            questionIds: aa.questionIds || [],
            optionOrderMap: aa.optionOrderMap || {},
            answers: aa.answers || {},
            status: aa.status,
            score: aa.score ?? null,
            totalMarks: aa.totalMarks ?? null,
            percentage: aa.percentage ?? null,
            passed: aa.passed ?? null,
            startedAt: aa.startedAt,
            submittedAt: aa.submittedAt ?? null,
            review: aa.review ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (homeworksArr.length > 0) {
      await tx
        .insert(schema.homeworks)
        .values(
          homeworksArr.map((hw) => ({
            id: hw.id,
            teacherId: hw.teacherId,
            title: hw.title,
            instructions: hw.instructions,
            subject: hw.subject,
            level: Number(hw.level),
            recommendedAgeRange: hw.recommendedAgeRange ?? null,
            lessonIds: hw.lessonIds || [],
            homeworkType: hw.homeworkType,
            questionIds: hw.questionIds || [],
            questionSnapshots: hw.questionSnapshots ?? null,
            attachments: hw.attachments || [],
            assignedClassIds: hw.assignedClassIds || [],
            assignedStudentIds: hw.assignedStudentIds || [],
            startDate: hw.startDate,
            deadline: hw.deadline,
            maxAttempts: Number(hw.maxAttempts),
            passingPercentage: Number(hw.passingPercentage),
            status: hw.status,
            adminFeedback: hw.adminFeedback ?? null,
            reviewedBy: hw.reviewedBy ?? null,
            reviewedAt: hw.reviewedAt ?? null,
            version: Number(hw.version || 1),
            versions: hw.versions ?? null,
            createdAt: hw.createdAt || nowIso,
            updatedAt: hw.updatedAt || nowIso,
          })),
        )
        .onConflictDoNothing();
    }

    if (homeworkSubmissionsArr.length > 0) {
      await tx
        .insert(schema.homeworkSubmissions)
        .values(
          homeworkSubmissionsArr.map((hs) => ({
            id: hs.id,
            assignmentId: hs.assignmentId,
            homeworkVersion: Number(hs.homeworkVersion),
            studentId: hs.studentId,
            teacherId: hs.teacherId,
            openedAt: hs.openedAt ?? null,
            startedAt: hs.startedAt ?? null,
            submittedAt: hs.submittedAt ?? null,
            completedAt: hs.completedAt ?? null,
            attemptCount: Number(hs.attemptCount || 0),
            extendedDeadline: hs.extendedDeadline ?? null,
            extensionReason: hs.extensionReason ?? null,
            status: hs.status,
            answers: hs.answers || {},
            textResponse: hs.textResponse ?? null,
            score: hs.score ?? null,
            totalMarks: hs.totalMarks ?? null,
            percentage: hs.percentage ?? null,
            passed: hs.passed ?? null,
            teacherFeedback: hs.teacherFeedback ?? null,
            gradedAt: hs.gradedAt ?? null,
            review: hs.review ?? null,
          })),
        )
        .onConflictDoNothing();
    }

    if (homeworkAttachmentsArr.length > 0) {
      await tx
        .insert(schema.homeworkAttachments)
        .values(
          homeworkAttachmentsArr.map((ha) => ({
            id: ha.id,
            fileName: ha.fileName,
            mimeType: ha.mimeType,
            sizeBytes: Number(ha.sizeBytes),
            kind: ha.kind,
            url: ha.url,
            storedPath: ha.storedPath,
            uploadedBy: ha.uploadedBy,
            uploadedAt: ha.uploadedAt,
          })),
        )
        .onConflictDoNothing();
    }

    if (importBatchesArr.length > 0) {
      await tx
        .insert(schema.importBatches)
        .values(
          importBatchesArr.map((ib) => ({
            id: ib.id,
            teacherId: ib.teacherId,
            fileName: ib.fileName,
            format: ib.format,
            storedUploadPath: ib.storedUploadPath,
            validRows: ib.validRows || [],
            invalidRows: ib.invalidRows || [],
            committed: Boolean(ib.committed),
            createdAt: ib.createdAt || nowIso,
            expiresAt: Number(ib.expiresAt),
          })),
        )
        .onConflictDoNothing();
    }

    // 12. App Configs & Schema Migration History
    const configEntries: Array<{ key: string; value: unknown }> = [
      { key: 'examConfig', value: source.examConfig },
      { key: 'featureFlags', value: source.featureFlags },
      { key: 'level2ProgressionConfig', value: source.level2ProgressionConfig },
      { key: 'operationalMetrics', value: source.operationalMetrics },
    ];
    await tx
      .insert(schema.appConfigs)
      .values(configEntries.map((c) => ({ key: c.key, value: c.value as any, updatedAt: nowIso })))
      .onConflictDoNothing();

    await tx
      .insert(schema.schemaMigrations)
      .values({
        version: MIGRATION_VERSION,
        description: 'Initial normalized PostgreSQL schema + NonoLand JSON migration',
        checksum: migrationChecksum,
        appliedAt: nowIso,
      })
      .onConflictDoNothing();
  });

  console.log('=== PHASE D: Post-Migration Reconciliation ===');
  const afterCounts = await getPgCounts();
  let allMatch = true;
  const diffs: Array<{ table: string; expected: number; actual: number }> = [];
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const actual = afterCounts[table] ?? -1;
    if (actual < expected) {
      allMatch = false;
    }
    if (actual !== expected) {
      diffs.push({ table, expected, actual });
    }
  }
  console.log('PG counts after:', JSON.stringify(afterCounts));
  console.log('Reconciliation diffs:', JSON.stringify(diffs));

  // Sample spot checks
  const sampleUsers = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role }).from(schema.users).limit(3);
  const sampleChildren = await db.select({ id: schema.children.id, name: schema.children.displayName, familyId: schema.children.familyId }).from(schema.children).limit(3);
  console.log('Spot check users:', JSON.stringify(sampleUsers));
  console.log('Spot check children:', JSON.stringify(sampleChildren));

  if (!allMatch) {
    throw new Error(`Reconciliation mismatch detected: ${JSON.stringify(diffs)}`);
  }
  console.log('✅ MIGRATION & RECONCILIATION PASSED (100% source counts present in PostgreSQL)');
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
