import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateDocNumber, generateProjectId } from '@/lib/id-generators'

const MISSING = 'does not exist'

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('client_id')
  // archived: absent/défaut = non archivés seulement ; 'all' = tout ; 'only' = archivés
  const archivedParam = request.nextUrl.searchParams.get('archived')

  const build = (withArchivedFilter: boolean) => {
    let q = supabaseAdmin.from('client_projects').select('*').order('created_at', { ascending: false })
    if (clientId) q = q.eq('client_id', clientId)
    if (withArchivedFilter) {
      if (archivedParam === 'only') q = q.eq('archived', true)
      else if (archivedParam !== 'all') q = q.not('archived', 'is', true)
    }
    return q
  }

  let { data, error } = await build(true)
  // Tolérance : si la colonne 'archived' n'existe pas encore, relancer sans le filtre
  if (error && error.message.includes('archived')) {
    ;({ data, error } = await build(false))
  }
  if (error) {
    if (error.message.includes(MISSING)) return NextResponse.json({ success: true, data: [], tableNotFound: true })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  
  // Fetch invoice totals for projects with invoice_id
  const invoiceIds = (data ?? []).map((p) => p.invoice_id).filter(Boolean)
  let invoiceTotals: Record<string, number> = {}
  
  if (invoiceIds.length > 0) {
    const { data: invoices } = await supabaseAdmin
      .from('documents')
      .select('id, total')
      .in('id', invoiceIds)
    
    for (const inv of invoices ?? []) {
      invoiceTotals[inv.id] = inv.total ?? 0
    }
  }
  
  // Add total to each project
  const projectsWithTotal = (data ?? []).map((p) => ({
    ...p,
    total: p.invoice_id ? (invoiceTotals[p.invoice_id] ?? 0) : 0,
  }))
  
  return NextResponse.json({ success: true, data: projectsWithTotal, total: projectsWithTotal.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      client_id, client_code, client_name, type, designation, invoice_id, date, proforma_id,
      generate_invoice, invoice_type, client_email, client_phone, client_address,
      items, tva_rate, total_ht, total_tva, total, notes
    } = body

    if (!client_id || !type || !designation) {
      return NextResponse.json({ success: false, error: 'client_id, type et designation requis' }, { status: 400 })
    }

    const code = client_code ?? 'CL-XX-00'

    // Schéma officiel: P-{code client}-{n° de projet DU client} (ex: P-CL-26-01-01)
    const custom_id = await generateProjectId(code)

    // Handle invoice generation
    let finalInvoiceId = invoice_id || null
    
    if (generate_invoice && items && items.length > 0) {
      const docType = invoice_type || 'Facture'
      const invoiceNumber = await generateDocNumber(docType)
      const { data: newInvoice, error: invoiceError } = await supabaseAdmin
        .from('documents')
        .insert({
          type: docType,
          number: invoiceNumber,
          client_name: client_name,
          client_email: client_email,
          client_phone: client_phone,
          client_address: client_address,
          date: date ?? new Date().toISOString().slice(0, 10),
          due_date: '',
          objet: designation,
          items: items,
          tva_rate: tva_rate ?? '18 %',
          total_ht: total_ht ?? 0,
          total_tva: total_tva ?? 0,
          total: total ?? 0,
          notes: notes ?? 'Paiement à la signature du contrat.\nMerci de votre confiance.',
          status: 'draft',
        })
        .select()
        .single()
      
      if (!invoiceError && newInvoice) {
        finalInvoiceId = newInvoice.id
      }
    } else if (proforma_id) {
      // Fetch the proforma invoice
      const { data: proforma, error: proformaError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', proforma_id)
        .single()
      
      if (!proformaError && proforma) {
        // Create a new invoice from the proforma
        const invoiceNumber = await generateDocNumber('Facture')
        
        const { data: newInvoice, error: invoiceError } = await supabaseAdmin
          .from('documents')
          .insert({
            type: 'Facture',
            number: invoiceNumber,
            client_name: proforma.client_name,
            client_email: proforma.client_email,
            client_phone: proforma.client_phone,
            client_address: proforma.client_address,
            date: new Date().toISOString().slice(0, 10),
            objet: proforma.objet,
            items: proforma.items,
            tva_rate: proforma.tva_rate,
            total_ht: proforma.total_ht,
            total_tva: proforma.total_tva,
            total: proforma.total,
            notes: proforma.notes,
            status: 'draft',
          })
          .select()
          .single()
        
        if (!invoiceError && newInvoice) {
          finalInvoiceId = newInvoice.id
          
          // Optionally delete the proforma or mark it as converted
          await supabaseAdmin
            .from('documents')
            .update({ status: 'converted' })
            .eq('id', proforma_id)
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('client_projects')
      .insert({
        custom_id,
        client_id,
        client_code: code,
        client_name: client_name ?? '',
        type,
        designation,
        invoice_id: finalInvoiceId,
        date: date ?? new Date().toISOString().slice(0, 10),
        status: 'actif',
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'TABLE_NOT_FOUND', tableNotFound: true }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message ?? 'Erreur serveur' }, { status: 500 })
  }
}
