import { NextRequest, NextResponse } from 'next/server'

// Mock data
let categories = [
  { id: 'c1', order: 10, slug: 'villas-r1', label: 'Villas R+1' },
  { id: 'c2', order: 20, slug: 'duplex', label: 'Duplex & Triplex' },
  { id: 'c3', order: 30, slug: 'immeubles', label: 'Immeubles' },
]

export async function GET() {
  const sorted = [...categories].sort((a, b) => a.order - b.order)

  return NextResponse.json({
    success: true,
    data: sorted,
    total: sorted.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label, slug, order } = body

    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label is required' },
        { status: 400 }
      )
    }

    const newCategory = {
      id: `c${categories.length + 1}`,
      order: order || 10,
      slug: slug || label.toLowerCase().replace(/\s+/g, '-'),
      label,
    }

    categories.push(newCategory)

    return NextResponse.json({
      success: true,
      data: newCategory,
      message: 'Category created successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 }
    )
  }
}
