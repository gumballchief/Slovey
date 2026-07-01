import { NextResponse } from 'next/server';
import { db } from 'packages/db';
import { decisions } from 'packages/db/src/schema';
import { count } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.select({ count: count() }).from(decisions);
    const totalCount = result[0]?.count || 0;

    return NextResponse.json({ count: totalCount });
  } catch (error) {
    console.error('Failed to fetch decisions count:', error);
    return NextResponse.json({ error: 'Failed to fetch decisions count' }, { status: 500 });
  }
}
