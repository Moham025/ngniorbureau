import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const key = decodeURIComponent(id).trim()
  const query = supabaseAdmin.from('project_transactions').select('*')
  const { data, error } = UUID_RE.test(key)
    ? await query.eq('id', key)
    : await query.ilike('reference', key)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, error: 'Versement introuvable' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: data.length === 1 ? data[0] : data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const key = decodeURIComponent(id).trim()

  // Retrouver la transaction par UUID ou par référence (VER-26-...)
  const query = supabaseAdmin
    .from('project_transactions')
    .select('id, reference, amount, date, project_id, project_custom_id, client_name')
  const { data, error } = UUID_RE.test(key)
    ? await query.eq('id', key)
    : await query.ilike('reference', key)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, error: 'Versement introuvable' }, { status: 404 })
  }
  if (data.length > 1) {
    return NextResponse.json(
      {
        success: false,
        error: 'Référence ambiguë — plusieurs versements correspondent. Utiliser l’UUID.',
        matches: data,
      },
      { status: 409 }
    )
  }

  const tx = data[0]
  const { error: delError } = await supabaseAdmin
    .from('project_transactions')
    .delete()
    .eq('id', tx.id)

  if (delError) return NextResponse.json({ success: false, error: delError.message }, { status: 500 })

  return NextResponse.json({ success: true, deleted: tx })
}
