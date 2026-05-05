import { NextRequest, NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { searchConversations } from '@/lib/conversationSearch';

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10), 50);
  const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10), 0);

  const data = await searchConversations({
    userId: session.user.id,
    query: q,
    limit,
    offset,
  });

  return NextResponse.json(data);
}