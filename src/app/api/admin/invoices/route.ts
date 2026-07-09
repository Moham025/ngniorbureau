import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'
import { generateDocNumber } from '@/lib/id-generators'

const TABLE_MISSING_MSG = "Could not find the table 'plans.documents'"

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
    // (schéma officiel: FAC-26-1 / DEV-26-1 / R-26-1 / FacP-26-1 — voir lib/id-generators)
    let finalNumber = number
    if (generate_number || !number) {
      finalNumber = await generateDocNumber(type)
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
