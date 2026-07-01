import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';
import {
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
  INVITE_ROLES,
  type InviteRole,
} from '@/lib/invitations';

async function requireManager(orgId: string, userId: string) {
  const membership = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) return null;
  return membership;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await requireManager(id, session.user.id))) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const invitations = await listPendingInvitations(id);
  return NextResponse.json({ invitations });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await requireManager(id, session.user.id))) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }
  const role: InviteRole = INVITE_ROLES.includes(body?.role) ? body.role : 'MEMBER';

  const org = await prisma.organization.findUnique({ where: { id }, select: { name: true } });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const invitation = await createInvitation({
    organizationId: id,
    email,
    role,
    invitedById: session.user.id,
    orgName: org.name,
  });
  return NextResponse.json({ invitation }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await requireManager(id, session.user.id))) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }
  const invitationId = request.nextUrl.searchParams.get('invitationId');
  if (!invitationId) return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });

  const ok = await revokeInvitation(id, invitationId);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
