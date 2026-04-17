import { NextResponse } from 'next/server'

export async function GET() {
  // Mock statistics data
  const stats = {
    monthlyRevenue: {
      value: '2 450 000',
      currency: 'FCFA',
      change: '+12.5%',
    },
    newClients: {
      value: 12,
      change: '+3',
    },
    shopSales: {
      value: 48,
      change: '+8',
    },
    totalProjects: {
      value: 24,
      active: 18,
      draft: 6,
    },
    totalClients: {
      value: 156,
      premium: 42,
      free: 114,
    },
    recentActivity: [
      { id: 1, action: 'Nouvel achat projet', time: 'Il y a 2 heures', type: 'sale' },
      { id: 2, action: 'Client inscrit', time: 'Il y a 4 heures', type: 'client' },
      { id: 3, action: 'Projet mis à jour', time: 'Il y a 5 heures', type: 'project' },
      { id: 4, action: 'Facture payée', time: 'Il y a 6 heures', type: 'invoice' },
      { id: 5, action: 'Nouveau produit', time: 'Il y a 1 jour', type: 'product' },
    ],
  }

  return NextResponse.json({
    success: true,
    data: stats,
  })
}
