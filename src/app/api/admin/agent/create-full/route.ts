import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

/**
 * POST /api/admin/agent/create-full
 *
 * Crée un client, un projet ET une facture en une seule requête.
 * Conçu pour l'automation par agent IA — 0 clic navigateur requis.
 *
 * Body:
 *   client:  { full_name, phone?, email? }
 *   project: { type, designation }
 *   invoice: {
 *     type?:     "Facture" | "Devis" | "Facture Proforma" | "Reçu"
 *     items?:    [{ desc, qty, price }]
 *     tva_rate?: "0 %" | "10 %" | "18 %"
 *     notes?:    string
 *     due_date?: string
 *   }
 *
 * Response:
 *   { success, client, project, invoice, pdfUrl, previewUrl }
 */

import {
  generateClientCode,
  generateProjectId,
  generateDocNumber,
  findExistingClient,
} from '@/lib/id-generators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { client, project, invoice } = body as {
      client: { full_name: string; phone?: string; email?: string; code?: string }
      project: { type: string; designation: string }
      invoice?: {
        type?: string
        items?: { desc: string; qty: number; price: number }[]
        tva_rate?: string
        notes?: string
        due_date?: string
      }
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!client?.full_name && !client?.code) {
      return NextResponse.json({ success: false, error: 'client.full_name ou client.code est requis' }, { status: 400 })
    }
    if (!project?.type || !project?.designation) {
      return NextResponse.json({ success: false, error: 'project.type et project.designation sont requis' }, { status: 400 })
    }

    // ── 1. Client : RÉUTILISER s'il existe (par code ou nom exact), sinon créer ──
    let clientId: string
    let clientCode: string
    let clientName: string
    let clientEmail: string
    let clientPhone: string
    let clientReused = false

    const existingClient = await findExistingClient(client.code, client.full_name)

    if (existingClient) {
      clientId = existingClient.id
      clientCode = existingClient.code
      clientName = existingClient.name || client.full_name || ''
      clientEmail = existingClient.email
      clientPhone = existingClient.phone || client.phone || ''
      clientReused = true
    } else {
      clientCode = await generateClientCode()
      const fakeEmail = client.email || `${clientCode.toLowerCase()}@ngnior.local`

      const { data: newUserData, error: clientError } = await supabaseAuthAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        user_metadata: {
          full_name: client.full_name,
          phone: client.phone ?? '',
          client_code: clientCode,
        },
      })

      if (clientError) {
        return NextResponse.json(
          { success: false, step: 'client', error: `Erreur création client: ${clientError.message}` },
          { status: 500 }
        )
      }

      clientId = newUserData.user.id
      clientName = client.full_name
      clientEmail = client.email || fakeEmail
      clientPhone = client.phone || ''
    }

    // ── 2. ID projet : P-{code client}-{n° projet du client} ────────────────
    const customId    = await generateProjectId(clientCode)
    const projectCode = customId.slice(2) // sans le "P-"

    // ── 3. Calculer les totaux ───────────────────────────────────────────────
    const invoiceType = invoice?.type || 'Facture'
    const items       = invoice?.items || []
    const tvaRate     = invoice?.tva_rate || '18 %'
    const tvaPct      = parseFloat(tvaRate.replace(' %', '')) / 100

    const totalHt  = items.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0)
    const totalTva = Math.round(totalHt * tvaPct)
    const total    = Math.round(totalHt + totalTva)

    // ── 4. Créer la facture ─────────────────────────────────────────────────
    let invoiceData: any = null
    let docNumber = ''

    if (items.length > 0) {
      docNumber = await generateDocNumber(invoiceType)

      const { data: newInvoice, error: invoiceError } = await supabaseAdmin
        .from('documents')
        .insert({
          type:          invoiceType,
          number:        docNumber,
          client_name:   clientName,
          client_email:  clientEmail.endsWith('@ngnior.local') ? '' : clientEmail,
          client_phone:  clientPhone,
          client_address: '',
          date:          new Date().toISOString().slice(0, 10),
          due_date:      invoice?.due_date || '',
          objet:         project.designation,
          items:         items.map((item) => ({
            desc:  item.desc,
            qty:   item.qty || 1,
            price: item.price || 0,
          })),
          tva_rate:  tvaRate,
          total_ht:  totalHt,
          total_tva: totalTva,
          total,
          notes:  invoice?.notes || 'Paiement à la signature du contrat.\nMerci de votre confiance.',
          status: 'draft',
        })
        .select()
        .single()

      if (invoiceError) {
        console.warn('[agent/create-full] Erreur facture (non bloquant):', invoiceError.message)
      } else {
        invoiceData = newInvoice
      }
    }

    // ── 5. Créer le projet ──────────────────────────────────────────────────
    const { data: newProject, error: projError } = await supabaseAdmin
      .from('client_projects')
      .insert({
        custom_id:   customId,
        client_id:   clientId,
        client_code: clientCode,
        client_name: clientName,
        type:        project.type,
        designation: project.designation,
        invoice_id:  invoiceData?.id || null,
        date:        new Date().toISOString().slice(0, 10),
        status:      'actif',
      })
      .select()
      .single()

    if (projError) {
      return NextResponse.json(
        { success: false, step: 'project', error: `Erreur création projet: ${projError.message}` },
        { status: 500 }
      )
    }

    // ── 6. Réponse ──────────────────────────────────────────────────────────
    const baseUrl = request.nextUrl.origin
    return NextResponse.json({
      success: true,
      client: {
        id:    clientId,
        code:  clientCode,
        name:  clientName,
        email: clientEmail,
        phone: clientPhone,
        reused: clientReused,
      },
      project: newProject,
      invoice: invoiceData
        ? {
            id:     invoiceData.id,
            number: invoiceData.number,
            type:   invoiceData.type,
            total:  invoiceData.total,
            status: invoiceData.status,
          }
        : null,
      // URL directe pour récupérer le PDF (HTML print-ready)
      pdfUrl:     invoiceData ? `${baseUrl}/api/admin/invoices/${invoiceData.id}/pdf` : null,
      previewUrl: invoiceData ? `${baseUrl}/api/admin/invoices/${invoiceData.id}/pdf?format=html` : null,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Erreur serveur inattendue' },
      { status: 500 }
    )
  }
}
