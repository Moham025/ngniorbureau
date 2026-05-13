import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseStorage, BUCKET_NAME, getPublicUrl } from '@/lib/supabase'

const FILE_TYPE_MAP: Record<string, string> = {
  webp: 'image_preview', jpg: 'image_preview', jpeg: 'image_preview', png: 'image_preview',
  pdf: 'plan_pdf', dwg: 'plan_dwg', dxf: 'plan_dwg',
  xlsx: 'plan_excel', xls: 'plan_excel',
  pln: 'detail_materiaux', json: 'estimation_json',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: dbFiles, error } = await supabaseAdmin
    .from('project_files')
    .select('*')
    .eq('project_id', id)
    .order('sort_order')

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // Enrichir avec URLs publiques
  const enriched = (dbFiles ?? []).map((f) => ({
    ...f,
    public_url: f.storage_path ? getPublicUrl(f.storage_path) : null,
  }))

  return NextResponse.json({ success: true, data: enriched })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File
    const tier = (formData.get('tier') as string) || 'preview'
    const subFolder = (formData.get('subFolder') as string) || 'images'

    if (!file) return NextResponse.json({ success: false, error: 'Fichier requis' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const storagePath = `${id}/${tier}/${subFolder}/${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { upsert: true, contentType: file.type || 'application/octet-stream' })

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })

    const { data: dbFile, error: dbError } = await supabaseAdmin
      .from('project_files')
      .insert({
        project_id: id,
        file_name: file.name,
        file_type: FILE_TYPE_MAP[ext] ?? 'unknown',
        package_type: tier,
        storage_path: storagePath,
        file_size_kb: Math.round(file.size / 1024),
        mime_type: file.type || 'application/octet-stream',
        sort_order: 0,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ success: false, error: dbError.message }, { status: 500 })

    return NextResponse.json({ success: true, data: { ...dbFile, public_url: getPublicUrl(storagePath) } })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
