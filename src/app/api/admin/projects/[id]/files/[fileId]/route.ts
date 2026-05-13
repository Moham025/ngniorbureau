import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseStorage, BUCKET_NAME } from '@/lib/supabase'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { fileId } = await params

  // Récupérer le storage_path avant suppression
  const { data: fileRecord, error: fetchError } = await supabaseAdmin
    .from('project_files')
    .select('storage_path')
    .eq('id', fileId)
    .single()

  if (fetchError) return NextResponse.json({ success: false, error: fetchError.message }, { status: 404 })

  // Supprimer du Storage
  if (fileRecord?.storage_path) {
    await supabaseStorage.storage.from(BUCKET_NAME).remove([fileRecord.storage_path])
  }

  // Supprimer de la DB
  const { error } = await supabaseAdmin.from('project_files').delete().eq('id', fileId)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
