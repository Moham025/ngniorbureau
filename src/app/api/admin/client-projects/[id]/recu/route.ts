import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateDocNumber } from '@/lib/id-generators'
import { htmlToPdf, numToWordsFr } from '@/lib/html-to-pdf'
import { getInvoiceBranding, brandingAssetUrls, svgIcon, renderFooterBand } from '@/lib/branding'

/**
 * GET /api/admin/client-projects/{id}/recu
 *
 * Reçu de paiement OFFICIEL d'un projet, généré côté serveur :
 *  - récupère le projet + tous ses versements (project_transactions)
 *  - numérote selon le schéma officiel R-26-1 et ENREGISTRE le reçu
 *    dans la table documents (traçabilité comptable)
 *  - si un reçu existe déjà pour ce projet avec le même total versé,
 *    il est réutilisé (pas de doublon quand rien n'a changé)
 *
 * Query params:
 *   format=pdf (défaut) | html
 */

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const format = request.nextUrl.searchParams.get('format') || 'pdf'

    // ── 1. Projet ────────────────────────────────────────────────────────────
    const { data: project, error: projErr } = await supabaseAdmin
      .from('client_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projErr || !project) {
      return NextResponse.json({ success: false, error: 'Projet introuvable' }, { status: 404 })
    }

    // ── 2. Versements ────────────────────────────────────────────────────────
    const { data: transactions } = await supabaseAdmin
      .from('project_transactions')
      .select('*')
      .eq('project_id', id)
      .order('date', { ascending: true })

    const txs = transactions ?? []
    const versed = txs.reduce((s, t) => s + (t.amount ?? 0), 0)

    // Coût total du projet via la facture liée
    let projectTotal = 0
    if (project.invoice_id) {
      const { data: inv } = await supabaseAdmin
        .from('documents')
        .select('total')
        .eq('id', project.invoice_id)
        .single()
      projectTotal = inv?.total ?? 0
    }
    const rest = Math.max(projectTotal - versed, 0)

    // ── 3. Numéro officiel R-26-N (réutilisé si reçu identique déjà émis) ────
    const objetKey = `Reçu de paiement — ${project.custom_id}`
    const { data: existingReceipts } = await supabaseAdmin
      .from('documents')
      .select('id, number, total')
      .eq('type', 'Reçu')
      .eq('objet', objetKey)
      .order('created_at', { ascending: false })
      .limit(1)

    let recuNum: string
    const prior = (existingReceipts ?? [])[0]
    if (prior && (prior.total ?? 0) === versed) {
      recuNum = prior.number
    } else {
      recuNum = await generateDocNumber('Reçu')
      const { error: insertErr } = await supabaseAdmin.from('documents').insert({
        type: 'Reçu',
        number: recuNum,
        client_name: project.client_name || '',
        client_email: '',
        client_phone: '',
        client_address: '',
        date: new Date().toISOString().slice(0, 10),
        due_date: '',
        objet: objetKey,
        items: txs.map((t) => ({
          desc: `${t.reference} — ${t.notes || project.designation}`,
          qty: 1,
          price: t.amount ?? 0,
        })),
        tva_rate: '0 %',
        total_ht: versed,
        total_tva: 0,
        total: versed,
        notes: `Reçu généré pour le projet ${project.custom_id}. Reste à payer : ${rest.toLocaleString('fr-FR')} F.`,
        status: 'payé',
      })
      if (insertErr) console.warn('[recu] Enregistrement du reçu impossible:', insertErr.message)
    }

    // ── 4. HTML du reçu ──────────────────────────────────────────────────────
    const base = request.nextUrl.origin
    const b = await getInvoiceBranding()
    const assets = brandingAssetUrls(b, base)
    const gold = b.accent_color
    const [logo64, sig64, stamp64] = await Promise.all([
      toBase64Server(assets.logo),
      toBase64Server(assets.signature),
      toBase64Server(assets.stamp),
    ])

    const dateStr = new Date().toLocaleDateString('fr-FR')
    const txRows = txs.map((t) => `
      <tr>
        <td>${t.date ? new Date(t.date).toLocaleDateString('fr-FR') : '—'}</td>
        <td>${t.reference}</td>
        <td>${t.notes || project.designation}</td>
        <td style="text-align:right">${(t.amount ?? 0).toLocaleString('fr-FR')}</td>
      </tr>`).join('')
    const words = numToWordsFr(Math.round(versed)) + ' francs CFA'

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Reçu ${recuNum}</title>
<style>
  @page { size: A4 portrait; margin: 0 }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a1a;background:#fff;width:210mm;min-height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:0;display:flex;flex-direction:column}
  .header{display:flex;align-items:center;justify-content:space-between;padding:18px 26px;border-bottom:2px solid ${gold}}
  .header-logo img{height:62px;object-fit:contain}
  .header-company{text-align:right}
  .header-company h2{font-size:16px;font-weight:900}
  .header-company p{font-size:9.5px;color:${gold}}
  .header-company .dt{color:#555;margin-top:2px}
  .title-bar{text-align:center;padding:16px}
  .title-bar h1{font-size:20px;font-weight:900;letter-spacing:2px;text-transform:uppercase;display:inline-flex;align-items:center;gap:14px}
  .title-bar h1::before,.title-bar h1::after{content:"";width:38px;height:3px;background:${gold};border-radius:2px}
  .meta{display:flex;justify-content:space-between;padding:2px 26px 12px;font-size:11px}
  .meta strong{color:#000}
  .info-box{margin:0 26px;border:1px solid #e4ddcd;border-radius:10px;padding:12px 16px}
  .info-box .row{display:flex;align-items:center;gap:10px;font-size:11px;padding:3px 0}
  .info-box .ic{width:26px;height:26px;border-radius:50%;border:1.5px solid ${gold};color:${gold};display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .info-box .lbl{font-weight:bold;margin-right:4px}
  .project-box{margin:12px 26px;display:flex;gap:10px;align-items:flex-start;border:1px solid #efe7d5;border-radius:10px;padding:12px 16px;font-size:10.5px;background:#faf8f2}
  .project-box .ic{width:28px;height:28px;border-radius:8px;background:${gold};color:#111;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  table.tx{width:calc(100% - 52px);margin:6px 26px;border-collapse:collapse}
  table.tx thead tr{background:#111;color:#fff}
  table.tx thead th{padding:8px 12px;font-size:10px;text-align:left;letter-spacing:.5px;text-transform:uppercase}
  table.tx thead th:last-child{text-align:right}
  table.tx tbody td{padding:8px 12px;border-bottom:1px solid #eee;font-size:10.5px}
  table.tx tbody td:last-child{text-align:right;font-weight:bold}
  .totals{margin:8px 26px 0}
  .totals table{width:260px;margin-left:auto;border-collapse:collapse}
  .totals td{padding:7px 10px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row td{font-weight:bold;background:#e8f4e8;color:#0a7a2f}
  .totals .rest-row td{font-weight:bold;background:#fdecec;color:#c62828;font-size:12px}
  .arrete{margin:12px 26px;font-style:italic;font-size:10px;color:#333;border-top:1px dashed #ccc;padding-top:8px}
  .sign-area{display:flex;justify-content:flex-end;align-items:flex-end;padding:16px 44px 10px;margin-top:6px}
  .sign-block{text-align:center;min-width:150px}
  .sign-block .line{border-top:1px solid #333;margin-bottom:4px;margin-top:64px}
  .sign-block img{height:74px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="${b.company_name}">` : `<span style="font-size:18px;font-weight:900">${b.company_name}</span>`}</div>
    <div class="header-company">
      <h2>${b.company_name}</h2>
      <p>${b.service_line}</p>
      <p class="dt">Date : ${dateStr}</p>
    </div>
  </div>

  <div class="title-bar"><h1>Reçu de Paiement</h1></div>

  <div class="meta">
    <span>Reçu N° : <strong>${recuNum}</strong></span>
    <span>Projet Réf. : <strong>${project.custom_id}</strong></span>
  </div>

  <div class="info-box">
    <div class="row"><span class="ic">${svgIcon('building', 14, gold)}</span><span><span class="lbl">Entreprise :</span>${b.company_name}</span></div>
    <div class="row"><span class="ic">${svgIcon('user', 14, gold)}</span><span><span class="lbl">Client Réf. :</span>${project.client_code}</span></div>
    <div class="row"><span class="ic">${svgIcon('user', 14, gold)}</span><span><span class="lbl">Doit :</span>${project.client_name}</span></div>
  </div>

  <div class="project-box">
    <span class="ic">${svgIcon('folder', 15, '#111')}</span>
    <div>
      <p><strong>Projet Associé :</strong> ${project.designation} (${project.type})</p>
      ${projectTotal ? `<p><strong>Coût total du projet :</strong> ${projectTotal.toLocaleString('fr-FR')} Fcfa</p>` : ''}
    </div>
  </div>

  <p style="padding:6px 26px 4px;font-size:10.5px;font-weight:bold;">Détail des paiements reçus pour ce projet :</p>

  <table class="tx">
    <thead><tr>
      <th>Date</th><th>Référence Transaction</th><th>Désignation</th><th>Montant (Fcfa)</th>
    </tr></thead>
    <tbody>${txRows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:12px">Aucun versement enregistré</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr class="total-row"><td>Total Reçu :</td><td>${versed.toLocaleString('fr-FR')} Fcfa</td></tr>
      ${projectTotal ? `<tr class="rest-row"><td>Reste à Payer :</td><td>${rest.toLocaleString('fr-FR')} Fcfa</td></tr>` : ''}
    </table>
  </div>

  ${versed > 0 ? `<div class="arrete"><em>Arrêté le présent reçu à la somme totale des paiements de : <strong>${words}</strong>.</em></div>` : ''}

  <div class="sign-area">
    <div style="display:flex; align-items:flex-end;">
      <div class="sign-block" style="position: relative; z-index: 2; margin-right: -40px;">
        <div class="line"></div>
        <p>${b.signatory_label_recu}</p>
        ${sig64 ? `<img src="${sig64}" alt="Signature" style="margin-top:-50px;position:relative;z-index:2">` : ''}
      </div>
      <div class="sign-block" style="position: relative; z-index: 1;">
        ${stamp64 ? `<img src="${stamp64}" alt="Cachet" style="margin-bottom: -15px;">` : ''}
      </div>
    </div>
  </div>

  ${renderFooterBand(b)}
</div>
</body></html>`

    // ── 5. Sortie ────────────────────────────────────────────────────────────
    if (format === 'html') {
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    try {
      const pdf = await htmlToPdf(html)
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${recuNum.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
          'Cache-Control': 'no-store',
          'X-Recu-Number': recuNum,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[recu] Erreur PDF, fallback HTML:', msg)
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-PDF-Fallback': 'puppeteer-error',
          'X-PDF-Error': msg,
        },
      })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
