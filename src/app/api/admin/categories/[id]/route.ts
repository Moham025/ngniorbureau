import { NextRequest, NextResponse } from 'next/server'

// Mock data
let categories = [
  { id: 'c1', order: 10, slug: 'villas-r1', label: 'Villas R+1' },
  { id: 'c2', order: 20, slug: 'duplex', label: 'Duplex & Triplex' },
  { id: 'c3', order: 30, slug: 'immeubles', label: 'Immeubles' },
]

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const categoryIndex = categories.findIndex((c) => c.id === params.id)

    if (categoryIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }

    categories[categoryIndex] = {
      ...categories[categoryIndex],
      ...body,
      id: params.id,
    }

    return NextResponse.json({
      success: true,
      data: categories[categoryIndex],
      message: 'Category updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const categoryIndex = categories.findIndex((c) => c.id === params.id)

  if (categoryIndex === -1) {
    return NextResponse.json(
      { success: false, error: 'Category not found' },
      { status: 404 }
    )
  }

  categories.splice(categoryIndex, 1)

  return NextResponse.json({
    success: true,
    message: 'Category deleted successfully',
  })
}
