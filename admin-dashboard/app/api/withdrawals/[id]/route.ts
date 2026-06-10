import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type WithdrawalStatus = 'success' | 'failed';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as WithdrawalStatus;

  if (status !== 'success' && status !== 'failed') {
    return NextResponse.json({ error: 'status must be success or failed' }, { status: 400 });
  }

  const { data: withdrawal, error: fetchError } = await supabase
    .from('withdrawals')
    .select('id, store_id, amount, status')
    .eq('id', id)
    .single();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
  }
  if (withdrawal.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending withdrawals can be updated' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const note = body.note || (status === 'success' ? 'Paid manually by admin' : 'Failed by admin and refunded to wallet');

  const { data: updated, error: updateError } = await supabase
    .from('withdrawals')
    .update({ status, completed_at: now, admin_note: note })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, status')
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: 'Withdrawal could not be updated' }, { status: 409 });
  }

  if (status === 'failed') {
    const { data: store, error: storeFetchError } = await supabase
      .from('stores')
      .select('wallet_balance')
      .eq('id', withdrawal.store_id)
      .single();

    if (storeFetchError || !store) {
      await supabase.from('withdrawals').update({ status: 'pending', completed_at: null, admin_note: null }).eq('id', id);
      return NextResponse.json({ error: 'Seller wallet not found; withdrawal was not changed' }, { status: 500 });
    }

    const nextBalance = Number(store.wallet_balance ?? 0) + Number(withdrawal.amount ?? 0);
    const { error: refundError } = await supabase
      .from('stores')
      .update({ wallet_balance: nextBalance })
      .eq('id', withdrawal.store_id);

    if (refundError) {
      await supabase.from('withdrawals').update({ status: 'pending', completed_at: null, admin_note: null }).eq('id', id);
      return NextResponse.json({ error: 'Could not refund seller wallet; withdrawal was not changed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, status });
}
