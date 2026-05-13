import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')

  let query = supabaseAdmin
    .from('products')
    .select('*, product_variants(*), product_images(*)')
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data, total: data.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { variants, ...productFields } = body

    if (!productFields.name) return NextResponse.json({ success: false, error: 'name requis' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(productFields)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    if (variants && variants.length > 0) {
      const rows = variants.map((v: { label: string; price_xof: number; stock: number }, i: number) => ({
        product_id: data.id,
        label: v.label,
        price_xof: v.price_xof,
        stock: v.stock,
        is_available: (v.stock ?? 0) > 0,
        position: i,
      }))
      await supabaseAdmin.from('product_variants').insert(rows)
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
