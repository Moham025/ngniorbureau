import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateDocNumber } from '@/lib/id-generators'
import { htmlToPdf, numToWordsFr } from '@/lib/html-to-pdf'

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
    const [logo64, sig64, stamp64] = await Promise.all([
      toBase64Server(`${base}/ngnior-logo.png`),
      toBase64Server(`${base}/signature.png`),
      toBase64Server(`${base}/tampon.png`),
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
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#fff;width:210mm;min-height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:0;display:flex;flex-direction:column}
  .header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:2px solid #000}
  .header-logo img{height:64px;object-fit:contain}
  .header-company{text-align:right}
  .header-company h2{font-size:15px;font-weight:900;color:#0055aa;margin-bottom:2px}
  .header-company p{font-size:9px;color:#555}
  .title-bar{text-align:center;padding:14px;background:#f5f5f5;border-bottom:1px solid #ddd}
  .title-bar h1{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
  .meta{display:flex;justify-content:space-between;padding:10px 24px;border-bottom:1px solid #eee;font-size:10px}
  .meta span{color:#555}.meta strong{color:#000}
  .client-box{margin:12px 24px;border:1px solid #ddd;border-radius:4px;padding:10px 14px;font-size:10px;background:#fafafa}
  .client-box p{margin-bottom:3px}.client-box span.lbl{color:#0055aa;font-weight:bold;margin-right:6px}
  .project-box{margin:0 24px 10px;border:1px solid #0055aa30;border-radius:4px;padding:10px 14px;font-size:10px;background:#f0f5ff}
  .project-box p{margin-bottom:3px;color:#0044aa}
  table.tx{width:calc(100% - 48px);margin:0 24px;border-collapse:collapse}
  table.tx thead tr{background:#000;color:#fff}
  table.tx thead th{padding:7px 10px;font-size:10px;text-align:left;letter-spacing:.5px}
  table.tx thead th:last-child{text-align:right}
  table.tx tbody td{padding:7px 10px;border-bottom:1px solid #eee;font-size:10px}
  table.tx tbody td:last-child{text-align:right;font-weight:bold}
  .totals{margin:8px 24px 0;border-top:2px solid #000}
  .totals table{width:220px;margin-left:auto}
  .totals td{padding:5px 8px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row td{font-weight:bold;background:#e8f4e8;color:#006600}
  .totals .rest-row td{font-weight:bold;background:#fde8e8;color:#cc0000;font-size:12px}
  .arrete{margin:10px 24px;font-style:italic;font-size:10px;color:#333;border-top:1px dashed #ccc;padding-top:8px}
  .sign-area{display:flex;justify-content:flex-end;align-items:flex-end;padding:16px 40px 8px;margin-top:10px}
  .sign-block{text-align:center;min-width:120px}
  .sign-block .line{border-top:1px solid #333;margin-bottom:4px;margin-top:60px}
  .sign-block img{height:72px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold}
  .footer{margin-top:30px;background:#fff;color:#000;padding:10px 20px 20px;font-size:11px;border-top:3px solid #000;line-height:1.6;}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="NGnior">` : '<span style="font-size:18px;font-weight:900">NGnior</span>'}</div>
    <div class="header-company">
      <h2>NGnior Conception</h2>
      <p>Service : Conception - Etude - Suivi contrôle – construction</p>
      <p>Date: ${dateStr}</p>
    </div>
  </div>

  <div class="title-bar"><h1>Reçu de Paiement</h1></div>

  <div class="meta">
    <span>Reçu N° : <strong>${recuNum}</strong></span>
    <span>Projet Réf. : <strong>${project.custom_id}</strong></span>
  </div>

  <div class="client-box">
    <p><span class="lbl">Entreprise :</span>NGnior Conception</p>
    <p><span class="lbl">Client Réf. :</span>${project.client_code}</p>
    <p><span class="lbl">Doit :</span>${project.client_name}</p>
  </div>

  <div class="project-box">
    <p><strong>Projet Associé :</strong> ${project.designation} (${project.type})</p>
    ${projectTotal ? `<p><strong>Coût total du projet :</strong> ${projectTotal.toLocaleString('fr-FR')} Fcfa</p>` : ''}
  </div>

  <p style="padding:8px 24px 4px;font-size:10px;font-weight:bold;">Détail des paiements reçus pour ce projet :</p>

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
        <p>Le Gérant</p>
        ${sig64 ? `<img src="${sig64}" alt="Signature" style="margin-top:-50px;position:relative;z-index:2">` : ''}
      </div>
      <div class="sign-block" style="position: relative; z-index: 1;">
        ${stamp64 ? `<img src="${stamp64}" alt="Cachet" style="margin-bottom: -15px;">` : ''}
      </div>
    </div>
  </div>

  <div class="footer">
    <div style="word-spacing: 6px;">Société à Responsabilité Limité &nbsp;&nbsp;&nbsp;&nbsp; ngniorconceptions@gmail.com &nbsp; www.ngniorconception.com</div>
    <div>RCCM : BFOUA2019B1915 IF : 00117306P |+226 56 88 65 05 | +226 71 35 33 75 |</div>
  </div>
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
