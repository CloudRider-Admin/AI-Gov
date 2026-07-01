import { NextResponse } from 'next/server';
import { getOptionalSession } from '@/lib/auth-guard';
import { listUserDocuments } from '@/lib/userDocuments';

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const documents = await listUserDocuments(session.user.id);
  return NextResponse.json({ documents });
}
