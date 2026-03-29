// app/api/queue/join/route.js
import { supabase } from '@/lib/supabase'
import { SERVICES } from '@/lib/services'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { shop_id, customer_name, mobile, service } = await req.json()

    // Validate inputs
    if (!shop_id || !customer_name || !mobile || !service) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 })
    }

    if (!SERVICES[service]) {
      return NextResponse.json({ error: 'Invalid service' }, { status: 400 })
    }

    const svc = SERVICES[service]

    // Get next token number for this shop
    // We fetch the max token number and add 1
    const { data: lastToken, error: tokenError } = await supabase
      .from('queue_entries')
      .select('token_number')
      .eq('shop_id', shop_id)
      .order('token_number', { ascending: false })
      .limit(1)
      .single()

    // If no entries yet, start from 1
    const nextToken = tokenError ? 1 : (lastToken.token_number + 1)

    // Insert the new queue entry
    const { data, error } = await supabase
      .from('queue_entries')
      .insert({
        shop_id,
        token_number: nextToken,
        customer_name: customer_name.trim(),
        mobile,
        service,
        service_price: svc.price,
        service_duration: svc.duration,
        status: 'waiting',
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Could not join queue' }, { status: 500 })
    }

    return NextResponse.json({ entry: data }, { status: 201 })

  } catch (err) {
    console.error('Join queue error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
