/**
 * Apply pending Prisma migrations during the build when a database is
 * configured. DATABASE_URL/DIRECT_URL are only set in the Vercel Production
 * environment, so preview builds and local builds without a database skip
 * this step instead of failing.
 */
const { execSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  console.log('[migrate-deploy] DATABASE_URL not set — skipping prisma migrate deploy.');
  process.exit(0);
}

/**
 * 20260730_governance_gates failed part-way through in production on
 * 2026-07-30: an earlier `prisma db push` had already created "entityKind", so
 * the migration aborted with 42701 and Prisma recorded it as failed. The
 * migration has since been rewritten to be idempotent, but `migrate deploy`
 * refuses to run at all (P3009) while a failed row remains in
 * _prisma_migrations, so every production deploy has been blocked since.
 *
 * Clearing that row lets the corrected migration re-apply. This is scoped to
 * the one known-bad migration: any other failure must stop the build.
 */
const BLOCKED_MIGRATION = '20260730_governance_gates';

function migrationStatus() {
  // `migrate status` exits non-zero whenever anything is pending or failed —
  // precisely the case we need to inspect — so read stdout off the error too.
  try {
    return execSync('npx prisma migrate status', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
}

try {
  const status = migrationStatus();
  if (status.includes(BLOCKED_MIGRATION) && /failed/i.test(status)) {
    console.log(`[migrate-deploy] ${BLOCKED_MIGRATION} is recorded as failed — rolling it back so the corrected version can re-apply.`);
    execSync(`npx prisma migrate resolve --rolled-back ${BLOCKED_MIGRATION}`, { stdio: 'inherit' });
  }
} catch (err) {
  console.warn(`[migrate-deploy] could not clear the failed migration: ${err.message}`);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
