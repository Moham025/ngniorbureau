import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MISSING = 'does not exist'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('project_id')
  let query = supabaseAdmin
    .from('project_transactions')
    .select('*')
    .order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) {
    if (error.message.includes(MISSING)) return NextResponse.json({ success: true, data: [], tableNotFound: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data, total: data.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { project_id, project_name, project_custom_id, client_id, client_name, type, amount, date, notes } = body

    if (!project_id || !amount || parseFloat(String(amount)) <= 0) {
      return NextResponse.json({ success: false, error: 'project_id et amount requis' }, { status: 400 })
    }

    const now = new Date()
    const year2 = now.getFullYear().toString().slice(2)
    const ref = `VER-${year2}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

    const { data, error } = await supabaseAdmin
      .from('project_transactions')
      .insert({
        project_id,
        project_name: project_name ?? '',
        project_custom_id: project_custom_id ?? '',
        client_id: client_id ?? '',
        client_name: client_name ?? '',
        type: type ?? 'versement',
        reference: ref,
        amount: parseFloat(String(amount)),
        date: date ?? now.toISOString().slice(0, 10),
        notes: notes ?? '',
        status: 'completed',
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes(MISSING)) {
        return NextResponse.json({ success: false, error: 'TABLE_NOT_FOUND', tableNotFound: true }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
