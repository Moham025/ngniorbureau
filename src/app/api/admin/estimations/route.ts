import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId')

  let query = supabaseAdmin
    .from('estimations')
    .select('*')
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data, total: data.length })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file) return NextResponse.json({ success: false, error: 'Fichier requis' }, { status: 400 })
    if (!file.name.endsWith('.json')) return NextResponse.json({ success: false, error: 'Seuls les fichiers JSON sont acceptés' }, { status: 400 })

    const text = await file.text()
    let jsonData: Record<string, unknown>
    try {
      jsonData = JSON.parse(text)
    } catch {
      return NextResponse.json({ success: false, error: 'Format JSON invalide' }, { status: 400 })
    }

    const blocs = Array.isArray(jsonData.blocs) ? jsonData.blocs : []
    const totalAmount = (jsonData.total_htva as number) || (jsonData.total as number) || 0

    const { data, error } = await supabaseAdmin
      .from('estimations')
      .upsert({
        project_id: projectId || null,
        file_name: file.name,
        total_amount: totalAmount,
        blocs_count: blocs.length,
        currency: 'XOF',
        blocs: blocs,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
