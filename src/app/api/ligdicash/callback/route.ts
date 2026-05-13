import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Client Supabase avec service_role pour mettre à jour les paiements
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Callback LigdiCash — route POST publique appelée par les serveurs LigdiCash
 * après chaque paiement réussi ou échoué.
 *
 * LigdiCash envoie DEUX requêtes POST successives :
 *  1. Content-Type: application/x-www-form-urlencoded
 *  2. Content-Type: application/json
 * Nous traitons les deux mais ignorons les doublons via le champ `token`.
 *
 * URL à configurer dans votre dashboard LigdiCash :
 *   https://ngniorconception.com/api/ligdicash/callback
 *   (ou l'URL de votre NGbureau déployé)
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let event: any = {};

    if (contentType.includes('application/json')) {
      event = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((value, key) => { event[key] = value; });
    } else {
      // Essai de parse JSON quand même
      try { event = await request.json(); } catch (_) {}
    }

    console.log('📥 LigdiCash Callback reçu:', JSON.stringify(event));

    const token           = event.token         as string | undefined;
    const transaction_id  = event.transaction_id as string | undefined;
    const status          = event.status         as string | undefined;
    const order_id        = event.custom_data?.order_id as string | undefined;
    const amount          = event.amount         as number | undefined;
    const operator        = event.operator       as string | undefined;

    // Sécurité : on a besoin d'au moins le token ou l'order_id
    if (!token && !order_id) {
      console.warn('⚠️ Callback sans token ni order_id, ignoré.');
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    // ── 1. Enregistrer la transaction dans Supabase ────────────────────────
    const { data: existing } = await supabase
      .schema('plans')
      .from('payments')
      .select('id, status')
      .eq('token', token ?? '')
      .maybeSingle();

    if (existing && existing.status === 'completed') {
      // Déjà traité — éviter de livrer deux fois
      console.log('ℹ️ Transaction déjà traitée:', token);
      return NextResponse.json({ status: 'already_processed' }, { status: 200 });
    }

    // Upsert la transaction
    await supabase
      .schema('plans')
      .from('payments')
      .upsert({
        token,
        transaction_id,
        order_id,
        status,
        amount,
        operator,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'token' });

    // ── 2. Si paiement réussi → débloquer le contenu ──────────────────────
    if (status === 'completed' && order_id) {
      if (order_id.startsWith('PLAN-')) {
        // Format : PLAN-<project_id>-<timestamp>
        const parts = order_id.split('-');
        const planId = parts.slice(1, -1).join('-'); // récupère l'UUID entre PLAN- et le timestamp

        await supabase
          .schema('plans')
          .from('purchases')
          .upsert({
            plan_id: planId,
            order_id,
            payment_token: token,
            status: 'completed',
            paid_at: new Date().toISOString(),
          }, { onConflict: 'order_id' });

        console.log(`✅ Plan débloqué: ${planId}`);

      } else if (order_id.startsWith('SHOP-')) {
        // Commande boutique
        await supabase
          .schema('plans')
          .from('orders')
          .upsert({
            order_id,
            payment_token: token,
            status: 'paid',
            paid_at: new Date().toISOString(),
          }, { onConflict: 'order_id' });

        console.log(`✅ Commande boutique payée: ${order_id}`);
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Erreur callback LigdiCash:', error);
    // Retourner 200 quand même pour éviter que LigdiCash réessaie indéfiniment
    return NextResponse.json({ status: 'error', message: error.message }, { status: 200 });
  }
}

// LigdiCash peut aussi envoyer un GET pour tester l'URL
export async function GET() {
  return NextResponse.json({ status: 'LigdiCash callback endpoint actif ✅' });
}
