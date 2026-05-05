import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getUserArtifacts } from '@/lib/artifacts';

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);

  const artifacts = await getUserArtifacts(session.user.id, type, limit);
  return NextResponse.json({ artifacts });
}