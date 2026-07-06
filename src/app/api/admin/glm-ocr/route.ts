import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { image } = await req.json()
    if (!image) {
      return NextResponse.json({ success: false, error: 'Image manquante' }, { status: 400 })
    }

    const customKey = req.headers.get('x-glm-key')
    if (!customKey) {
      return NextResponse.json({ success: false, error: 'Clé API GLM manquante' }, { status: 400 })
    }

    // Call Zhipu AI API (GLM)
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customKey}`
      },
      body: JSON.stringify({
        model: 'glm-4v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Fais l\'OCR complet de cette image. Extrais tous les textes de devis/facture/DQE (articles, désignations, quantités, prix unitaires, totaux). Retourne uniquement les textes organisés ligne par ligne de manière structurée.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ success: false, error: 'Erreur GLM: ' + errText }, { status: response.status })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content ?? ''

    return NextResponse.json({ success: true, text })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
