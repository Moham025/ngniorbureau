import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data, error } = await supabaseAdmin
      .from('client_projects')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      if (error.message.includes('archived')) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          error: "Colonne 'archived' manquante. Lancer : ALTER TABLE plans.client_projects ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;",
        }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
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

  // Cascade : supprimer d'abord les versements liés (best effort — la table
  // peut ne pas exister). Évite des versements orphelins sans projet.
  await supabaseAdmin.from('project_transactions').delete().eq('project_id', id)

  const { error } = await supabaseAdmin.from('client_projects').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
