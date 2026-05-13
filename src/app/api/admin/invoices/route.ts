import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

const TABLE_MISSING_MSG = "Could not find the table 'plans.documents'"

// Helper to get year in 2 digits
function getYear2(): string {
  return new Date().getFullYear().toString().slice(2)
}

// Generate sequential number for a document type in current year
async function generateDocNumber(type: string, clientCode?: string, projectCode?: string): Promise<string> {
  const year2 = getYear2()
  const code = clientCode ?? 'CL-XX-00'
  
  // Get all documents of this type to count
  const { data: existing } = await supabaseAdmin
    .from('documents')
    .select('number')
    .eq('type', type)
  
  // Format IDs based on type
  if (type === 'Facture Proforma') {
    // FPR-26-{client_code}-{seq} - global sequence
    const globalPrefix = `FPR-${year2}-`
    const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(globalPrefix)).length + 1
    const seq = String(yearSeq).padStart(2, '0')
    return `FPR-${year2}-${code}-${seq}`
  } else if (type === 'Facture' && projectCode) {
    // FAC-26-{project_code}-{seq} - global sequence
    const globalPrefix = `FAC-${year2}-`
    const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(globalPrefix)).length + 1
    const seq = String(yearSeq).padStart(2, '0')
    return `FAC-${year2}-${projectCode}-${seq}`
  } else if (type === 'Facture') {
    // FAC-26-{seq}
    const prefix = `FAC-${year2}-`
    const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(prefix)).length + 1
    const seq = String(yearSeq).padStart(2, '0')
    return `FAC-${year2}-${seq}`
  } else if (type === 'Devis') {
    const prefix = `DEV-${year2}-`
    const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(prefix)).length + 1
    const seq = String(yearSeq).padStart(2, '0')
    return `DEV-${year2}-${seq}`
  } else if (type === 'Reçu') {
    const prefix = `REC-${year2}-`
    const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(prefix)).length + 1
    const seq = String(yearSeq).padStart(2, '0')
    return `REC-${year2}-${seq}`
  }
  
  // Default: generic prefix
  const prefix = `${type.substring(0, 3).toUpperCase()}-${year2}-`
  const yearSeq = (existing ?? []).filter((d) => d.number?.startsWith(prefix)).length + 1
  const seq = String(yearSeq).padStart(2, '0')
  return `${type.substring(0, 3).toUpperCase()}-${year2}-${seq}`
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  const id = request.nextUrl.searchParams.get('id')

  // GET by ID - single document
  if (id) {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.message.includes(TABLE_MISSING_MSG) || error.message.includes('does not exist')) {
        return NextResponse.json({ success: true, data: null, tableNotFound: true })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  }

  // GET by type - list
  let query = supabaseAdmin.from('documents').select('*').order('created_at', { ascending: false })
  if (type && type !== 'Tout') query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    if (error.message.includes(TABLE_MISSING_MSG) || error.message.includes('does not exist')) {
      return NextResponse.json({ success: true, data: [], tableNotFound: true })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data, total: data.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type, number, client_name, client_email, client_phone, client_address,
      date, due_date, objet, items, tva_rate, total_ht, total_tva, total, notes, status,
      client_code, project_code, generate_number
    } = body

    // Debug log
    console.log('[POST /api/admin/invoices] Received:', { type, client_email, client_code, generate_number, hasNumber: !!number })

    // If generate_number is true, auto-generate the number based on type
    let finalNumber = number
    if (generate_number || !number) {
      // If client_code is not provided, try to fetch it from the database
      let finalClientCode = client_code
      if (!client_code && client_email) {
        try {
          const { data: { users } } = await supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 })
          console.log('[POST /api/admin/invoices] Total users fetched:', users?.length)
          const user = (users ?? []).find(u => u.email === client_email)
          console.log('[POST /api/admin/invoices] Found user:', user?.email, 'metadata:', user?.user_metadata)
          if (user?.user_metadata?.client_code) {
            finalClientCode = user.user_metadata.client_code as string
            console.log('[POST /api/admin/invoices] Found client_code from email:', finalClientCode)
          } else {
            // Fallback: generate a client code from the email if not found
            console.log('[POST /api/admin/invoices] No client_code in user metadata for:', client_email)
          }
        } catch (err) {
          console.error('[POST /api/admin/invoices] Error fetching users:', err)
        }
      }
      finalNumber = await generateDocNumber(type, finalClientCode, project_code)
      console.log('[POST /api/admin/invoices] Generated number:', finalNumber)
    }

    if (!finalNumber) {
      return NextResponse.json({ success: false, error: 'number est requis' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        type: type || 'Facture',
        number: finalNumber, client_name, client_email, client_phone, client_address,
        date, due_date, objet,
        items: items ?? [],
        tva_rate: tva_rate ?? '18 %',
        total_ht: total_ht ?? 0,
        total_tva: total_tva ?? 0,
        total: total ?? 0,
        notes, status: status || 'draft',
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes(TABLE_MISSING_MSG) || error.message.includes('does not exist')) {
        return NextResponse.json({ success: false, error: 'TABLE_NOT_FOUND', tableNotFound: true }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
