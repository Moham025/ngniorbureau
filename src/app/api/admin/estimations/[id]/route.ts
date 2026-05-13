import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  
  if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('estimations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
