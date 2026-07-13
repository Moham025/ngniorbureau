import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'
import {
  findExistingClient,
  generateClientCode,
  generateDocNumber,
  generateProjectId,
} from '@/lib/id-generators'

/**
 * POST /api/admin/agent/validate-proforma
 *
 * Valide une Facture Proforma : génère une FACTURE définitive (numéro FAC),
 * crée le PROJET lié à cette facture, et conserve un lien vers la proforma
 * (documents.source_proforma_id) pour pouvoir revenir en arrière. La proforma
 * d'origine est conservée et marquée status='converted'.
 *
 * Conçu pour l'agent IA (bot WhatsApp) ET les boutons "Valider" de l'UI.
 *
 * Body:
 *   proforma_id?:     uuid de la proforma
 *   proforma_number?: numéro FacP-26-... (l'un des deux requis)
 *   project_type:     "Plan Architectural" | ... | "Autre"  (requis)
 *   client?: { code?, full_name?, phone?, email? }  (défaut: infos de la proforma)
 *
 * Response:
 *   { success, facture:{id,number,total}, project:{id,custom_id}, client:{id,code,name,reused} }
 */
const MISSING_COL = 'source_proforma_id'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const proformaId = (body.proforma_id || '').trim()
    const proformaNumber = (body.proforma_number || '').trim()
    const projectType = (body.project_type || '').trim()
    const client = body.client || {}

    if (!proformaId && !proformaNumber) {
      return NextResponse.json(
        { success: false, error: 'proforma_id ou proforma_number requis' },
        { status: 400 }
      )
    }
    if (!projectType) {
      return NextResponse.json(
        { success: false, error: 'project_type requis (ex: "Plan Architectural", "Autre")' },
        { status: 400 }
      )
    }

    // ── 1. Charger la proforma ───────────────────────────────────────────────
    let pq = supabaseAdmin.from('documents').select('*')
    pq = proformaId ? pq.eq('id', proformaId) : pq.ilike('number', proformaNumber)
    const { data: proforma, error: pErr } = await pq.limit(1).maybeSingle()

    if (pErr) return NextResponse.json({ success: false, error: pErr.message }, { status: 500 })
    if (!proforma) {
      return NextResponse.json(
        { success: false, error: `Proforma introuvable (${proformaNumber || proformaId})` },
        { status: 404 }
      )
    }
    if (proforma.type !== 'Facture Proforma') {
      return NextResponse.json(
        { success: false, error: `Ce document est de type "${proforma.type}", pas une Facture Proforma.` },
        { status: 400 }
      )
    }
    if (proforma.status === 'converted') {
      return NextResponse.json(
        { success: false, error: 'Cette proforma a déjà été validée.' },
        { status: 409 }
      )
    }

    // Déjà validée ? (une facture pointe déjà vers cette proforma)
    const { data: already } = await supabaseAdmin
      .from('documents')
      .select('id, number')
      .eq('source_proforma_id', proforma.id)
      .limit(1)
      .maybeSingle()
    if (already) {
      return NextResponse.json(
        { success: false, error: `Proforma déjà validée (facture ${already.number}).` },
        { status: 409 }
      )
    }

    // ── 2. Trouver ou créer le client ────────────────────────────────────────
    const fullName = client.full_name || proforma.client_name || ''
    const phone = client.phone || proforma.client_phone || ''
    const existing = await findExistingClient(client.code, fullName)

    let clientId: string
    let clientCode: string
    let clientName: string
    let clientEmail: string
    let clientPhone: string
    let reused = false

    if (existing) {
      clientId = existing.id
      clientCode = existing.code
      clientName = existing.name || fullName
      clientEmail = existing.email
      clientPhone = existing.phone || phone
      reused = true
    } else {
      if (!fullName) {
        return NextResponse.json(
          { success: false, error: 'Nom du client introuvable (ni sur la proforma, ni fourni).' },
          { status: 400 }
        )
      }
      clientCode = await generateClientCode()
      const fakeEmail = client.email || proforma.client_email || `${clientCode.toLowerCase()}@ngnior.local`
      const { data: created, error: cErr } = await supabaseAuthAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone, client_code: clientCode },
      })
      if (cErr || !created?.user) {
        return NextResponse.json(
          { success: false, step: 'client', error: `Création client: ${cErr?.message ?? '?'}` },
          { status: 500 }
        )
      }
      clientId = created.user.id
      clientName = fullName
      clientEmail = client.email || proforma.client_email || ''
      clientPhone = phone
    }

    // ── 3. Créer la Facture définitive (liée à la proforma) ──────────────────
    const factureNumber = await generateDocNumber('Facture')
    const insertPayload: Record<string, unknown> = {
      type: 'Facture',
      number: factureNumber,
      client_name: clientName,
      client_email: clientEmail.endsWith('@ngnior.local') ? '' : clientEmail,
      client_phone: clientPhone,
      client_address: proforma.client_address ?? '',
      date: new Date().toISOString().slice(0, 10),
      due_date: proforma.due_date ?? '',
      objet: proforma.objet ?? '',
      items: proforma.items ?? [],
      tva_rate: proforma.tva_rate ?? '18 %',
      total_ht: proforma.total_ht ?? 0,
      total_tva: proforma.total_tva ?? 0,
      total: proforma.total ?? 0,
      notes: proforma.notes ?? '',
      status: 'draft',
      source_proforma_id: proforma.id,
    }

    let facture
    {
      const { data, error } = await supabaseAdmin
        .from('documents')
        .insert(insertPayload)
        .select()
        .single()
      if (error) {
        if (error.message.includes(MISSING_COL)) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Colonne source_proforma_id manquante. Lancer dans Supabase : ' +
                'ALTER TABLE plans.documents ADD COLUMN IF NOT EXISTS source_proforma_id uuid;',
              needsMigration: true,
            },
            { status: 400 }
          )
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      facture = data
    }

    // ── 4. Créer le projet lié à la facture ──────────────────────────────────
    const customId = await generateProjectId(clientCode)
    const { data: project, error: projErr } = await supabaseAdmin
      .from('client_projects')
      .insert({
        custom_id: customId,
        client_id: clientId,
        client_code: clientCode,
        client_name: clientName,
        type: projectType,
        designation: proforma.objet ?? '',
        invoice_id: facture.id,
        date: new Date().toISOString().slice(0, 10),
        status: 'actif',
      })
      .select()
      .single()

    if (projErr) return NextResponse.json({ success: false, step: 'project', error: projErr.message }, { status: 500 })

    // ── 5. Marquer la proforma convertie ─────────────────────────────────────
    await supabaseAdmin.from('documents').update({ status: 'converted' }).eq('id', proforma.id)

    return NextResponse.json({
      success: true,
      facture: { id: facture.id, number: facture.number, total: facture.total },
      project: { id: project.id, custom_id: project.custom_id },
      client: { id: clientId, code: clientCode, name: clientName, reused },
      proforma: { id: proforma.id, number: proforma.number },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
