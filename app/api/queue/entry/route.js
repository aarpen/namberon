// app/api/queue/entry/route.js
import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Also fetch entries ahead
    const { data: ahead } = await supabase
      .from('queue_entries')
      .select('id, token_number, service_duration, status')
      .eq('shop_id', data.shop_id)
      .in('status', ['waiting', 'serving'])
      .lt('token_number', data.token_number)
      .order('token_number', { ascending: true })

    return NextResponse.json({ entry: data, ahead: ahead || [] }, { status: 200 })

  } catch (err) {
    console.error('Entry fetch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
