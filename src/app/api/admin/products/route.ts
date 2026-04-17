import { NextRequest, NextResponse } from 'next/server'

// Mock data
let products = [
  { id: 's1', name: 'Casque VR Oculus', stock: 12, price: '250 000 FCFA', description: '' },
  { id: 's2', name: 'Livre: Architecture Tropicale', stock: 45, price: '45 000 FCFA', description: '' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')

  let filteredProducts = products

  if (search) {
    const searchLower = search.toLowerCase()
    filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchLower))
  }

  return NextResponse.json({
    success: true,
    data: filteredProducts,
    total: filteredProducts.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, price, stock, description } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    const newProduct = {
      id: `s${products.length + 1}`,
      name,
      price: price || '0 FCFA',
      stock: stock || 0,
      description: description || '',
    }

    products.push(newProduct)

    return NextResponse.json({
      success: true,
      data: newProduct,
      message: 'Product created successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
