import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/organizations/[id]/members — list members
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  // Verify user is a member of this org
  const membership = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: session.user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
  }

  const members = await prisma.orgMember.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      userId: true,
      role: true,
      joinedAt: true,
    },
    orderBy: { joinedAt: 'asc' },
  });

  // Fetch user details
  const userIds = members.map((m: { userId: string }) => m.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, image: true },
  });
  const userMap = new Map(users.map((u: { id: string; name: string | null; email: string | null; image: string | null }) => [u.id, u]));

  const enriched = members.map((m: { id: string; userId: string; role: string; joinedAt: Date }) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    user: userMap.get(m.userId) ?? { name: 'Unknown', email: 'unknown' },
  }));

  return NextResponse.json({ members: enriched });
}

/**
 * POST /api/organizations/[id]/members — add a member by email
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;

  // Verify user is an OWNER or ADMIN of this org
  const membership = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: session.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json();
  const parseResult = addMemberSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { email, role } = parseResult.data;

  // Find user by email
  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json(
      { error: 'No user found with this email address.' },
      { status: 404 },
    );
  }

  // Check if already a member
  const existingMember = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: targetUser.id } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: 'User is already a member of this organization.' },
      { status: 409 },
    );
  }

  const member = await prisma.orgMember.create({
    data: {
      organizationId: orgId,
      userId: targetUser.id,
      role,
    },
  });

  return NextResponse.json({
    id: member.id,
    userId: member.userId,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: { name: targetUser.name, email: targetUser.email },
  }, { status: 201 });
}

/**
 * DELETE /api/organizations/[id]/members — remove a member
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orgId } = await params;
  const memberId = request.nextUrl.searchParams.get('memberId');
  if (!memberId) {
    return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
  }

  // Verify user is an OWNER or ADMIN
  const membership = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId: session.user.id } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Cannot remove the OWNER
  const targetMember = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: orgId },
  });
  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }
  if (targetMember.role === 'OWNER') {
    return NextResponse.json({ error: 'Cannot remove the organization owner' }, { status: 400 });
  }

  await prisma.orgMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
