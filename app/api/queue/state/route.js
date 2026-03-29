// app/api/queue/state/route.js
// Returns full queue state for a shop
// Used on initial page load before real-time subscription kicks in

import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const shop_id = searchParams.get('shop_id')

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id required' }, { status: 400 })
    }

    // Fetch shop info
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, shop_name, city')
      .eq('id', shop_id)
      .single()

    if (shopError || !shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }

    // Fetch all active queue entries (waiting + serving) ordered by token
    const { data: queue, error: queueError } = await supabase
      .from('queue_entries')
      .select('id, token_number, customer_name, service, service_price, service_duration, status, joined_at, called_at')
      .eq('shop_id', shop_id)
      .in('status', ['waiting', 'serving'])
      .order('token_number', { ascending: true })

    if (queueError) {
      return NextResponse.json({ error: 'Could not fetch queue' }, { status: 500 })
    }

    // Calculate stats
    const serving = queue.find(e => e.status === 'serving') || null
    const waiting = queue.filter(e => e.status === 'waiting')

    // Total wait = sum of durations of all waiting entries + serving entry's remaining time
    // We approximate serving remaining as full duration (simple, good enough)
    const servingTimeLeft = serving ? serving.service_duration : 0
    const waitingTotalTime = waiting.reduce((sum, e) => sum + e.service_duration, 0)
    const totalWaitMinutes = servingTimeLeft + waitingTotalTime

    return NextResponse.json({
      shop,
      serving,
      waiting,
      totalWaitMinutes,
      waitingCount: waiting.length,
    }, { status: 200 })

  } catch (err) {
    console.error('State error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
