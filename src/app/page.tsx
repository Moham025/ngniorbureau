'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, FolderOpen, Tags, Calculator, ShoppingBag, FileText,
  Search, RefreshCw, CheckCircle, XCircle, LayoutDashboard,
  Settings, Moon, Sun, Plus, UploadCloud, Edit2, Trash2,
  TrendingUp, Activity, Box, Loader2, AlertCircle,
  X, Save, Bot, Settings2, Eye, ChevronLeft, ChevronRight, DollarSign, Wallet,
} from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge }    from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTheme } from 'next-themes'
import ProjectEditModal from '@/components/admin/ProjectEditModal'
import ProductEditModal, { type ProductFull } from '@/components/admin/ProductEditModal'
import InvoicesPage from '@/components/admin/InvoicesPage'
import ClientProjectsPage from '@/components/admin/ClientProjectsPage'
import KobaPage from '@/components/admin/KobaPage'
import SettingsPage from '@/components/admin/SettingsPage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client { id: string; client_code?: string; name: string; email: string; phone: string; plan: string; confirmed: boolean; created: string; last_sign_in: string; projects_count: number; docs_count: number }
interface Category { id: string; sort_order: number; slug: string; label: string }
interface Project { id: string; slug: string; title: string; tier: string; description?: string; price_fcfa: number; price_discount?: number; cover_url?: string; is_active: boolean; created_at: string; category_id: string; specs?: Record<string, unknown>; likes_count?: number; views_count?: number; rating_avg?: number; rating_count?: number; categories?: { slug: string; label: string } }
type Product = ProductFull
interface Estimation { id: string; project_id?: string; file_name: string; total_amount: number; blocs_count: number; currency: string; created_at: string; blocs?: any[]; materiaux?: any }

type TabId = 'dashboard' | 'projects' | 'client-projects' | 'categories' | 'estimations' | 'shop' | 'clients' | 'invoices' | 'koba' | 'settings'

function fmtPrice(n: number | null | undefined) { return n != null ? n.toLocaleString('fr-FR') + ' FCFA' : '0 FCFA' }

// ─── Dashboard stats ─────────────────────────────────────────────────────────

interface DashboardStats {
  monthlyRevenue: { value: string; currency: string }
  monthlyProjectCosts: { value: string; count: number; currency: string }
  newClients: { value: number }
  totalClients: { value: number; premium: number; free: number }
  totalProjects: { value: number; active: number; draft: number }
  shopSales: { value: number }
  recentActivity: { id: string; action: string; time: string }[]
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const [stats,       setStats]       = useState<DashboardStats | null>(null)
  const [clients,     setClients]     = useState<Client[]>([])
  const [categories,  setCategories]  = useState<Category[]>([])
  const [projects,    setProjects]    = useState<Project[]>([])
  const [products,    setProducts]    = useState<Product[]>([])
  const [estimations, setEstimations] = useState<Estimation[]>([])

  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error,   setError]   = useState<Record<string, string>>({})

  // Modals
  const [editProject,  setEditProject]  = useState<Project | null>(null)
  const [editProduct,  setEditProduct]  = useState<Product | null>(null)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; editing?: Category }>({ open: false })
  const [clientModal,   setClientModal]   = useState<{ open: boolean; editing?: Client }>({ open: false })

  // Filtres
  const [searchClients,  setSearchClients]  = useState('')
  const [searchProjects, setSearchProjects] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewEstimation, setViewEstimation] = useState<Estimation | null>(null)
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null)

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (tab: TabId) => {
    setLoading((l) => ({ ...l, [tab]: true }))
    setError((e)   => ({ ...e, [tab]: '' }))
    try {
      if (tab === 'dashboard') {
        const r = await fetch(`/api/admin/dashboard/stats?year=${selectedYear}&month=${selectedMonth}`)
        const j = await r.json()
        if (j.success) setStats(j.data); else setError((e) => ({ ...e, dashboard: j.error }))
      }
      if (tab === 'clients') {
        const r = await fetch(`/api/admin/clients?search=${encodeURIComponent(searchClients)}`)
        const j = await r.json()
        if (j.success) setClients(j.data); else setError((e) => ({ ...e, clients: j.error }))
      }
      if (tab === 'categories') {
        const r = await fetch('/api/admin/categories')
        const j = await r.json()
        if (j.success) setCategories(j.data); else setError((e) => ({ ...e, categories: j.error }))
      }
      if (tab === 'projects') {
        const [rp, rc] = await Promise.all([
          fetch(`/api/admin/projects?search=${encodeURIComponent(searchProjects)}`),
          fetch('/api/admin/categories'),
        ])
        const [jp, jc] = await Promise.all([rp.json(), rc.json()])
        if (jp.success) setProjects(jp.data)
        if (jc.success) setCategories(jc.data)
        if (!jp.success) setError((e) => ({ ...e, projects: jp.error }))
      }
      if (tab === 'shop') {
        const r = await fetch('/api/admin/products')
        const j = await r.json()
        if (j.success) setProducts(j.data); else setError((e) => ({ ...e, shop: j.error }))
      }
      if (tab === 'estimations') {
        const [re, rp] = await Promise.all([
          fetch('/api/admin/estimations'),
          fetch('/api/admin/projects')
        ])
        const [je, jp] = await Promise.all([re.json(), rp.json()])
        if (je.success) setEstimations(je.data); else setError((e) => ({ ...e, estimations: je.error }))
        if (jp.success) setProjects(jp.data);
      }
    } catch { setError((e) => ({ ...e, [tab]: 'Erreur de connexion réseau' })) }
    finally   { setLoading((l) => ({ ...l, [tab]: false })) }
  }, [selectedYear, selectedMonth, searchClients, searchProjects])

  useEffect(() => { fetchData(activeTab) }, [activeTab, fetchData])

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveTab(customEvent.detail as TabId);
    };
    window.addEventListener('switchTab', handleSwitchTab);
    return () => window.removeEventListener('switchTab', handleSwitchTab);
  }, []);

  // ─── CRUD Catégories ────────────────────────────────────────────────────────

  const saveCategory = async (label: string, slug: string, order: number, id?: string) => {
    const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories'
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, slug, order }) })
    const j = await res.json()
    if (j.success) { setCategoryModal({ open: false }); fetchData('categories') }
    return j
  }
  const deleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
    fetchData('categories')
  }

  // ─── CRUD Produits ───────────────────────────────────────────────────────────

  const deleteProduct = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    fetchData('shop')
  }

  // ─── Upload estimation ───────────────────────────────────────────────────────

  const handleEstimationUpload = async (file: File) => {
    const form = new FormData(); form.append('file', file)
    if (uploadProjectId) form.append('projectId', uploadProjectId)
    const r = await fetch('/api/admin/estimations', { method: 'POST', body: form })
    const j = await r.json()
    if (j.success) { setUploadProjectId(null); fetchData('estimations') }
  }

  const deleteEstimation = async (id: string) => {
    if (!confirm('Supprimer cette estimation ?')) return;
    const res = await fetch(`/api/admin/estimations/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.success) fetchData('estimations');
  }

  // ─── Menu ────────────────────────────────────────────────────────────────────

  const menuItems = [
    { id: 'dashboard' as TabId, label: 'Tableau de bord',   icon: LayoutDashboard },
    { id: 'clients'   as TabId, label: 'Gestion des clients', icon: Users },
    { id: 'client-projects' as TabId, label: 'Projets clients', icon: FolderOpen },
    { id: 'projects'  as TabId, label: 'Projets & Fichiers', icon: FolderOpen },
    { id: 'categories'as TabId, label: 'Catégories',         icon: Tags },
    { id: 'estimations'as TabId,label: 'Estimations',        icon: Calculator },
    { id: 'shop'      as TabId, label: 'Boutique',            icon: ShoppingBag },
    { id: 'invoices'  as TabId, label: 'Factures & Devis',    icon: FileText },
    { id: 'koba'      as TabId, label: 'KOBA',                icon: Wallet },
  ]
  const isLoading = loading[activeTab]

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  
  const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ]

  const handlePrevMonth = () => {
    setSelectedMonth((m) => {
      if (m === 1) {
        setSelectedYear((y) => y - 1)
        return 12
      }
      return m - 1
    })
  }

  const handleNextMonth = () => {
    setSelectedMonth((m) => {
      if (m === 12) {
        setSelectedYear((y) => y + 1)
        return 1
      }
      return m + 1
    })
  }

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: "Chiffre d'affaires (Versements)", 
            value: stats ? `${stats.monthlyRevenue.value} FCFA` : '—', 
            icon: TrendingUp,
            sub: 'Cumul des versements ce mois',
            isMonthDependent: true
          },
          { 
            label: "Projets du mois (Coût total)", 
            value: stats ? `${stats.monthlyProjectCosts.value} FCFA` : '—', 
            icon: DollarSign,
            sub: stats ? `${stats.monthlyProjectCosts.count} nouveau(x) projet(s)` : '',
            isMonthDependent: true
          },
          { 
            label: 'Clients ce mois', 
            value: stats ? `+${stats.newClients.value}` : '—', 
            icon: Users,
            sub: stats ? `${stats.totalClients.premium} premium / ${stats.totalClients.free} gratuits` : '',
            isMonthDependent: true
          },
          { 
            label: 'Projets actifs', 
            value: stats?.totalProjects.active ?? '—', 
            icon: Box,
            sub: stats ? `${stats.totalProjects.draft} brouillons` : '',
            isMonthDependent: false
          },
        ].map(({ label, value, icon: Icon, sub, isMonthDependent }) => (
          <Card key={label} className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
                  {isMonthDependent ? (
                    <div className="flex items-center gap-1 mt-1 bg-muted/40 rounded-lg px-2 py-0.5 w-fit border border-border/40">
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); handlePrevMonth() }}
                        className="hover:bg-muted p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <span className="text-[10px] font-bold text-foreground/80 select-none whitespace-nowrap">
                        {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                      </span>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); handleNextMonth() }}
                        className="hover:bg-muted p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-1 bg-transparent px-2 py-0.5 w-fit border border-transparent select-none">
                      <span className="text-[10px] font-bold text-muted-foreground/60">
                        Cumul Global
                      </span>
                    </div>
                  )}
                </div>
                <Icon size={18} className="text-foreground shrink-0 mt-0.5" />
              </div>
              <span className="text-2xl font-bold tracking-tight">{value}</span>
              {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Vue d&apos;ensemble</CardTitle></CardHeader>
          <CardContent className="h-52 flex items-center justify-center text-muted-foreground text-sm gap-3">
            <Activity size={36} />
            {stats ? `${stats.totalClients.value} clients · ${stats.totalProjects.value} projets · ${stats.shopSales.value} unités boutique` : 'Chargement…'}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-lg">Activité récente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats?.recentActivity.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />
                <div><p className="font-medium">{item.action}</p><p className="text-xs text-muted-foreground">{item.time}</p></div>
              </div>
            )) ?? <p className="text-sm text-muted-foreground">Aucune activité</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ─── PROJETS ─────────────────────────────────────────────────────────────────

  const renderProjects = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input value={searchProjects} onChange={(e) => setSearchProjects(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData('projects')}
            placeholder="Rechercher un projet…" className="pl-10" />
        </div>
        <Button onClick={() => fetchData('projects')} variant="outline" className="gap-2">
          <RefreshCw size={14} /> Actualiser
        </Button>
      </div>

      {projects.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-12">Aucun projet. Ajoutez-en depuis l&apos;app desktop.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p) => (
          <Card key={p.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
            onClick={() => setEditProject(p)}>
            <div className="h-40 bg-muted relative flex items-center justify-center overflow-hidden">
              {p.cover_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                : <FolderOpen size={48} className="text-muted-foreground/60" />}
              <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 bg-background/90 rounded uppercase tracking-wide border">
                {p.tier}
              </span>
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-base mb-0.5 truncate">{p.title}</h3>
              <p className="text-muted-foreground text-xs mb-3">{p.categories?.label ?? '—'}</p>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">{fmtPrice(p.price_fcfa)}</span>
                <Badge variant={p.is_active ? 'default' : 'secondary'}>
                  {p.is_active ? 'Actif' : 'Brouillon'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                Cliquer pour modifier →
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // ─── CATÉGORIES ──────────────────────────────────────────────────────────────

  const renderCategories = () => (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      <Card className="flex-1 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Catégories</CardTitle>
          <span className="text-sm text-muted-foreground">{categories.length}</span>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 pr-4">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl border">
                  <span className="w-8 text-center text-sm font-bold text-muted-foreground">{c.sort_order}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.label}</p>
                    <p className="text-xs text-muted-foreground truncate font-mono">{c.slug}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCategoryModal({ open: true, editing: c })}>
                      <Edit2 size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteCategory(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Aucune catégorie.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="w-full lg:w-80 shadow-sm h-fit">
        <CardHeader><CardTitle className="text-lg">Ajouter</CardTitle></CardHeader>
        <CardContent className="p-6 pt-0">
          <CategoryForm onSave={saveCategory} />
        </CardContent>
      </Card>
    </div>
  )

  // ─── ESTIMATIONS ─────────────────────────────────────────────────────────────

  const renderEstimations = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <input ref={fileInputRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEstimationUpload(f) }} />
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Projets et Estimations ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0
            ? <p className="text-sm text-muted-foreground p-6 text-center">Aucun projet trouvé.</p>
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Projet</TableHead>
                    <TableHead className="px-6">Fichier JSON</TableHead>
                    <TableHead className="px-6 text-center">Blocs</TableHead>
                    <TableHead className="px-6">Total</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => {
                    const est = estimations.find((e) => e.project_id === p.id)
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/30">
                        <TableCell className="px-6 font-medium">{p.title}</TableCell>
                        <TableCell className="px-6 text-muted-foreground text-sm">
                          {est ? (est.file_name || <span className="italic text-muted-foreground/60">Fichier inconnu</span>) : <span className="italic text-muted-foreground/60">Aucune estimation</span>}
                        </TableCell>
                        <TableCell className="px-6 text-center">{est ? est.blocs_count : '—'}</TableCell>
                        <TableCell className="px-6 font-bold">{est ? fmtPrice(est.total_amount) : '—'}</TableCell>
                        <TableCell className="px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {est ? (
                              <>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewEstimation(est)}>
                                  <Eye size={16} />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteEstimation(est.id)}>
                                  <Trash2 size={16} />
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8" onClick={() => { setUploadProjectId(p.id); fileInputRef.current?.click(); }}>
                                <Plus size={16} className="mr-2" /> Ajouter
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  )

  // ─── BOUTIQUE ────────────────────────────────────────────────────────────────

  const renderShop = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Catalogue — {products.length} produit(s)</h3>
        <Button onClick={() => setShowNewProduct(true)}><Plus size={16} className="mr-2" /> Ajouter</Button>
      </div>
      {products.length === 0 && !isLoading && (
        <p className="text-muted-foreground text-sm text-center py-12">Aucun produit dans la base.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {products.map((prod) => (
          <Card key={prod.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
            onClick={() => setEditProduct(prod)}>
            <div className="h-40 bg-muted relative flex items-center justify-center overflow-hidden">
              {prod.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={prod.thumbnail_url} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                : prod.product_images?.[0]?.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={prod.product_images[0].image_url} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <ShoppingBag size={40} className="text-muted-foreground/40" />}
            </div>
            <CardContent className="p-4">
              <h4 className="font-bold mb-1 truncate">{prod.name}</h4>
              {prod.category && <p className="text-xs text-muted-foreground mb-1">{prod.category}</p>}
              {prod.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{prod.description}</p>}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">{fmtPrice(prod.price_xof)}</span>
                <span className="text-xs text-muted-foreground">Stock : {prod.stock}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <Badge variant={prod.is_available ? 'default' : 'secondary'} className="text-xs">
                  {prod.is_available ? 'Actif' : 'Inactif'}
                </Badge>
                <button onClick={(e) => { e.stopPropagation(); deleteProduct(prod.id) }}
                  className="text-muted-foreground hover:text-destructive p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                Cliquer pour modifier →
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  // ─── CLIENTS ─────────────────────────────────────────────────────────────────

  const confirmClient = async (id: string) => {
    await fetch(`/api/admin/clients/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
    fetchData('clients')
  }
  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`Supprimer le client "${name}" ?`)) return
    await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' })
    fetchData('clients')
  }

  const renderClients = () => {
    const total   = clients.length
    const inscrit = clients.filter((c) => c.confirmed).length
    const premium = clients.filter((c) => c.plan === 'premium').length
    return (
      <div className="space-y-5 animate-in fade-in duration-500">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total',        value: total,          color: 'text-blue-400' },
            { label: 'Inscrits',     value: inscrit,        color: 'text-emerald-400' },
            { label: 'Non inscrits', value: total - inscrit, color: 'text-red-400' },
            { label: 'Premium',      value: premium,        color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input value={searchClients} onChange={(e) => setSearchClients(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData('clients')}
              placeholder="Rechercher par nom ou email…" className="pl-10" />
          </div>
          <Button onClick={() => setClientModal({ open: true })}>
            <Plus size={16} className="mr-2" /> Nouveau client
          </Button>
        </div>

        {/* Tableau */}
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">ID</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Nom / Prénom</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Email</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Téléphone</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Statut</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap text-center">Projets</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap text-center">Devis/Estim.</TableHead>
                    <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.length === 0
                    ? <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Aucun client.</TableCell></TableRow>
                    : clients.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {c.client_code || `${c.id.slice(0, 8)}…`}
                        </TableCell>
                        <TableCell className="px-4 py-3 font-semibold whitespace-nowrap">
                          {c.name || <span className="text-muted-foreground italic text-sm">sans nom</span>}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">{c.email}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {c.phone || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          {c.confirmed
                            ? <span className="flex items-center gap-1 text-emerald-500 text-sm font-medium"><CheckCircle size={14} /> Inscrit</span>
                            : <span className="flex items-center gap-1 text-red-400 text-sm font-medium"><XCircle size={14} /> Non inscrit</span>}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span className="font-bold text-sm text-yellow-400">{c.projects_count}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          <span className="font-bold text-sm text-yellow-400">{c.docs_count}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {!c.confirmed && (
                              <Button size="sm" className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => confirmClient(c.id)}>
                                Inscrire
                              </Button>
                            )}
                            {c.confirmed && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setClientModal({ open: true, editing: c })}>
                                <Edit2 size={13} />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteClient(c.id, c.name || c.email)}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Rendu principal ─────────────────────────────────────────────────────────

  const renderContent = () => {
    if (isLoading) return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-muted-foreground" />
      </div>
    )
    if (error[activeTab]) return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-destructive">
        <AlertCircle size={32} />
        <p className="font-medium">{error[activeTab]}</p>
        <Button variant="outline" onClick={() => fetchData(activeTab)}>Réessayer</Button>
      </div>
    )
    switch (activeTab) {
      case 'dashboard':       return renderDashboard()
      case 'projects':        return renderProjects()
      case 'client-projects': return <ClientProjectsPage />
      case 'categories':      return renderCategories()
      case 'estimations': return renderEstimations()
      case 'shop':        return renderShop()
      case 'clients':     return renderClients()
      case 'invoices':    return <InvoicesPage />
      case 'koba':        return <KobaPage />
      case 'settings':    return <SettingsPage />
      default:            return renderDashboard()
    }
  }

  const currentItem = activeTab === 'settings'
    ? { id: 'settings', label: 'Paramètres', icon: Settings }
    : menuItems.find((m) => m.id === activeTab)
  const CurrentIcon = currentItem?.icon ?? LayoutDashboard

  // ─── LAYOUT ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* SIDEBAR */}
      <aside className={`bg-card border-r flex flex-col shadow-sm z-20 hidden md:flex transition-all duration-300 relative ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-6 bg-card border rounded-md p-1 shadow-sm text-muted-foreground hover:text-foreground z-30 flex items-center justify-center"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className={`p-6 flex items-center gap-3 border-b ${isSidebarCollapsed ? 'justify-center px-4' : ''}`}>
          <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center text-background font-bold text-xl shrink-0">N</div>
          {!isSidebarCollapsed && <h1 className="text-xl font-bold tracking-wider truncate">NGnior<span className="text-muted-foreground">Bureau</span></h1>}
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              title={isSidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 py-3 rounded-xl transition-all duration-200 ${
                isSidebarCollapsed ? 'justify-center px-0' : 'w-full px-4'
              } ${
                activeTab === id ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}>
              <Icon size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="text-sm truncate">{label}</span>}
            </button>
          ))}
        </nav>
        <div className={`p-4 border-t ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
          <button 
            onClick={() => setActiveTab('settings')}
            title={isSidebarCollapsed ? "Paramètres" : undefined} 
            className={`flex items-center gap-3 py-3 rounded-xl transition-all duration-200 ${
              isSidebarCollapsed ? 'justify-center px-0 w-full' : 'w-full px-4'
            } ${
              activeTab === 'settings' 
                ? 'bg-muted text-foreground font-semibold' 
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Settings size={20} className="shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium text-sm truncate">Paramètres</span>}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-6 md:px-8 py-5 flex justify-between items-center border-b bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg"><CurrentIcon className="text-foreground" size={22} /></div>
            <h2 className="text-2xl font-bold">{currentItem?.label}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="h-10 w-10" suppressHydrationWarning>
              {mounted ? (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />) : <Moon size={18} />}
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => fetchData(activeTab)} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </header>
        <ScrollArea className="flex-1 w-full max-w-full">
          <div className="px-6 md:px-8 py-8 w-full max-w-full min-w-0">{renderContent()}</div>
        </ScrollArea>
      </main>

      {/* ─── Project Edit Modal ─────────────────────────────────────────────── */}
      {editProject && (
        <ProjectEditModal
          project={editProject}
          categories={categories}
          onClose={() => setEditProject(null)}
          onSaved={() => fetchData('projects')}
        />
      )}

      {/* ─── Category Modal ─────────────────────────────────────────────────── */}
      {categoryModal.open && (
        <Modal title={categoryModal.editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'} onClose={() => setCategoryModal({ open: false })}>
          <CategoryForm editing={categoryModal.editing} onSave={saveCategory} />
        </Modal>
      )}

      {/* ─── Product Edit Modal ─────────────────────────────────────────────── */}
      {(editProduct || showNewProduct) && (
        <ProductEditModal
          product={editProduct}
          onClose={() => { setEditProduct(null); setShowNewProduct(false) }}
          onSaved={() => fetchData('shop')}
        />
      )}

      {/* ─── Client Modal ──────────────────────────────────────────────────── */}
      {clientModal.open && (
        <Modal title={clientModal.editing ? 'Modifier le client' : 'Nouveau client'} onClose={() => setClientModal({ open: false })}>
          <ClientForm editing={clientModal.editing} onSave={async (fields) => {
            if (clientModal.editing) {
              await fetch(`/api/admin/clients/${clientModal.editing.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
              })
            } else {
              await fetch('/api/admin/clients', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
              })
            }
            setClientModal({ open: false }); fetchData('clients')
          }} />
        </Modal>
      )}

      {/* ─── Estimation View Modal ────────────────────────────────────────────── */}
      {viewEstimation && (
        <Modal title={`Estimation : ${viewEstimation.file_name}`} onClose={() => setViewEstimation(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-muted/30 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total HTVA</p><p className="font-bold text-lg">{fmtPrice(viewEstimation.total_amount)}</p></CardContent></Card>
              <Card className="bg-muted/30 shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Blocs</p><p className="font-bold text-lg">{viewEstimation.blocs_count}</p></CardContent></Card>
            </div>
            <p className="text-sm text-muted-foreground">Importé le {new Date(viewEstimation.created_at).toLocaleDateString('fr-FR')} — Devise : {viewEstimation.currency}</p>
            {viewEstimation.blocs && viewEstimation.blocs.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="font-semibold text-sm">Aperçu des blocs</h4>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {viewEstimation.blocs.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-muted p-3 rounded-lg text-sm">
                      <span className="truncate mr-4 flex-1">[{b.numero}] {b.titre}</span>
                      <span className="font-bold shrink-0">{fmtPrice(b.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

    </div>
  )
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── FORM CATÉGORIE ───────────────────────────────────────────────────────────

function CategoryForm({ editing, onSave }: {
  editing?: Category
  onSave: (label: string, slug: string, order: number, id?: string) => Promise<{ success: boolean; error?: string }>
}) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [slug,  setSlug]  = useState(editing?.slug ?? '')
  const [order, setOrder] = useState(editing?.sort_order ?? 10)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const auto = (v: string) => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); setErr(''); const r = await onSave(label, slug || auto(label), order, editing?.id); if (!r.success) setErr(r.error ?? 'Erreur'); setSaving(false) }} className="space-y-4">
      <div><label className="block text-sm text-muted-foreground mb-1">Label *</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Plans Commerciaux" required /></div>
      <div><label className="block text-sm text-muted-foreground mb-1">Slug</label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={label ? auto(label) : 'auto-généré'} /></div>
      <div><label className="block text-sm text-muted-foreground mb-1">Ordre</label>
        <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin mr-2" /> : <Save size={15} className="mr-2" />}
        {editing ? 'Enregistrer' : 'Créer'}
      </Button>
    </form>
  )
}

// ─── FORM CLIENT ─────────────────────────────────────────────────────────────

function ClientForm({ editing, onSave }: {
  editing?: Client
  onSave: (f: { email?: string; full_name: string; phone: string }) => Promise<void>
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState(editing?.email ?? '')
  const [phone,     setPhone]     = useState(editing?.phone ?? '')
  const [saving,    setSaving]    = useState(false)

  // Pre-fill name split on edit
  React.useEffect(() => {
    if (editing?.name) {
      const parts = editing.name.split(' ')
      setFirstName(parts[0] ?? '')
      setLastName(parts.slice(1).join(' '))
    }
  }, [editing])

  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setSaving(true)
      await onSave({ email, full_name: `${firstName} ${lastName}`.trim(), phone })
      setSaving(false)
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-sm text-muted-foreground mb-1">Prénom *</label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
        <div><label className="block text-sm text-muted-foreground mb-1">Nom *</label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
      </div>
      <div><label className="block text-sm text-muted-foreground mb-1">Email <span className="text-xs text-muted-foreground/70">(facultatif)</span></label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" /></div>
      <div><label className="block text-sm text-muted-foreground mb-1">Téléphone</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" /></div>
      <p className="text-xs text-muted-foreground">L'ID client sera généré automatiquement (format CL-26-XX).</p>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin mr-2" /> : <Save size={15} className="mr-2" />}
        {editing ? 'Enregistrer' : 'Créer le client'}
      </Button>
    </form>
  )
}

