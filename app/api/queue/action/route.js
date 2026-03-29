// app/api/queue/action/route.js
// Owner-only actions: next, skip
// Protected by secret_id in the request body

import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { shop_id, secret_id, action } = await req.json()

    // Validate
    if (!shop_id || !secret_id || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    if (!['next', 'skip'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Verify the secret_id matches this shop
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id')
      .eq('id', shop_id)
      .eq('secret_id', secret_id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find currently serving entry (if any) and mark it done/skipped
    const { data: serving } = await supabase
      .from('queue_entries')
      .select('id')
      .eq('shop_id', shop_id)
      .eq('status', 'serving')
      .single()

    if (serving) {
      const newStatus = action === 'next' ? 'done' : 'skipped'
      await supabase
        .from('queue_entries')
        .update({ status: newStatus })
        .eq('id', serving.id)
    }

    // Find the next waiting entry and mark it as serving
    const { data: nextEntry, error: nextError } = await supabase
      .from('queue_entries')
      .select('id, token_number, customer_name, service')
      .eq('shop_id', shop_id)
      .eq('status', 'waiting')
      .order('token_number', { ascending: true })
      .limit(1)
      .single()

    if (nextError || !nextEntry) {
      // No more entries in queue
      return NextResponse.json({ message: 'Queue is empty', next: null }, { status: 200 })
    }

    const { error: updateError } = await supabase
      .from('queue_entries')
      .update({ status: 'serving', called_at: new Date().toISOString() })
      .eq('id', nextEntry.id)

    if (updateError) {
      return NextResponse.json({ error: 'Could not update queue' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Success', next: nextEntry }, { status: 200 })

  } catch (err) {
    console.error('Action error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
