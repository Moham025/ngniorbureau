import { NextRequest, NextResponse } from 'next/server'

// Mock data - In production, this would come from your database
let clients = [
  { id: '1', name: 'Jean Dupont', email: 'jean.dupont@email.com', plan: 'premium', confirmed: true, created: '2024-01-15' },
  { id: '2', name: 'Marie Curie', email: 'marie.c@architecture.fr', plan: 'gratuit', confirmed: true, created: '2024-02-03' },
  { id: '3', name: 'Cabinet Lemaire', email: 'contact@lemaire-archi.com', plan: 'premium', confirmed: true, created: '2024-02-28' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')

  let filteredClients = clients

  if (search) {
    const searchLower = search.toLowerCase()
    filteredClients = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower)
    )
  }

  return NextResponse.json({
    success: true,
    data: filteredClients,
    total: filteredClients.length,
    premium: filteredClients.filter((c) => c.plan === 'premium').length,
    free: filteredClients.filter((c) => c.plan === 'gratuit').length,
    confirmed: filteredClients.filter((c) => c.confirmed).length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, plan } = body

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      )
    }

    const newClient = {
      id: String(clients.length + 1),
      name,
      email,
      plan: plan || 'gratuit',
      confirmed: false,
      created: new Date().toISOString().split('T')[0],
    }

    clients.push(newClient)

    return NextResponse.json({
      success: true,
      data: newClient,
      message: 'Client created successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create client' },
      { status: 500 }
    )
  }
}
