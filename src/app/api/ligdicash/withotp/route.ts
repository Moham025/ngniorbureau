import { NextResponse } from 'next/server';

/**
 * Proxy sécurisé vers l'API LigdiCash withotp
 * Finalise le paiement avec le code OTP fourni par l'utilisateur.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const apikey    = process.env.LIGDICASH_API_KEY!;
    const authToken = process.env.LIGDICASH_AUTH_TOKEN!;

    const url = 'https://app.ligdicash.com/pay/v01/debitwallet/withotp';
    console.log('📡 Proxy withotp →', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Apikey: apikey,
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('📡 withotp response:', response.status, JSON.stringify(data));
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('❌ withotp proxy error:', error);
    return NextResponse.json(
      { error: true, message: error.message },
      { status: 500 }
    );
  }
}
