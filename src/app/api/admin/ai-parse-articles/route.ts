import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()
    if (!text) {
      return NextResponse.json({ success: false, error: 'Texte manquant' }, { status: 400 })
    }

    const customKey = req.headers.get('x-deepseek-key')
    const apiKey = customKey || 'sk-27e0373b97414135b4de303cb6dbaeda'

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse de documents financiers (DQE, devis, factures).
    Analyse le texte fourni (qui provient d'un copier-coller ou d'un OCR d'image) et extrait la liste des articles avec leur désignation, leur quantité et leur prix unitaire.
    Retourne uniquement un tableau JSON valide sous le format exact suivant, sans aucun commentaire, sans texte d'accompagnement, et sans balises markdown (pas de blocs \`\`\`json) :
    [
      {
        "desc": "Désignation claire de l'article",
        "qty": 1,
        "price": 5000
      }
    ]
    Assure-toi de nettoyer les descriptions et de convertir correctement les nombres. Si des colonnes comme le total sont présentes, ne les insère pas comme de nouveaux articles mais utilise-les si nécessaire pour valider le calcul (Total = qty * price).`

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ success: false, error: 'Erreur DeepSeek: ' + errText }, { status: response.status })
    }

    const data = await response.json()
    let resultText = data.choices?.[0]?.message?.content ?? ''
    
    // Clean potential markdown code blocks
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim()

    const items = JSON.parse(resultText)

    return NextResponse.json({ success: true, items })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
