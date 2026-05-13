import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, product_variants(*), product_images(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  return NextResponse.json({ success: true, data })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { variants, ...productFields } = body

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(productFields)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    if (variants !== undefined) {
      await supabaseAdmin.from('product_variants').delete().eq('product_id', id)
      if (variants.length > 0) {
        const rows = variants.map((v: { label: string; price_xof: number; stock: number }, i: number) => ({
          product_id: id,
          label: v.label,
          price_xof: v.price_xof,
          stock: v.stock,
          is_available: (v.stock ?? 0) > 0,
          position: i,
        }))
        await supabaseAdmin.from('product_variants').insert(rows)
      }
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
