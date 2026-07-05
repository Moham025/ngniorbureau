import { NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAuthAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const [
      { data: projects },
      { data: products },
      { data: documents },
      { data: { users } },
      { data: clientProjects },
      { data: projectTransactions },
    ] = await Promise.all([
      supabaseAdmin.from('projects').select('id, is_active'),
      supabaseAdmin.from('products').select('id, stock'),
      supabaseAdmin.from('documents').select('id, status, total, type, created_at'),
      supabaseAuthAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from('client_projects').select('id, invoice_id, date, created_at'),
      supabaseAdmin.from('project_transactions').select('amount, date, created_at'),
    ])

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const isCurrentMonth = (dateStr?: string | null, createdAtStr?: string | null) => {
      let d: Date
      if (dateStr) {
        d = new Date(dateStr)
      } else if (createdAtStr) {
        d = new Date(createdAtStr)
      } else {
        return false
      }
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
    }

    // 1. Chiffre d'affaires du mois (Versements)
    const monthlyRevenue = (projectTransactions ?? [])
      .filter((t) => isCurrentMonth(t.date, t.created_at))
      .reduce((sum, t) => sum + (t.amount ?? 0), 0)

    // 2. Projets du mois (Coût total)
    const invoiceTotals: Record<string, number> = {}
    const invoiceIds = (clientProjects ?? []).map((p) => p.invoice_id).filter(Boolean)
    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabaseAdmin
        .from('documents')
        .select('id, total')
        .in('id', invoiceIds)
      for (const inv of invoices ?? []) {
        invoiceTotals[inv.id] = inv.total ?? 0
      }
    }

    const monthlyProjects = (clientProjects ?? []).filter((p) => isCurrentMonth(p.date, p.created_at))
    const monthlyProjectCosts = monthlyProjects.reduce((sum, p) => {
      const total = p.invoice_id ? (invoiceTotals[p.invoice_id] ?? 0) : 0
      return sum + total
    }, 0)

    const newClientsThisMonth = users.filter((u) => new Date(u.created_at) >= new Date(currentYear, currentMonth, 1)).length
    const premiumUsers = users.filter((u) => u.app_metadata?.plan === 'premium').length

    return NextResponse.json({
      success: true,
      data: {
        monthlyRevenue: { value: monthlyRevenue.toLocaleString('fr-FR'), currency: 'FCFA' },
        monthlyProjectCosts: { 
          value: monthlyProjectCosts.toLocaleString('fr-FR'), 
          count: monthlyProjects.length,
          currency: 'FCFA' 
        },
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
