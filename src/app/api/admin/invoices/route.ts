import { NextRequest, NextResponse } from 'next/server'

// Mock data
let invoices = [
  { id: 'f1', number: 'FAC-2024-001', client: 'Jean Dupont', amount: '350 000 FCFA', date: '15 Avr 2024', status: 'Payée', type: 'invoice' },
  { id: 'f2', number: 'DEV-2024-042', client: 'Cabinet Lemaire', amount: '1 200 000 FCFA', date: '16 Avr 2024', status: 'En attente', type: 'quote' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // 'invoice' or 'quote'
  const status = searchParams.get('status')

  let filteredInvoices = invoices

  if (type) {
    filteredInvoices = filteredInvoices.filter((inv) => inv.type === type)
  }

  if (status) {
    filteredInvoices = filteredInvoices.filter((inv) => inv.status === status)
  }

  return NextResponse.json({
    success: true,
    data: filteredInvoices,
    total: filteredInvoices.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { number, client, amount, status, type } = body

    if (!number || !client) {
      return NextResponse.json(
        { success: false, error: 'Number and client are required' },
        { status: 400 }
      )
    }

    const newInvoice = {
      id: `f${invoices.length + 1}`,
      number,
      client,
      amount: amount || '0 FCFA',
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: status || 'En attente',
      type: type || 'invoice',
    }

    invoices.push(newInvoice)

    return NextResponse.json({
      success: true,
      data: newInvoice,
      message: 'Document created successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
