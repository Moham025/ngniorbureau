import { NextRequest, NextResponse } from 'next/server'

/**
 * Protection du site et des API NGbureau.
 *
 * Deux modes d'accès :
 *  - Humain  : cookie de session posé après saisie du code sur /login
 *  - Machine : header `x-api-key` égal à AGENT_API_KEY (bots, agents IA)
 *
 * Variables d'environnement requises :
 *  - ADMIN_ACCESS_CODE : code d'accès humain (page /login)
 *  - AGENT_API_KEY     : clé API pour les agents (header x-api-key)
 *
 * Rollout sans casse : si AUCUNE des deux variables n'est définie,
 * le middleware laisse tout passer (comportement historique) et
 * se contente d'un warning en logs.
 */

const COOKIE_NAME = 'ngb_admin'
const SALT = 'ngb-salt-2026'

// Chemins toujours accessibles sans authentification
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth',
  '/api/ligdicash', // callbacks de paiement externes — ne jamais bloquer
]

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(request: NextRequest) {
  const adminCode = process.env.ADMIN_ACCESS_CODE || ''
  const agentKey = process.env.AGENT_API_KEY || ''

  // Pas encore configuré -> comportement historique (tout ouvert)
  if (!adminCode && !agentKey) {
    console.warn('[middleware] ADMIN_ACCESS_CODE / AGENT_API_KEY non définis — site NON protégé')
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 1) Accès machine : header x-api-key
  if (agentKey) {
    const provided = request.headers.get('x-api-key')
    if (provided && provided === agentKey) {
      return NextResponse.next()
    }
  }

  // 2) Accès humain : cookie de session (hash du code d'accès)
  if (adminCode) {
    const cookie = request.cookies.get(COOKIE_NAME)?.value
    if (cookie && cookie === await sha256Hex(adminCode + SALT)) {
      return NextResponse.next()
    }
  }

  // Refus : JSON pour les API, redirection /login pour les pages
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, error: 'Non autorisé. Fournir le header x-api-key ou se connecter sur /login.' },
      { status: 401 }
    )
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Tout sauf les assets statiques Next et les fichiers publics
  matcher: ['/((?!_next/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|woff2?|ttf)$).*)'],
}
