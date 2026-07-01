import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { getAllPostures } from '@/lib/compliance';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const frameworks = await getAllPostures(session.user.id);
  return NextResponse.json({ frameworks });
}
