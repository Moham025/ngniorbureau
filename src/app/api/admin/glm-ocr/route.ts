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

    // Call Zhipu AI / Z.AI Layout Parsing API (GLM OCR)
    // We try both open.bigmodel.cn and api.z.ai to cover all key regions
    let response;
    let errText = '';
    
    const endpoints = [
      'https://open.bigmodel.cn/api/paas/v4/layout_parsing',
      'https://api.z.ai/api/paas/v4/layout_parsing'
    ];

    for (const url of endpoints) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${customKey}`
          },
          body: JSON.stringify({
            model: 'glm-ocr',
            file: image
          })
        });

        if (response.ok) {
          break;
        } else {
          errText = await response.text();
        }
      } catch (err: any) {
        errText = err.message;
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({ success: false, error: 'Erreur GLM Layout Parsing: ' + errText }, { status: response ? response.status : 400 })
    }

    const data = await response.json()
    let text = ''
    if (data.layout_result && Array.isArray(data.layout_result)) {
      text = data.layout_result.map((r: any) => r.content || '').join('\n')
    } else if (data.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content
    } else {
      text = JSON.stringify(data)
    }

    return NextResponse.json({ success: true, text })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
