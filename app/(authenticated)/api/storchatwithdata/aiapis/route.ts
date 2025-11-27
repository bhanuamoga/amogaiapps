// app/api/aiapis/route.ts
import { NextResponse } from 'next/server';
import { getApiKey } from '@/app/(authenticated)/storchatwithdata/actions';

export async function GET() {
  const data = await getApiKey();
  return NextResponse.json(data);
}
