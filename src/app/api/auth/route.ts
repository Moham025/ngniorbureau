import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth  { code: "..." }
 * Vérifie le code d'accès admin et pose le cookie de session.
 *
 * DELETE /api/auth
 * Déconnexion (supprime le cookie).
 */

const COOKIE_NAME = 'ngb_admin'
const SALT = 'ngb-salt-2026'
const THIRTY_DAYS = 60 * 60 * 24 * 30

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest) {
  const adminCode = process.env.ADMIN_ACCESS_CODE || ''
  if (!adminCode) {
    return NextResponse.json(
      { success: false, error: "ADMIN_ACCESS_CODE non configuré côté serveur." },
      { status: 500 }
    )
  }

  let code = ''
  try {
    const body = await request.json()
    code = String(body?.code ?? '')
  } catch {
    /* body invalide */
  }

  if (code !== adminCode) {
    return NextResponse.json({ success: false, error: 'Code incorrect.' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, await sha256Hex(adminCode + SALT), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: THIRTY_DAYS,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
