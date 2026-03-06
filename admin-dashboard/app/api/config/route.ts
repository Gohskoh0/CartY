import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(req: NextRequest) {
  const updates: Record<string, string> = await req.json();
  const promises = Object.entries(updates).map(([key, value]) =>
    supabase.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  );
  await Promise.all(promises);
  return NextResponse.json({ ok: true });
}
