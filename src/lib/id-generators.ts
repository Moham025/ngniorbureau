/**
 * GÉNÉRATEURS D'IDENTIFIANTS — source unique de vérité.
 *
 * Schéma officiel NGnior Conception :
 *   Client            CL-26-01         (CL-année-rang d'inscription, padded 2)
 *   Projet            P-26-CL-26-01-01 (P-année-{code client}-{n° du projet}, padded 2)
 *   Facture           FAC-26-1      (FAC-année-séquence de l'année)
 *   Devis             DEV-26-1
 *   Reçu              R-26-1
 *   Facture Proforma  FacP-26-1
 *
 * Les anciens documents gardent leurs numéros historiques ; les nouveaux
 * suivent ce schéma. Les séquences sont calculées par max+1 (robuste aux
 * suppressions), jamais par simple comptage.
 */
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

export function getYear2(): string {
  return new Date().getFullYear().toString().slice(2)
}

export const DOC_PREFIXES: Record<string, string> = {
  'Facture': 'FAC',
  'Devis': 'DEV',
  'Reçu': 'R',
  'Facture Proforma': 'FacP',
}

/** Extrait le max d'une liste de valeurs "prefix{N}" -> N numérique */
function maxNumericSuffix(values: string[], prefix: string): number {
  let max = 0
  for (const v of values) {
    if (!v || !v.startsWith(prefix)) continue
    const rest = v.slice(prefix.length)
    if (/^\d+$/.test(rest)) {
      const n = parseInt(rest, 10)
      if (n > max) max = n
    }
  }
  return max
}

// ── Clients ──────────────────────────────────────────────────────────────────

/** CL-26-01 : rang parmi les clients inscrits dans l'année */
export async function generateClientCode(): Promise<string> {
  const year2 = getYear2()
  const prefix = `CL-${year2}-`
  const { data: { users } } = await supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 })
  const codes = (users ?? [])
    .map((u) => u.user_metadata?.client_code as string | undefined)
    .filter((c): c is string => !!c)
  const next = maxNumericSuffix(codes, prefix) + 1
  return `${prefix}${String(next).padStart(2, '0')}`
}

/**
 * Retrouve un client existant par code (CL-26-01) ou par nom exact
 * (insensible à la casse). Retourne null si introuvable.
 * Sert à NE PAS créer de doublon client.
 */
export async function findExistingClient(code?: string, fullName?: string):
  Promise<{ id: string; code: string; name: string; email: string; phone: string } | null> {
  const { data: { users } } = await supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 })
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  let user =
    (code && (users ?? []).find(
      (u) => (u.user_metadata?.client_code || '').toLowerCase() === code.trim().toLowerCase()
    )) || null

  if (!user && fullName) {
    user = (users ?? []).find(
      (u) => norm(u.user_metadata?.full_name || '') === norm(fullName)
    ) || null
  }

  if (!user) return null
  return {
    id: user.id,
    code: user.user_metadata?.client_code || '',
    name: user.user_metadata?.full_name || '',
    email: user.email || '',
    phone: user.user_metadata?.phone || '',
  }
}

// ── Projets ──────────────────────────────────────────────────────────────────

/** P-26-CL-26-01-01 : P-année-{code client}-{séquence de l'année} */
export async function generateProjectId(clientCode: string): Promise<string> {
  const year2 = getYear2()
  const { data: existing } = await supabaseAdmin
    .from('client_projects')
    .select('custom_id')

  const ids = (existing ?? []).map((p) => p.custom_id as string).filter(Boolean)
  // Séquence annuelle globale = max du dernier segment numérique parmi P-26-*
  let max = 0
  for (const id of ids) {
    if (!id.startsWith(`P-${year2}-`)) continue
    const last = id.split('-').pop() || ''
    if (/^\d+$/.test(last)) {
      const n = parseInt(last, 10)
      if (n > max) max = n
    }
  }
  return `P-${year2}-${clientCode}-${String(max + 1).padStart(2, '0')}`
}

// ── Documents ────────────────────────────────────────────────────────────────

/** FAC-26-1 / DEV-26-1 / R-26-1 / FacP-26-1 : séquence par type et par année */
export async function generateDocNumber(type: string): Promise<string> {
  const year2 = getYear2()
  const p = DOC_PREFIXES[type] || type.substring(0, 3).toUpperCase()
  const prefix = `${p}-${year2}-`

  const { data: existing } = await supabaseAdmin
    .from('documents')
    .select('number')
    .eq('type', type)

  const numbers = (existing ?? []).map((d) => d.number as string).filter(Boolean)
  const next = maxNumericSuffix(numbers, prefix) + 1
  return `${prefix}${next}`
}
