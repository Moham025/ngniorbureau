import { NextRequest, NextResponse } from 'next/server'
import { supabaseAuthAdmin } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { full_name, phone, confirm } = body

    if (confirm) {
      const { error } = await supabaseAuthAdmin.auth.admin.updateUserById(id, { email_confirm: true })
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const { error } = await supabaseAuthAdmin.auth.admin.updateUserById(id, {
      user_metadata: { full_name: full_name ?? '', phone: phone ?? '' },
    })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabaseAuthAdmin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
