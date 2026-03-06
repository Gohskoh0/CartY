import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data } = await supabase.from('app_config').select('key, value');
  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.key] = row.value;
  return NextResponse.json(config);
}
