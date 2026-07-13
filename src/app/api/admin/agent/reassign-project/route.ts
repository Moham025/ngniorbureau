import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'
import { findExistingClient, generateClientCode } from '@/lib/id-generators'

/**
 * POST /api/admin/agent/reassign-project
 *
 * Réaffecte un projet existant à un AUTRE client (nouveau ou existant), et met
 * à jour la facture liée pour refléter le nouveau client. Conçu pour l'agent IA
 * (bot WhatsApp) : "ce projet n'est pas M. X mais M. Y, enregistre Y et change".
 *
 * Le client est RÉUTILISÉ s'il existe (par code ou nom exact), sinon CRÉÉ.
 *
 * NB : la référence du projet (custom_id, ex: P-26-CL-26-01-06) n'est PAS
 * modifiée — elle reste stable pour ne pas casser les versements/reçus qui la
 * référencent. Seuls les champs client (et la facture liée) changent.
 *
 * Body:
 *   project_id?:        uuid du projet
 *   project_custom_id?: référence P-26-...  (l'un des deux requis)
 *   client: { code?, full_name, phone?, email? }
 *
 * Response:
 *   { success, project, client:{id,code,name,reused}, invoice_updated }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = (body.project_id || '').trim()
    const projectCustomId = (body.project_custom_id || '').trim()
    const client = body.client || {}

    if (!projectId && !projectCustomId) {
      return NextResponse.json(
        { success: false, error: 'project_id ou project_custom_id requis' },
        { status: 400 }
      )
    }
    if (!client.full_name && !client.code) {
      return NextResponse.json(
        { success: false, error: 'client.full_name ou client.code requis' },
        { status: 400 }
      )
    }

    // ── 1. Retrouver le projet (par id ou custom_id) ─────────────────────────
    let projQuery = supabaseAdmin.from('client_projects').select('*')
    projQuery = projectId
      ? projQuery.eq('id', projectId)
      : projQuery.ilike('custom_id', projectCustomId)
    const { data: project, error: projErr } = await projQuery.limit(1).maybeSingle()

    if (projErr) return NextResponse.json({ success: false, error: projErr.message }, { status: 500 })
    if (!project) {
      return NextResponse.json(
        { success: false, error: `Projet introuvable (${projectCustomId || projectId})` },
        { status: 404 }
      )
    }

    // ── 2. Trouver ou créer le client ────────────────────────────────────────
    const existing = await findExistingClient(client.code, client.full_name)
    let clientId: string
    let clientCode: string
    let clientName: string
    let clientEmail: string
    let clientPhone: string
    let reused = false

    if (existing) {
      clientId = existing.id
      clientCode = existing.code
      clientName = existing.name || client.full_name || ''
      clientEmail = existing.email
      clientPhone = existing.phone || client.phone || ''
      reused = true
    } else {
      clientCode = await generateClientCode()
      const fakeEmail = client.email || `${clientCode.toLowerCase()}@ngnior.local`
      const { data: created, error: cErr } = await supabaseAuthAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        user_metadata: { full_name: client.full_name, phone: client.phone ?? '', client_code: clientCode },
      })
      if (cErr || !created?.user) {
        return NextResponse.json(
          { success: false, step: 'client', error: `Création client: ${cErr?.message ?? '?'}` },
          { status: 500 }
        )
      }
      clientId = created.user.id
      clientName = client.full_name
      clientEmail = client.email || ''
      clientPhone = client.phone || ''
    }

    // ── 3. Mettre à jour le projet (client uniquement, custom_id conservé) ────
    const { data: updatedProject, error: upErr } = await supabaseAdmin
      .from('client_projects')
      .update({ client_id: clientId, client_code: clientCode, client_name: clientName })
      .eq('id', project.id)
      .select()
      .single()

    if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })

    // ── 4. Mettre à jour la facture liée (si présente) ───────────────────────
    let invoiceUpdated = false
    if (project.invoice_id) {
      const { error: docErr } = await supabaseAdmin
        .from('documents')
        .update({
          client_name: clientName,
          client_email: clientEmail.endsWith('@ngnior.local') ? '' : clientEmail,
          client_phone: clientPhone,
        })
        .eq('id', project.invoice_id)
      invoiceUpdated = !docErr
    }

    return NextResponse.json({
      success: true,
      project: { id: updatedProject.id, custom_id: updatedProject.custom_id, designation: updatedProject.designation },
      client: { id: clientId, code: clientCode, name: clientName, reused },
      invoice_updated: invoiceUpdated,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
