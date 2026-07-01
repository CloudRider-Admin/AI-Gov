import { randomBytes, createHash } from 'crypto';
import { Resend } from 'resend';
import { prisma } from './prisma';
import { writeAuditLog } from './audit';
import { INVITE_ROLES, type InviteRole } from './governanceEnums';

export { INVITE_ROLES };
export type { InviteRole };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

export interface CreateInvitationResult {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptUrl: string;
  emailed: boolean;
}

/** Create a pending invitation, email an accept link, and return it (for copy). */
export async function createInvitation(params: {
  organizationId: string;
  email: string;
  role: InviteRole;
  invitedById: string;
  orgName: string;
}): Promise<CreateInvitationResult> {
  const email = params.email.trim().toLowerCase();
  const rawToken = randomBytes(32).toString('hex');

  // Supersede any prior pending invite for the same email/org.
  await prisma.orgInvitation.updateMany({
    where: { organizationId: params.organizationId, email, status: 'pending' },
    data: { status: 'revoked' },
  });

  const invitation = await prisma.orgInvitation.create({
    data: {
      organizationId: params.organizationId,
      email,
      role: params.role,
      tokenHash: hashToken(rawToken),
      invitedById: params.invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const acceptUrl = `${baseUrl()}/invite/${rawToken}`;
  let emailed = false;

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@govsecure.ai',
        to: email,
        subject: `You've been invited to ${params.orgName} on GovSecure`,
        html: buildInviteHtml(params.orgName, acceptUrl),
      });
      emailed = !error;
      if (error) console.error('[invitations] Resend error:', error);
    } catch (err) {
      console.error('[invitations] Send failed:', err);
    }
  } else {
    console.log(`[dev] Org invite for ${email}:\n  ${acceptUrl}`);
  }

  writeAuditLog({
    actorId: params.invitedById,
    organizationId: params.organizationId,
    action: 'member.invited',
    entityType: 'organization',
    entityId: params.organizationId,
    summary: `Invited ${email} as ${params.role}`,
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptUrl,
    emailed,
  };
}

export async function listPendingInvitations(organizationId: string) {
  const rows = await prisma.orgInvitation.findMany({
    where: { organizationId, status: 'pending', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString() }));
}

export async function revokeInvitation(organizationId: string, invitationId: string) {
  const invite = await prisma.orgInvitation.findFirst({ where: { id: invitationId, organizationId } });
  if (!invite) return false;
  await prisma.orgInvitation.update({ where: { id: invitationId }, data: { status: 'revoked' } });
  return true;
}

export type AcceptResult =
  | { ok: true; organizationId: string; organizationName: string; role: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'email_mismatch' | 'already_member' };

/** Accept an invitation on behalf of the signed-in user. */
export async function acceptInvitation(
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<AcceptResult> {
  const invite = await prisma.orgInvitation.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!invite || invite.status !== 'pending') return { ok: false, reason: 'invalid' };
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.orgInvitation.update({ where: { id: invite.id }, data: { status: 'expired' } });
    return { ok: false, reason: 'expired' };
  }
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, reason: 'email_mismatch' };
  }

  const existing = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
  });
  if (existing) {
    await prisma.orgInvitation.update({ where: { id: invite.id }, data: { status: 'accepted' } });
    return { ok: false, reason: 'already_member' };
  }

  await prisma.$transaction([
    prisma.orgMember.create({
      data: { organizationId: invite.organizationId, userId, role: invite.role },
    }),
    prisma.orgInvitation.update({ where: { id: invite.id }, data: { status: 'accepted' } }),
  ]);

  const org = await prisma.organization.findUnique({
    where: { id: invite.organizationId },
    select: { name: true },
  });

  writeAuditLog({
    actorId: userId,
    organizationId: invite.organizationId,
    action: 'member.joined',
    entityType: 'organization',
    entityId: invite.organizationId,
    summary: `${userEmail} joined as ${invite.role}`,
  });

  return {
    ok: true,
    organizationId: invite.organizationId,
    organizationName: org?.name ?? 'the organization',
    role: invite.role,
  };
}

function buildInviteHtml(orgName: string, acceptUrl: string) {
  return `
    <div style="font-family:monospace;background:#0a0a0a;color:#e0e0e0;padding:32px;border-radius:8px;max-width:480px">
      <h2 style="color:#00ff88;margin-top:0">You're invited to ${orgName}</h2>
      <p>You've been invited to collaborate on AI governance in the <strong>${orgName}</strong> workspace on GovSecure.</p>
      <p><strong>This invitation expires in 7 days.</strong></p>
      <a href="${acceptUrl}"
         style="display:inline-block;background:#00ff88;color:#0a0a0a;padding:12px 24px;
                text-decoration:none;border-radius:4px;margin:16px 0;font-weight:bold">
        Accept invitation
      </a>
      <p style="color:#888;font-size:12px">If you didn't expect this, you can ignore this email.</p>
    </div>`;
}
