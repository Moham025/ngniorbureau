import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = { ...(await request.json()) }

    // Si on modifie les articles, on recalcule les totaux côté serveur pour
    // garantir la cohérence (HT / TVA / TTC), en normalisant chaque ligne.
    if (Array.isArray(body.items)) {
      const items = body.items.map((it: { desc?: string; qty?: number; price?: number }) => ({
        desc: it.desc ?? '',
        qty: Number(it.qty ?? 1),
        price: Number(it.price ?? 0),
      }))

      // Taux TVA : celui fourni, sinon celui déjà enregistré sur le document
      let tvaRate: string = body.tva_rate
      if (!tvaRate) {
        const { data: existing } = await supabaseAdmin
          .from('documents')
          .select('tva_rate')
          .eq('id', id)
          .single()
        tvaRate = existing?.tva_rate ?? '18 %'
      }
      const tvaPct = (parseFloat(String(tvaRate).replace(/[^0-9.]/g, '')) || 0) / 100
      const totalHt = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0)
      const totalTva = Math.round(totalHt * tvaPct)

      body.items = items
      body.tva_rate = tvaRate
      body.total_ht = totalHt
      body.total_tva = totalTva
      body.total = Math.round(totalHt + totalTva)
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

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
  const { error } = await supabaseAdmin.from('documents').delete().eq('id', id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
