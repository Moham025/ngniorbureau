import { NextRequest, NextResponse } from 'next/server'

const DEEPSEEK_API_KEY = 'sk-27e0373b97414135b4de303cb6dbaeda'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) return NextResponse.json({ success: false, error: 'Prompt requis' }, { status: 400 })

    const customKey = request.headers.get('x-deepseek-key')
    const apiKey = customKey || DEEPSEEK_API_KEY

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ success: false, error: text }, { status: res.status })
    }

    const data = await res.json()
    const generated = data.choices?.[0]?.message?.content?.trim() ?? ''

    return NextResponse.json({ success: true, text: generated })
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
