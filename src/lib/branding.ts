import { supabaseAdmin } from '@/lib/supabase'

/**
 * Branding des documents (facture, proforma, reçu).
 *
 * Source de vérité : table plans.app_settings, clé 'invoice_branding'.
 * Si la table/clé est absente, on retombe sur DEFAULT_BRANDING (= valeurs
 * historiques), donc les PDF restent générés même sans configuration.
 *
 * Fondation pour Koba Business : plus tard, le branding sera par entreprise.
 */

export interface InvoiceBranding {
  company_name: string
  slogan: string            // sous le nom (facture)
  service_line: string      // ligne "Service : ..." (reçu)
  address: string
  website: string
  legal_form: string
  rccm: string
  ifu: string
  emails: string[]
  phones: string[]
  signatory_label_invoice: string
  signatory_name: string
  signatory_label_recu: string
  accent_color: string      // couleur d'accent (or)
  logo_url: string | null
  signature_url: string | null
  stamp_url: string | null
}

/** Valeurs par défaut = branding NGnior historique. */
export const DEFAULT_BRANDING: InvoiceBranding = {
  company_name: 'NGnior Conception',
  slogan: 'Conception - Suivi - Réalisation',
  service_line: 'Service : Conception - Etude - Suivi contrôle - construction',
  address: 'Ouagadougou, Burkina Faso',
  website: 'www.ngniorconception.com',
  legal_form: 'Société à Responsabilité Limitée',
  rccm: 'BFOUA2019B1915',
  ifu: '00117306P',
  emails: ['ngniorconceptions@gmail.com'],
  phones: ['+226 56 88 65 05', '+226 71 35 33 75'],
  signatory_label_invoice: 'Le Directeur',
  signatory_name: 'SANOU Mohamed Yacine',
  signatory_label_recu: 'Le Gérant',
  accent_color: '#C9A84C',
  logo_url: null,       // null -> fallback fichier /public
  signature_url: null,
  stamp_url: null,
}

const BRANDING_KEY = 'invoice_branding'

/** Récupère le branding (config fusionnée aux défauts). Ne throw jamais. */
export async function getInvoiceBranding(): Promise<InvoiceBranding> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', BRANDING_KEY)
      .maybeSingle()
    if (error || !data?.value) return { ...DEFAULT_BRANDING }
    const v = data.value as Partial<InvoiceBranding>
    return {
      ...DEFAULT_BRANDING,
      ...v,
      emails: Array.isArray(v.emails) && v.emails.length ? v.emails : DEFAULT_BRANDING.emails,
      phones: Array.isArray(v.phones) && v.phones.length ? v.phones : DEFAULT_BRANDING.phones,
    }
  } catch {
    return { ...DEFAULT_BRANDING }
  }
}

/** URLs d'images à charger côté serveur (config ou fichiers /public par défaut). */
export function brandingAssetUrls(b: InvoiceBranding, base: string) {
  return {
    logo: b.logo_url || `${base}/ngnior-logo.png`,
    signature: b.signature_url || `${base}/signature.png`,
    stamp: b.stamp_url || `${base}/tampon.png`,
  }
}

// ── Icônes SVG (traits fins, couleur pilotée par currentColor) ────────────────
const ICONS: Record<string, string> = {
  building: '<path d="M3 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M14 21V9h6a1 1 0 0 1 1 1v11M6 8h2M6 12h2M6 16h2M18 13h1M18 17h1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  coins: '<circle cx="9" cy="9" r="5"/><path d="M14.5 5.5a5 5 0 0 1 0 13M6.5 9h5"/>',
}

/** Renvoie une icône SVG inline (couleur via style color). */
export function svgIcon(name: keyof typeof ICONS | string, size = 16, color = 'currentColor'): string {
  const body = ICONS[name] || ''
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${body}</svg>`
}

/** Bandeau footer noir avec 3 groupes (icône dorée + 2 lignes) — commun aux 2 docs. */
export function renderFooterBand(b: InvoiceBranding): string {
  const gold = b.accent_color
  const group = (icon: string, l1: string, l2: string) => `
    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
      <span style="width:26px;height:26px;border-radius:50%;background:${gold};color:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0">${svgIcon(icon, 14, '#111')}</span>
      <div style="font-size:9px;line-height:1.4;color:#eee;min-width:0">
        <div>${l1}</div><div>${l2}</div>
      </div>
    </div>`
  return `
  <div style="margin-top:auto;background:#111;color:#fff;padding:12px 22px;display:flex;gap:18px;justify-content:space-between">
    ${group('user', b.legal_form, `RCCM : ${b.rccm} IF : ${b.ifu}`)}
    ${group('mail', b.emails[0] || '', b.website)}
    ${group('phone', b.phones[0] || '', b.phones[1] || '')}
  </div>`
}
