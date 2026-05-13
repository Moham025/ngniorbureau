import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('projects')
    .select('id, slug, title, tier, description, price_fcfa, cover_url, is_active, created_at, category_id, categories(slug, label)')
    .order('created_at', { ascending: false })

  if (search) query = query.ilike('title', `%${search}%`)
  if (category) query = query.eq('category_id', category)
  if (status === 'Actif') query = query.eq('is_active', true)
  if (status === 'Brouillon') query = query.eq('is_active', false)

  const { data, error } = await query

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data, total: data.length })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, category_id, tier, price_fcfa, description } = body

    if (!title || !category_id || !tier) {
      return NextResponse.json({ success: false, error: 'title, category_id et tier sont requis' }, { status: 400 })
    }

    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({ title, slug, category_id, tier, price_fcfa: price_fcfa || 0, description: description || '', is_active: false })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
