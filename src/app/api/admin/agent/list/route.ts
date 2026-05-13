import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/agent/list
 *
 * Listing léger des documents (factures, devis, etc.) pour l'agent IA.
 * Optimisé pour la lecture machine : payload minimal, pas de HTML.
 *
 * Query params:
 *   type=Facture|Devis|Reçu|Facture Proforma   (optionnel)
 *   clientId=<uuid>                              (optionnel — filtre par client Supabase ID)
 *   clientEmail=<email>                          (optionnel — filtre par email client)
 *   limit=50                                     (optionnel, défaut 100)
 *
 * Response:
 *   {
 *     success: true,
 *     count: number,
 *     data: [{
 *       id, number, type, status, total,
 *       client_name, client_email,
 *       date, created_at,
 *       pdfUrl, previewUrl
 *     }]
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const sp          = request.nextUrl.searchParams
    const typeFilter  = sp.get('type')
    const clientEmail = sp.get('clientEmail')
    const limit       = Math.min(parseInt(sp.get('limit') || '100', 10), 500)

    const base = request.nextUrl.origin

    // ── Query ────────────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from('documents')
      .select('id, number, type, status, total, total_ht, tva_rate, client_name, client_email, client_phone, date, objet, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (typeFilter && typeFilter !== 'Tout') {
      query = query.eq('type', typeFilter)
    }

    if (clientEmail) {
      query = query.eq('client_email', clientEmail)
    }

    const { data, error } = await query

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'Table plans.documents introuvable' }, { status: 404 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // ── Enrichissement avec URLs ─────────────────────────────────────────────
    const enriched = (data ?? []).map((doc) => ({
      id:           doc.id,
      number:       doc.number,
      type:         doc.type,
      status:       doc.status,
      total:        doc.total,
      total_ht:     doc.total_ht,
      tva_rate:     doc.tva_rate,
      client_name:  doc.client_name,
      client_email: doc.client_email,
      client_phone: doc.client_phone,
      date:         doc.date,
      objet:        doc.objet,
      created_at:   doc.created_at,
      // URLs pratiques pour l'agent
      pdfUrl:       `${base}/api/admin/invoices/${doc.id}/pdf`,
      previewUrl:   `${base}/api/admin/invoices/${doc.id}/pdf?format=html`,
      printUrl:     `${base}/api/admin/invoices/${doc.id}/pdf?format=print`,
    }))

    return NextResponse.json({
      success: true,
      count:   enriched.length,
      data:    enriched,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Erreur serveur' },
      { status: 500 }
    )
  }
}
