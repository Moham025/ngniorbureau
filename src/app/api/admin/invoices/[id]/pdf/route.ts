import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

function buildInvoiceHtml(doc: any, logo64: string, sig64: string, stamp64: string, autoPrint = false): string {
  const items: { desc: string; qty: number; price: number }[] = doc.items ?? []
  const n = (v: unknown) => Number(v) || 0

  const rows = items.map((i) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #ddd">${i.desc}</td>
      <td style="text-align:center;padding:7px 10px;border-bottom:1px solid #ddd">${n(i.qty)}</td>
      <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${n(i.price).toLocaleString('fr-FR')} F CFA</td>
      <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${(n(i.qty) * n(i.price)).toLocaleString('fr-FR')} F CFA</td>
    </tr>`).join('')

  const type   = (doc.type || 'Facture').toUpperCase()
  const number = doc.number || ''
  const date   = doc.date || new Date().toISOString().slice(0, 10)

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${doc.type} ${number}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#fff;width:210mm;min-height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;display:flex;flex-direction:column}
  .header{background:#000;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:12px 20px}
  .header-logo img{height:60px;object-fit:contain}
  .header-title{text-align:right}
  .header-title h1{font-size:28px;font-weight:900;letter-spacing:1px;margin-bottom:2px}
  .header-title .ref{font-size:12px}
  .company{padding:10px 20px 8px}
  .company h2{font-size:14px;font-weight:bold}
  .company p{font-size:10px;color:#444;line-height:1.6}
  .company a{color:#0066cc;text-decoration:none}
  hr.divider{border:none;border-top:2px solid #000;margin:0 20px}
  .client-block{padding:10px 20px}
  .client-block h4{font-size:10px;font-weight:bold;text-decoration:underline;margin-bottom:4px}
  .client-block p{font-size:10px;line-height:1.8}
  .items-table{width:calc(100% - 40px);margin:6px 20px;border-collapse:collapse}
  .items-table thead tr{background:#000;color:#fff}
  .items-table thead th{padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  .items-table thead th:nth-child(2){text-align:center}
  .items-table thead th:nth-child(3),.items-table thead th:nth-child(4){text-align:right}
  .items-table tbody tr:nth-child(even){background:#f9f9f9}
  .items-table tbody td{font-size:10px}
  .totals{margin:6px 20px 0 auto;width:280px}
  .totals table{width:100%;border-collapse:collapse}
  .totals td{padding:5px 8px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row{font-weight:bold;font-size:13px;border-top:2px solid #000;background:#eee}
  .notes{padding:10px 20px;font-style:italic;color:#555;font-size:10px;border-top:1px solid #ccc;margin-top:8px}
  .sign-area{display:flex;justify-content:space-between;align-items:flex-end;padding:16px 40px 10px}
  .sign-block{text-align:center}
  .sign-block img{height:80px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold;margin-top:4px}
  .sign-block span{font-size:10px;color:#444}
  .page-footer{margin-top:auto;background:#fff;color:#000;padding:10px 20px 20px;font-size:11px;border-top:3px solid #000;line-height:1.6}
  .print-bar{display:flex;gap:10px;justify-content:center;padding:16px;background:#f0f0f0;border-bottom:1px solid #ddd}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold}
  .btn-pdf{background:#000;color:#fff}
  .btn-close{background:#eee;color:#333}
  @media print{.print-bar{display:none!important}body,html{width:210mm}@page{margin:0}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn btn-pdf" onclick="window.print()">⬇ Télécharger / Imprimer PDF</button>
  <button class="btn btn-close" onclick="window.close()">✕ Fermer</button>
</div>
<div class="page">
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="NGnior Conception">` : '<span style="font-size:22px;font-weight:900">NGnior</span>'}</div>
    <div class="header-title">
      <h1>${type}</h1>
      <div class="ref">N° : <strong>${number}</strong></div>
      <div class="ref">Date : ${date}</div>
    </div>
  </div>
  <div class="company">
    <h2>Ngnior Conception</h2>
    <p>Conception - Suivi - Réalisation<br>Ouagadougou, Burkina Faso<br><a href="https://www.ngniorconception.com">www.ngniorconception.com</a></p>
  </div>
  <hr class="divider">
  <div class="client-block">
    <h4>ADRESSÉE À :</h4>
    <p>${doc.client_name || '—'}<br>
    ${doc.client_email ? `Email : ${doc.client_email}<br>` : ''}
    ${doc.client_phone ? `Tél : ${doc.client_phone}<br>` : ''}
    ${doc.client_address || ''}</p>
  </div>
  ${doc.objet ? `<div style="padding:4px 20px 6px;font-size:10px"><strong>Objet :</strong> ${doc.objet}</div>` : ''}
  <table class="items-table">
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
      <tr class="total-row"><td><strong>TOTAL TTC :</strong></td><td><strong>${n(doc.total).toLocaleString('fr-FR')} F CFA</strong></td></tr>
    </table>
  </div>
  ${doc.notes ? `<div class="notes">${doc.notes.replace(/\n/g, '<br>')}</div>` : ''}
  <div class="sign-area">
    <div></div>
    <div style="display:flex;align-items:flex-end;">
      <div class="sign-block" style="margin-right:-10px;z-index:2;position:relative;">
        ${sig64 ? `<img src="${sig64}" alt="Signature">` : ''}
        <p>Le Directeur</p>
        <span>SANOU Mohamed Yacine</span>
      </div>
      <div class="sign-block" style="z-index:1;position:relative;">
        ${stamp64 ? `<img src="${stamp64}" alt="Cachet" style="margin-bottom:-15px;">` : ''}
      </div>
    </div>
  </div>
  <div class="page-footer">
    <div style="word-spacing:6px;">Société à Responsabilité Limité &nbsp;&nbsp;&nbsp;&nbsp; ngniorconceptions@gmail.com &nbsp; www.ngniorconception.com</div>
    <div>RCCM : BFOUA2019B1915 IF : 00117306P |+226 56 88 65 05 | +226 71 35 33 75 |</div>
  </div>
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

  // ── Load images server-side ───────────────────────────────────────────────
  const base = request.nextUrl.origin
  const [logo64, sig64, stamp64] = await Promise.all([
    toBase64Server(`${base}/ngnior-logo.png`),
    toBase64Server(`${base}/signature.png`),
    toBase64Server(`${base}/tampon.png`),
  ])

  const html = buildInvoiceHtml(doc, logo64, sig64, stamp64, format === 'print')
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

  // ── PDF mode — puppeteer-core + Chrome système ────────────────────────────
  try {
    // Dynamic import to avoid issues when puppeteer-core is not installed
    const puppeteer = await import('puppeteer-core')

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
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
