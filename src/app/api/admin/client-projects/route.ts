import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const MISSING = 'does not exist'

// Helper to get year in 2 digits
function getYear2(): string {
  return new Date().getFullYear().toString().slice(2)
}

// Generate invoice number for project
async function generateInvoiceNumber(projectCode: string, docType: string = 'Facture'): Promise<string> {
  const year2 = getYear2()
  const { data: existing } = await supabaseAdmin
    .from('documents')
    .select('number')
    .eq('type', docType)
  
  const prefixDict: Record<string, string> = {
    'Facture': 'FAC', 'Devis': 'DEV', 'Facture Proforma': 'FPR', 'Reçu': 'REC'
  }
  const p = prefixDict[docType] || 'DOC'
  const globalPrefix = `${p}-${year2}-`
  const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(globalPrefix)).length + 1
  const seq = String(yearSeq).padStart(2, '0')
  return `${globalPrefix}${projectCode}-${seq}`
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('client_id')
  let query = supabaseAdmin.from('client_projects').select('*').order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
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

    const year2 = getYear2()
    const code = client_code ?? 'CL-XX-00'

    // Count existing projects globally in the current year
    const { data: existing } = await supabaseAdmin
      .from('client_projects')
      .select('custom_id')

    const yearSeq = (existing ?? []).filter(
      (p) => p.custom_id && p.custom_id.startsWith(`P-${year2}-`)
    ).length + 1
    const seq = String(yearSeq).padStart(2, '0')

    // Format: P-26-CL-26-01-01
    const custom_id = `P-${year2}-${code}-${seq}`
    
    // Project code for invoice (without the P- prefix)
    const projectCode = `${code}-${seq}`

    // Handle invoice generation
    let finalInvoiceId = invoice_id || null
    
    if (generate_invoice && items && items.length > 0) {
      const docType = invoice_type || 'Facture'
      const invoiceNumber = await generateInvoiceNumber(projectCode, docType)
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
        const invoiceNumber = await generateInvoiceNumber(projectCode)
        
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
