import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseStorage, BUCKET_NAME, getPublicUrl } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = (formData.get('type') as string) || 'gallery'

    if (!file) return NextResponse.json({ success: false, error: 'Fichier requis' }, { status: 400 })

    const storagePath = `products/${id}/${type}/${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseStorage.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { upsert: true, contentType: file.type || 'application/octet-stream' })

    if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })

    const publicUrl = getPublicUrl(storagePath)

    if (type === 'thumbnail') {
      await supabaseAdmin.from('products').update({ thumbnail_url: publicUrl }).eq('id', id)
      return NextResponse.json({ success: true, url: publicUrl, type: 'thumbnail' })
    }

    const { data, error } = await supabaseAdmin
      .from('product_images')
      .insert({ product_id: id, image_url: publicUrl, position: 0 })
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: { ...data, public_url: publicUrl }, type: 'gallery' })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
