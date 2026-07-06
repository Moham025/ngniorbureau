import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { prompt, text } = await req.json()
    if (!prompt || !text) {
      return NextResponse.json({ success: false, error: 'Prompt ou texte manquant' }, { status: 400 })
    }

    const finalPrompt = prompt.replace('{projet}', text)
    
    const customKey = req.headers.get('x-deepseek-key')
    const apiKey = customKey || 'sk-27e0373b97414135b4de303cb6dbaeda'

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Tu es un assistant utile.' },
          { role: 'user', content: finalPrompt }
        ],
        temperature: 0.3,
      })
    })

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ success: false, error: 'Erreur API DeepSeek: ' + errorData }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices[0].message.content

    return NextResponse.json({ success: true, result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
