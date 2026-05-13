import { NextResponse } from 'next/server';

/**
 * Proxy sécurisé vers l'API LigdiCash debitotp
 * Permet d'éviter le blocage CORS depuis le navigateur web Flutter.
 * Les clés API sont stockées dans .env.local et ne sont jamais exposées au client.
 */
export async function POST(request: Request) {
  try {
    const { phone_number, amount } = await request.json();

    if (!phone_number || amount == null) {
      return NextResponse.json(
        { error: true, message: 'phone_number et amount requis' },
        { status: 400 }
      );
    }

    const apikey    = process.env.LIGDICASH_API_KEY!;
    const authToken = process.env.LIGDICASH_AUTH_TOKEN!;

    // LigdiCash debitotp : GET /pay/v01/debitotp/{phone}/{amount}
    const url = `https://app.ligdicash.com/pay/v01/debitotp/${phone_number}/${Math.round(amount)}`;
    console.log('📡 Proxy debitotp →', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Apikey: apikey,
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
    });

    const data = await response.json();
    console.log('📡 debitotp response:', response.status, JSON.stringify(data));
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('❌ debitotp proxy error:', error);
    return NextResponse.json(
      { error: true, message: error.message },
      { status: 500 }
    );
  }
}
