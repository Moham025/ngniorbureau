import { NextRequest, NextResponse } from 'next/server'
import { API_MANIFEST, API_AUTH_NOTE, API_REFERENCE_VALUES } from '@/lib/api-manifest'

/**
 * GET /api/admin/agent/manifest
 *
 * Découverte machine : renvoie le manifeste complet des API NGbureau.
 * Un agent IA appelle cette route une fois pour connaître toutes les
 * capacités disponibles (endpoints, paramètres, exemples).
 */
export async function GET(request: NextRequest) {
  const base = request.nextUrl.origin
  return NextResponse.json({
    success: true,
    name: 'NGbureau API',
    version: '1.0',
    baseUrl: base,
    auth: API_AUTH_NOTE,
    referenceValues: API_REFERENCE_VALUES,
    count: API_MANIFEST.length,
    endpoints: API_MANIFEST,
  })
}
