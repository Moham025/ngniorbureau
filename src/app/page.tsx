'use client'

import React, { useState } from 'react'
import {
  Users, FolderOpen, Tags, Calculator,
  ShoppingBag, FileText, Search, RefreshCw,
  CheckCircle, XCircle, LayoutDashboard, Settings,
  Moon, Sun, Plus, UploadCloud, Edit2, Trash2,
  TrendingUp, Activity, Box, Download, MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useTheme } from 'next-themes'

// Types
interface Client {
  id: string
  name: string
  email: string
  plan: 'premium' | 'gratuit'
  confirmed: boolean
  created: string
}

interface Project {
  id: string
  title: string
  category: string
  tier: 'premium' | 'basic'
  price: string
  status: 'Actif' | 'Brouillon'
}

interface Category {
  id: string
  order: number
  slug: string
  label: string
}

interface Invoice {
  id: string
  number: string
  client: string
  amount: string
  date: string
  status: 'Payée' | 'En attente' | 'Annulée'
}

interface Product {
  id: string
  name: string
  stock: number
  price: string
}

type TabId = 'dashboard' | 'projects' | 'categories' | 'estimations' | 'shop' | 'clients' | 'invoices'

interface MenuItem {
  id: TabId
  label: string
  icon: any
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const { theme, setTheme } = useTheme()

  // ─── MOCK DATA ─────────────────────────────────────────────
  const mockClients: Client[] = [
    { id: '1', name: 'Jean Dupont', email: 'jean.dupont@email.com', plan: 'premium', confirmed: true, created: '2024-01-15' },
    { id: '2', name: 'Marie Curie', email: 'marie.c@architecture.fr', plan: 'gratuit', confirmed: true, created: '2024-02-03' },
    { id: '3', name: 'Cabinet Lemaire', email: 'contact@lemaire-archi.com', plan: 'premium', confirmed: true, created: '2024-02-28' },
  ]

  const mockProjects: Project[] = [
    { id: 'p1', title: 'Villa R+1 Moderne', category: 'Villas', tier: 'premium', price: '350 000 FCFA', status: 'Actif' },
    { id: 'p2', title: 'Duplex Familial', category: 'Duplex', tier: 'basic', price: '150 000 FCFA', status: 'Actif' },
    { id: 'p3', title: 'Immeuble R+4', category: 'Immeubles', tier: 'premium', price: '900 000 FCFA', status: 'Brouillon' },
  ]

  const mockCategories: Category[] = [
    { id: 'c1', order: 10, slug: 'villas-r1', label: 'Villas R+1' },
    { id: 'c2', order: 20, slug: 'duplex', label: 'Duplex & Triplex' },
    { id: 'c3', order: 30, slug: 'immeubles', label: 'Immeubles' },
  ]

  const mockInvoices: Invoice[] = [
    { id: 'f1', number: 'FAC-2024-001', client: 'Jean Dupont', amount: '350 000 FCFA', date: '15 Avr 2024', status: 'Payée' },
    { id: 'f2', number: 'DEV-2024-042', client: 'Cabinet Lemaire', amount: '1 200 000 FCFA', date: '16 Avr 2024', status: 'En attente' },
  ]

  const mockProducts: Product[] = [
    { id: 's1', name: 'Casque VR Oculus', stock: 12, price: '250 000 FCFA' },
    { id: 's2', name: 'Livre: Architecture Tropicale', stock: 45, price: '45 000 FCFA' },
  ]

  // ─── MENU ──────────────────────────────────────────────────
  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'projects', label: 'Projets & Fichiers', icon: FolderOpen },
    { id: 'categories', label: 'Catégories', icon: Tags },
    { id: 'estimations', label: 'Estimations', icon: Calculator },
    { id: 'shop', label: 'Boutique', icon: ShoppingBag },
    { id: 'clients', label: 'Gestion des clients', icon: Users },
    { id: 'invoices', label: 'Factures & Devis', icon: FileText },
  ]

  // ─── RENDUS DES ONGLETS ────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted-foreground">Revenus du mois</span>
              <TrendingUp size={20} className="text-foreground" />
            </div>
            <span className="text-3xl font-bold">2 450 000 <span className="text-sm text-muted-foreground font-normal">FCFA</span></span>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted-foreground">Nouveaux Clients</span>
              <Users size={20} className="text-foreground" />
            </div>
            <span className="text-3xl font-bold">+12</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-muted-foreground">Ventes Boutique</span>
              <Box size={20} className="text-foreground" />
            </div>
            <span className="text-3xl font-bold">48</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Statistiques</CardTitle>
          </CardHeader>
          <CardContent className="h-80 flex flex-col items-center justify-center">
            <Activity size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">Graphique des statistiques à intégrer ici</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-foreground"></div>
                  <div>
                    <p className="text-foreground font-medium">Nouvel achat projet</p>
                    <p className="text-muted-foreground text-xs">Il y a 2 heures</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderProjects = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            type="text"
            placeholder="Rechercher un projet..."
            className="pl-10"
          />
        </div>
        <Button className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> Nouveau Projet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProjects.map((p) => (
          <Card key={p.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <div className="h-40 bg-muted relative flex items-center justify-center">
              <FolderOpen size={48} className="text-muted-foreground/60 group-hover:scale-110 transition-transform" />
              <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 bg-background rounded-md uppercase tracking-wide border">
                {p.tier}
              </span>
            </div>
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-1">{p.title}</h3>
              <p className="text-muted-foreground text-sm mb-3">{p.category}</p>
              <div className="flex justify-between items-center">
                <span className="font-semibold">{p.price}</span>
                <Badge variant={p.status === 'Actif' ? 'default' : 'secondary'}>{p.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderCategories = () => (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      <Card className="flex-1 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Catégories existantes</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              <div className="flex px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span className="w-16">Ordre</span>
                <span className="flex-1">Slug</span>
                <span className="flex-1">Label</span>
                <span className="w-24 text-right">Actions</span>
              </div>
              {mockCategories.map((c) => (
                <div key={c.id} className="flex items-center gap-4 bg-muted/50 p-2 rounded-xl border">
                  <Input type="number" defaultValue={c.order} className="w-16 text-center" />
                  <Input type="text" defaultValue={c.slug} className="flex-1" />
                  <Input type="text" defaultValue={c.label} className="flex-1" />
                  <div className="w-24 flex justify-end gap-2 pr-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="w-full lg:w-1/3 shadow-sm h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Ajouter</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Label *</label>
            <Input type="text" placeholder="Ex: Plans Commerciaux" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Slug</label>
            <Input type="text" placeholder="Auto-généré" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Ordre</label>
            <Input type="number" placeholder="10" />
          </div>
          <Button className="w-full mt-4">
            Ajouter la catégorie
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderEstimations = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="border-dashed shadow-sm">
        <CardContent className="p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <UploadCloud size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-bold text-lg mb-2">Importer une nouvelle estimation</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Glissez-déposez le fichier <code className="bg-muted px-1 rounded">Estimation.json</code> généré par votre logiciel, ou cliquez pour parcourir.
          </p>
          <Button>
            Sélectionner le fichier JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Estimations récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sélectionnez un projet pour voir le détail des coûts (Gros œuvre, Finitions, etc.).</p>
        </CardContent>
      </Card>
    </div>
  )

  const renderShop = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="font-bold text-lg">Catalogue de produits</h3>
        <Button className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> Ajouter un produit
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockProducts.map((prod) => (
          <Card key={prod.id} className="overflow-hidden shadow-sm">
            <CardContent className="p-4">
              <div className="h-32 bg-muted rounded-xl mb-4 flex items-center justify-center">
                <ShoppingBag size={32} className="text-muted-foreground/60" />
              </div>
              <h4 className="font-bold mb-1">{prod.name}</h4>
              <div className="flex justify-between items-center mt-4">
                <span className="font-semibold text-sm">{prod.price}</span>
                <span className="text-xs text-muted-foreground">Stock: {prod.stock}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderClients = () => (
    <div className="animate-in fade-in duration-500">
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Nom / Email</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Confirmé</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Inscrit le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="font-semibold">{client.name}</div>
                    <div className="text-sm text-muted-foreground">{client.email}</div>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant={client.plan === 'premium' ? 'default' : 'secondary'}>
                      {client.plan}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {client.confirmed ? (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle size={16} /> Oui
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <XCircle size={16} /> Non
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">{client.created}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )

  const renderInvoices = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="default" className="flex-1 sm:flex-none">Factures</Button>
          <Button variant="outline" className="flex-1 sm:flex-none">Devis</Button>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> Nouveau Document
        </Button>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Numéro</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Client</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Montant</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Statut</TableHead>
                <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="px-6 py-4 font-semibold">{inv.number}</TableCell>
                  <TableCell className="px-6 py-4">{inv.client}</TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="px-6 py-4 font-bold">{inv.amount}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant={inv.status === 'Payée' ? 'default' : 'secondary'}
                      className={
                        inv.status === 'Payée'
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Button variant="ghost" size="icon">
                      <Download size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )

  // ─── SWITCH PRINCIPAL ──────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard()
      case 'projects': return renderProjects()
      case 'categories': return renderCategories()
      case 'estimations': return renderEstimations()
      case 'shop': return renderShop()
      case 'clients': return renderClients()
      case 'invoices': return renderInvoices()
      default: return renderDashboard()
    }
  }

  const currentTabLabel = menuItems.find((m) => m.id === activeTab)?.label || 'Dashboard'
  const CurrentIcon = menuItems.find((m) => m.id === activeTab)?.icon || LayoutDashboard

  // ─── LAYOUT PRINCIPAL ──────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-card border-r flex flex-col shadow-sm z-10 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b">
          <div className="w-8 h-8 rounded bg-foreground flex items-center justify-center text-background font-bold text-xl">
            N
          </div>
          <h1 className="text-xl font-bold tracking-wider">
            NGnior<span className="text-muted-foreground">Bureau</span>
          </h1>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon size={20} className={isActive ? '' : ''} />
                <span className="text-sm">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50">
            <Settings size={20} />
            <span className="font-medium text-sm">Paramètres</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="px-6 md:px-8 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <CurrentIcon className="text-foreground" size={24} />
            </div>
            <h2 className="text-2xl font-bold">{currentTabLabel}</h2>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-10 w-10"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>

            <Button variant="outline" className="gap-2">
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </header>

        {/* DYNAMIC CONTENT AREA */}
        <ScrollArea className="flex-1">
          <div className="px-6 md:px-8 py-8">{renderContent()}</div>
        </ScrollArea>
      </main>
    </div>
  )
}
