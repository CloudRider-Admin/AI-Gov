import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { createIngestToken, listIngestTokens, revokeIngestToken } from '@/lib/gates/ingestTokens';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ tokens: await listIngestTokens(session.user.id) });
}

/** Mint a token. The plaintext is in this response and nowhere else, ever. */
export async function POST(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'A token name is required' }, { status: 400 });

  const token = await createIngestToken({ userId: session.user.id, name });
  return NextResponse.json({ token }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const revoked = await revokeIngestToken(session.user.id, id);
  if (!revoked) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
