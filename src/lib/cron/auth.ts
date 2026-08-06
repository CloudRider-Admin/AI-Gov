/**
 * Authorization for scheduled (cron) endpoints.
 *
 * Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` when the
 * `CRON_SECRET` environment variable is configured on the project. We require a
 * match, so the endpoint can't be triggered by the public internet.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed: without a configured secret the endpoint is not callable.
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
