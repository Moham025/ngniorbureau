import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET/PUT /api/admin/settings/{key}
 *
 * Réglages applicatifs côté serveur (table plans.app_settings, valeur jsonb).
 * Utilisé notamment par la config de branding des documents ('invoice_branding'),
 * lisible aussi par les générateurs PDF côté serveur.
 */
const MISSING = 'app_settings'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    if (error.message.includes(MISSING) || error.message.includes('does not exist')) {
      return NextResponse.json({ success: true, value: null, needsMigration: true })
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, value: data?.value ?? null })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params
    const value = await request.json()

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
      .single()

    if (error) {
      if (error.message.includes(MISSING) || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: false,
          needsMigration: true,
          error: "Table app_settings manquante. Lancer : CREATE TABLE IF NOT EXISTS plans.app_settings (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz DEFAULT now());",
        }, { status: 400 })
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, value: data.value })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
