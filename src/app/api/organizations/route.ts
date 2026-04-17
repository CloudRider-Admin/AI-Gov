import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getOptionalSession } from '@/lib/auth-guard';

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

/**
 * GET /api/organizations — list organizations the user belongs to
 */
export async function GET() {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await prisma.orgMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const orgs = memberships.map((m: { organization: { id: string; name: string; slug: string; plan: string; _count: { members: number } }; role: string; joinedAt: Date }) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    plan: m.organization.plan,
    role: m.role,
    memberCount: m.organization._count.members,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return NextResponse.json({ organizations: orgs });
}

/**
 * POST /api/organizations — create a new organization
 */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only TEAM/ENTERPRISE/ADMIN users can create orgs
  const role = session.user.role ?? 'FREE';
  if (!['TEAM', 'ENTERPRISE', 'ADMIN'].includes(role)) {
    return NextResponse.json(
      { error: 'Organization features require a Team or Enterprise plan.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parseResult = createOrgSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { name, slug } = parseResult.data;

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: 'An organization with this slug already exists.' },
      { status: 409 },
    );
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      plan: role === 'ENTERPRISE' ? 'ENTERPRISE' : 'TEAM',
      members: {
        create: {
          userId: session.user.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    role: 'OWNER',
    memberCount: org._count.members,
  }, { status: 201 });
}
