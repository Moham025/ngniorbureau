import { NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const [
      { data: projects },
      { data: products },
      { data: documents },
      { data: { users } },
    ] = await Promise.all([
      supabaseAdmin.from('projects').select('id, is_active'),
      supabaseAdmin.from('products').select('id, stock'),
      supabaseAdmin.from('documents').select('id, status, total, type, created_at'),
      supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthlyDocs = (documents ?? []).filter((d) => new Date(d.created_at) >= startOfMonth)
    const monthlyRevenue = monthlyDocs
      .filter((d) => d.status === 'payee' || d.status === 'paid')
      .reduce((sum, d) => sum + (d.total ?? 0), 0)

    const newClientsThisMonth = users.filter((u) => new Date(u.created_at) >= startOfMonth).length
    const premiumUsers = users.filter((u) => u.app_metadata?.plan === 'premium').length

    return NextResponse.json({
      success: true,
      data: {
        monthlyRevenue: { value: monthlyRevenue.toLocaleString('fr-FR'), currency: 'FCFA' },
        newClients: { value: newClientsThisMonth },
        totalClients: { value: users.length, premium: premiumUsers, free: users.length - premiumUsers },
        totalProjects: {
          value: (projects ?? []).length,
          active: (projects ?? []).filter((p) => p.is_active).length,
          draft: (projects ?? []).filter((p) => !p.is_active).length,
        },
        shopSales: { value: (products ?? []).reduce((s, p) => s + (p.stock ?? 0), 0) },
        recentActivity: (documents ?? []).slice(0, 5).map((d) => ({
          id: d.id,
          action: d.type === 'facture' ? 'Facture créée' : 'Devis créé',
          time: new Date(d.created_at).toLocaleDateString('fr-FR'),
          type: 'invoice',
        })),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur serveur'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
