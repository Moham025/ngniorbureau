import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase() ?? ''

  try {
    const { data: { users }, error } = await supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (error) throw error

    // Doc counts per email
    const { data: docRows } = await supabaseAdmin.from('documents').select('client_email')
    const docCountMap: Record<string, number> = {}
    for (const row of docRows ?? []) {
      if (row.client_email) docCountMap[row.client_email] = (docCountMap[row.client_email] ?? 0) + 1
    }

    // Client projects counts per user id
    const { data: projRows } = await supabaseAdmin.from('client_projects').select('client_id')
    const projCountMap: Record<string, number> = {}
    for (const row of projRows ?? []) {
      if (row.client_id) projCountMap[row.client_id] = (projCountMap[row.client_id] ?? 0) + 1
    }

    const mapped = users.map((u) => ({
      id: u.id,
      client_code: (u.user_metadata?.client_code ?? '') as string,
      email: u.email?.endsWith('@ngnior.local') ? '' : (u.email ?? ''),
      name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? '') as string,
      phone: (u.user_metadata?.phone ?? '') as string,
      plan: (u.app_metadata?.plan ?? 'gratuit') as string,
      confirmed: !!u.email_confirmed_at,
      created: u.created_at ? u.created_at.slice(0, 10) : '',
      last_sign_in: u.last_sign_in_at ? u.last_sign_in_at.slice(0, 10) : '',
      projects_count: projCountMap[u.id] ?? 0,
      docs_count: docCountMap[u.email ?? ''] ?? 0,
    }))

    const filtered = search
      ? mapped.filter((c) => c.name.toLowerCase().includes(search) || c.email.toLowerCase().includes(search) || (c.client_code && c.client_code.toLowerCase().includes(search)))
      : mapped

    return NextResponse.json({
      success: true,
      data: filtered,
      total: filtered.length,
      premium: filtered.filter((c) => c.plan === 'premium').length,
      free: filtered.filter((c) => c.plan !== 'premium').length,
      confirmed: filtered.filter((c) => c.confirmed).length,
    })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, phone, email } = body
    if (!full_name) return NextResponse.json({ success: false, error: 'Nom complet requis' }, { status: 400 })

    // Generate client_code: CL-26-XX
    const year2 = new Date().getFullYear().toString().slice(2)
    const { data: { users } } = await supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 })
    const existingCodes = (users ?? [])
      .map((u) => u.user_metadata?.client_code as string | undefined)
      .filter((c): c is string => !!c && c.startsWith(`CL-${year2}-`))
    let seq = existingCodes.length + 1
    while (existingCodes.includes(`CL-${year2}-${String(seq).padStart(2, '0')}`)) seq++
    const client_code = `CL-${year2}-${String(seq).padStart(2, '0')}`

    // Email is optional — if not provided, use a placeholder for Supabase auth
    const fakeEmail = email || `${client_code.toLowerCase()}@ngnior.local`

    const { data: { user }, error } = await supabaseAuthAdmin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { full_name, phone: phone ?? '', client_code },
    })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: user })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
