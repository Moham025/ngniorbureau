import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getInvoiceBranding, brandingAssetUrls, svgIcon, renderFooterBand,
  type InvoiceBranding,
} from '@/lib/branding'

/**
 * GET /api/admin/invoices/[id]/pdf
 *
 * Retourne la facture en PDF binaire (application/pdf).
 * Utilise puppeteer-core + Chrome installé sur le serveur.
 *
 * Query params:
 *   format=pdf      → PDF binaire (défaut)
 *   format=html     → HTML print-ready (fallback / debug)
 *   format=print    → HTML avec window.print() auto
 */

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

// Génération PDF via Chromium : mémoire/durée renforcées sur Vercel
export const maxDuration = 60

async function toBase64Server(url: string): Promise<string> {
  try {
    const r = await fetch(url)
    const buf = await r.arrayBuffer()
    const mime = r.headers.get('content-type') || 'image/png'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return ''
  }
}

function buildInvoiceHtml(
  doc: any, logo64: string, sig64: string, stamp64: string,
  b: InvoiceBranding, autoPrint = false,
): string {
  const items: { desc: string; qty: number; price: number }[] = doc.items ?? []
  const n = (v: unknown) => Number(v) || 0
  const gold = b.accent_color

  const rows = items.map((i, idx) => `
    <tr style="background:${idx % 2 ? '#faf8f2' : '#fff'}">
      <td style="padding:9px 12px;border-bottom:1px solid #eee">${i.desc}</td>
      <td style="text-align:center;padding:9px 12px;border-bottom:1px solid #eee">${n(i.qty)}</td>
      <td style="text-align:right;padding:9px 12px;border-bottom:1px solid #eee">${n(i.price).toLocaleString('fr-FR')} F CFA</td>
      <td style="text-align:right;padding:9px 12px;border-bottom:1px solid #eee;font-weight:600">${(n(i.qty) * n(i.price)).toLocaleString('fr-FR')} F CFA</td>
    </tr>`).join('')

  const type   = (doc.type || 'Facture').toUpperCase()
  const number = doc.number || ''
  const date   = doc.date || new Date().toISOString().slice(0, 10)

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${doc.type} ${number}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;width:210mm;min-height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;display:flex;flex-direction:column}
  /* En-tête noir avec accent doré en diagonale */
  .header{position:relative;background:#111;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:20px 26px;overflow:hidden}
  .header::after{content:"";position:absolute;top:0;right:0;width:55%;height:100%;background:linear-gradient(115deg,transparent 0%,transparent 42%,${gold}22 42%,${gold}22 48%,transparent 48%);}
  .header-logo img{height:58px;object-fit:contain;position:relative;z-index:2}
  .header-right{text-align:right;position:relative;z-index:2}
  .header-right h1{font-size:30px;font-weight:900;letter-spacing:2px}
  .header-ref{margin-top:8px;display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}
  .header-ref .lines{font-size:11px;line-height:1.6;text-align:right}
  .header-ref .cal{width:30px;height:30px;border-radius:7px;background:${gold};color:#111;display:flex;align-items:center;justify-content:center}
  /* Bandes société + adressée à */
  .info-row{display:flex;justify-content:space-between;gap:16px;padding:16px 26px 8px}
  .company{display:flex;gap:10px;align-items:flex-start}
  .company .ic{width:34px;height:34px;border-radius:50%;border:1.5px solid ${gold};color:${gold};display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .company h2{font-size:15px;font-weight:800}
  .company .slogan{font-size:10px;color:${gold};font-style:italic;margin-bottom:4px}
  .company .line{display:flex;align-items:center;gap:5px;font-size:9.5px;color:#555;margin-top:2px}
  .addr{border:1px solid #e4ddcd;border-radius:10px;padding:10px 14px;min-width:230px}
  .addr h4{font-size:10px;font-weight:800;color:${gold};border-bottom:1.5px solid ${gold};padding-bottom:4px;margin-bottom:6px;letter-spacing:.5px}
  .addr p{font-size:10.5px;line-height:1.6}
  /* Objet */
  .objet{margin:8px 26px;display:flex;align-items:center;gap:12px;border:1px solid #e8e8e8;border-radius:10px;padding:10px 14px}
  .objet .ic{width:30px;height:30px;border-radius:8px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .objet b{font-size:11px}
  /* Table */
  .items{width:calc(100% - 52px);margin:8px 26px;border-collapse:collapse;border-bottom:2px solid ${gold}}
  .items thead tr{background:#111;color:#fff}
  .items thead th{padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  .items thead th:nth-child(2){text-align:center}
  .items thead th:nth-child(3),.items thead th:nth-child(4){text-align:right}
  .items tbody td{font-size:10.5px}
  /* Totaux */
  .totals{margin:8px 26px 0 auto;width:300px}
  .totals table{width:100%;border-collapse:collapse}
  .totals td{padding:6px 10px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .ttc td{background:#111;color:${gold};font-weight:800;font-size:13px}
  /* Notes + signature */
  .bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:16px 26px 8px}
  .notes{display:flex;align-items:center;gap:10px;background:#faf8f2;border:1px solid #efe7d5;border-radius:10px;padding:12px 14px;font-size:10px;color:#555;font-style:italic;max-width:300px}
  .notes .ic{width:28px;height:28px;border-radius:50%;background:${gold};color:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sign{display:flex;align-items:flex-end}
  .sign .b1{text-align:center;margin-right:-12px;z-index:2;position:relative}
  .sign img.sig{height:78px;object-fit:contain;display:block;margin:0 auto}
  .sign .b1 p{font-size:10px;font-weight:bold;margin-top:2px}
  .sign .b1 span{font-size:10px;color:#555}
  .sign img.stamp{height:96px;object-fit:contain;z-index:1;position:relative}
  .print-bar{display:flex;gap:10px;justify-content:center;padding:16px;background:#f0f0f0;border-bottom:1px solid #ddd}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold}
  .btn-pdf{background:#111;color:#fff}.btn-close{background:#eee;color:#333}
  @media print{.print-bar{display:none!important}body,html{width:210mm}@page{margin:0}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn btn-pdf" onclick="window.print()">⬇ Télécharger / Imprimer PDF</button>
  <button class="btn btn-close" onclick="window.close()">✕ Fermer</button>
</div>
<div class="page">
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="${b.company_name}">` : `<span style="font-size:22px;font-weight:900;position:relative;z-index:2">${b.company_name}</span>`}</div>
    <div class="header-right">
      <h1>${type}</h1>
      <div class="header-ref">
        <div class="lines">N° : <strong>${number}</strong><br>Date : ${date}</div>
        <span class="cal">${svgIcon('calendar', 16, '#111')}</span>
      </div>
    </div>
  </div>

  <div class="info-row">
    <div class="company">
      <span class="ic">${svgIcon('building', 18, gold)}</span>
      <div>
        <h2>${b.company_name}</h2>
        <div class="slogan">${b.slogan}</div>
        <div class="line">${svgIcon('pin', 12, gold)} ${b.address}</div>
        <div class="line">${svgIcon('globe', 12, gold)} ${b.website}</div>
      </div>
    </div>
    <div class="addr">
      <h4>ADRESSÉE À :</h4>
      <p>${doc.client_name || '—'}${doc.client_email ? `<br>Email : ${doc.client_email}` : ''}${doc.client_phone ? `<br>Tél : ${doc.client_phone}` : ''}${doc.client_address ? `<br>${doc.client_address}` : ''}</p>
    </div>
  </div>

  ${doc.objet ? `<div class="objet"><span class="ic">${svgIcon('clipboard', 16, '#fff')}</span><div><b>OBJET :</b> ${doc.objet}</div></div>` : ''}

  <table class="items">
    <thead><tr>
      <th style="width:55%">DÉSIGNATION</th>
      <th style="width:8%">QTÉ</th>
      <th style="width:19%">PRIX UNIT.</th>
      <th style="width:18%">TOTAL</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>SOUS-TOTAL HT :</td><td>${n(doc.total_ht).toLocaleString('fr-FR')} F CFA</td></tr>
      <tr><td>TVA (${doc.tva_rate || '18 %'}) :</td><td>${n(doc.total_tva).toLocaleString('fr-FR')} F CFA</td></tr>
      <tr class="ttc"><td>TOTAL TTC :</td><td>${n(doc.total).toLocaleString('fr-FR')} F CFA</td></tr>
    </table>
  </div>

  <div class="bottom">
    ${doc.notes ? `<div class="notes"><span class="ic">${svgIcon('coins', 15, '#111')}</span><div>${doc.notes.replace(/\n/g, '<br>')}</div></div>` : '<div></div>'}
    <div class="sign">
      <div class="b1">
        ${sig64 ? `<img class="sig" src="${sig64}" alt="Signature">` : ''}
        <p>${b.signatory_label_invoice}</p>
        <span>${b.signatory_name}</span>
      </div>
      ${stamp64 ? `<img class="stamp" src="${stamp64}" alt="Cachet">` : ''}
    </div>
  </div>

  ${renderFooterBand(b)}
</div>
${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body></html>`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id }  = await params
  const format  = request.nextUrl.searchParams.get('format') || 'pdf'

  // ── Fetch document from Supabase ───────────────────────────────────────────
  const { data: doc, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !doc) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Document introuvable' },
      { status: 404 }
    )
  }

  // ── Branding (config Supabase, fallback valeurs par défaut) ────────────────
  const base = request.nextUrl.origin
  const branding = await getInvoiceBranding()
  const assets = brandingAssetUrls(branding, base)
  const [logo64, sig64, stamp64] = await Promise.all([
    toBase64Server(assets.logo),
    toBase64Server(assets.signature),
    toBase64Server(assets.stamp),
  ])

  const html = buildInvoiceHtml(doc, logo64, sig64, stamp64, branding, format === 'print')
  const filename = `${doc.type || 'document'}_${doc.number || id}`.replace(/[^a-zA-Z0-9_-]/g, '_')

  // ── HTML mode (debug / preview) ────────────────────────────────────────────
  if (format === 'html' || format === 'print') {
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  // ── PDF mode — puppeteer-core + Chrome (système en local, @sparticuz sur Vercel) ──
  try {
    // Dynamic import to avoid issues when puppeteer-core is not installed
    const puppeteer = await import('puppeteer-core')

    // Sur Vercel/AWS Lambda : Chrome allégé embarqué. En local : Chrome installé.
    const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME
    let executablePath = CHROME_PATH
    let launchArgs: string[] = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
    if (isServerless) {
      const chromium = (await import('@sparticuz/chromium')).default
      executablePath = await chromium.executablePath()
      launchArgs = chromium.args
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: launchArgs,
    })

    try {
      const page = await browser.newPage()

      // Charger le HTML directement (pas d'appel réseau supplémentaire)
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      })

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await browser.close()
    }
  } catch (err: any) {
    // Fallback: retourner le HTML si puppeteer échoue
    console.error('[PDF] Erreur puppeteer, fallback HTML:', err?.message)
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-PDF-Fallback': 'puppeteer-error',
        'X-PDF-Error': err?.message ?? 'unknown',
      },
    })
  }
}
