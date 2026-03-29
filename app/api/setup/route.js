// app/api/setup/route.js
// One-time shop creation
// Called from /setup page when owner registers their shop

import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { shop_name, city } = await req.json()

    if (!shop_name || shop_name.trim().length < 2) {
      return NextResponse.json({ error: 'Shop name is required' }, { status: 400 })
    }

    // Create the shop — Supabase auto-generates id and secret_id via defaults
    const { data, error } = await supabase
      .from('shops')
      .insert({
        shop_name: shop_name.trim(),
        city: city?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Setup error:', error)
      return NextResponse.json({ error: 'Could not create shop' }, { status: 500 })
    }

    // Return the shop id and secret_id
    // Frontend uses these to build the owner dashboard URL and the customer QR URL
    return NextResponse.json({
      shop_id: data.id,
      secret_id: data.secret_id,
      shop_name: data.shop_name,
      dashboard_url: `/dashboard/${data.secret_id}`,
      join_url: `/join?shop=${data.id}`,
    }, { status: 201 })

  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
