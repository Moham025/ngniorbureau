import { NextRequest, NextResponse } from 'next/server'
import { supabaseStorage, BUCKET_NAME, getPublicUrl } from '@/lib/supabase'

/**
 * POST /api/admin/settings/branding-asset  (multipart)
 *
 * Upload d'une image de branding (logo | signature | stamp) vers Supabase
 * Storage, sous branding/. Renvoie l'URL publique à stocker dans la config.
 *
 * form-data: file=<image>, type=logo|signature|stamp
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const type = ((form.get('type') as string) || 'asset').replace(/[^a-z]/gi, '')

    if (!file) return NextResponse.json({ success: false, error: 'Fichier requis' }, { status: 400 })

    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `branding/${type}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, { upsert: true, contentType: file.type || 'image/png' })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, public_url: getPublicUrl(path) })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
