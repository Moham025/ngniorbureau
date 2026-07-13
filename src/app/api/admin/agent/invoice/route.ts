import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/admin/agent/invoice
 *
 * Lecture COMPLÈTE d'un document (facture, devis, reçu, facture proforma)
 * AVEC le détail des articles — ce que /agent/list ne renvoie pas.
 * Conçu pour l'agent IA (bot WhatsApp) qui doit lire/récapituler/copier
 * les lignes d'une facture existante.
 *
 * Query params (l'un des deux requis) :
 *   number=<FAC-26-... | DEV-26-... | R-26-... | FPR-26-...>   (insensible à la casse)
 *   id=<uuid>
 *
 * Response:
 *   {
 *     success: true,
 *     invoice: {
 *       id, number, type, status, date, due_date,
 *       client_name, client_email, client_phone, objet,
 *       tva_rate, total_ht, total_tva, total,
 *       items: [{ desc, qty, price, montant }]
 *     }
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const id = sp.get('id')?.trim()
    const number = sp.get('number')?.trim()

    if (!id && !number) {
      return NextResponse.json(
        { success: false, error: 'Fournir ?number=... ou ?id=...' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin.from('documents').select('*')
    query = id ? query.eq('id', id) : query.ilike('number', number as string)

    const { data, error } = await query.limit(1).maybeSingle()

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json(
          { success: false, error: 'Table plans.documents introuvable' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json(
        { success: false, error: `Document introuvable (${number ?? id})` },
        { status: 404 }
      )
    }

    // Normalise les articles pour l'agent : desc/qty/price + montant calculé
    const rawItems = Array.isArray(data.items) ? data.items : []
    const items = rawItems.map((it: { desc?: string; qty?: number; price?: number }) => {
      const qty = Number(it.qty ?? 1)
      const price = Number(it.price ?? 0)
      return { desc: it.desc ?? '', qty, price, montant: qty * price }
    })

    return NextResponse.json({
      success: true,
      invoice: {
        id: data.id,
        number: data.number,
        type: data.type,
        status: data.status,
        date: data.date,
        due_date: data.due_date,
        client_name: data.client_name,
        client_email: data.client_email,
        client_phone: data.client_phone,
        objet: data.objet,
        tva_rate: data.tva_rate,
        total_ht: data.total_ht,
        total_tva: data.total_tva,
        total: data.total,
        items,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
