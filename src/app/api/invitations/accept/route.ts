import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { acceptInvitation } from '@/lib/invitations';

export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  const email = session.user?.email;
  if (!email) return NextResponse.json({ error: 'Account has no email' }, { status: 400 });

  const result = await acceptInvitation(token, session.user.id, email);
  if (!result.ok) {
    const status = result.reason === 'already_member' ? 409 : 400;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }
  return NextResponse.json(result);
}
