'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, RefreshCw, X, Save, Loader2, AlertCircle,
  FolderOpen, Trash2, Edit2, Eye, Paperclip, Link2, DollarSign, Printer,
  FileText, Receipt, Search, CheckCircle, Bot, Settings2, FileJson, Download,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { kobaSupabase } from '@/lib/supabase-koba'

import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string; project_id: string; project_name?: string; project_custom_id?: string
  client_id?: string; client_name?: string; type: string; reference: string
  amount: number; date: string; notes?: string; status?: string; created_at?: string
}

interface LinkedInvoice {
  id: string; number: string; type: string; total: number; client_name?: string
}

interface ClientProject {
  id: string; custom_id: string; client_id: string; client_code: string
  client_name: string; type: string; designation: string
  invoice_id: string | null; date: string; status: string
  created_at?: string; total?: number; linked_invoices?: LinkedInvoice[]
  koba_account_id?: string | null
  koba_account_name?: string | null
  koba_account_type?: string | null
}

interface ClientOption { id: string; name: string; email: string; phone: string; client_code: string }
interface InvoiceOption { id: string; number: string; type: string; client_name: string; total: number; client_email?: string }
interface ProformaInvoice { id: string; number: string; client_name: string; client_email: string; total: number; items: Array<{ desc: string; qty: number; price: number }>; objet?: string }

const PROJECT_TYPES = [
  'Plan Architectural', 'Etude Ingénierie',
  'Plan Architectural et Etude Ingénierie', 'Construction', 'Suivi Contrôle', 'Autre',
]
const TYPE_COLORS: Record<string, string> = {
  'Plan Architectural': 'bg-blue-500/20 text-blue-300',
  'Etude Ingénierie': 'bg-purple-500/20 text-purple-300',
  'Plan Architectural et Etude Ingénierie': 'bg-indigo-500/20 text-indigo-300',
  'Construction': 'bg-orange-500/20 text-orange-300',
  'Suivi Contrôle': 'bg-emerald-500/20 text-emerald-300',
  'Autre': 'bg-gray-500/20 text-gray-300',
}
function fmt(n: number) { return n.toLocaleString('fr-FR') + ' F CFA' }

// ─── Number to words (French) ─────────────────────────────────────────────────

function numToWords(n: number): string {
  if (n === 0) return 'zéro'
  const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  const tensArr = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']
  function lt1000(x: number): string {
    if (x === 0) return ''
    if (x < 20) return ones[x]
    if (x < 100) {
      const t = Math.floor(x / 10), u = x % 10
      if (t === 7) return 'soixante-' + ones[10 + u]
      if (t === 8) return 'quatre-vingt' + (u === 0 ? '' : '-' + ones[u])
      if (t === 9) return 'quatre-vingt-' + ones[10 + u]
      return tensArr[t] + (u === 0 ? '' : (u === 1 ? '-et-un' : '-' + ones[u]))
    }
    const h = Math.floor(x / 100), r = x % 100
    return (h === 1 ? '' : ones[h] + '-') + 'cent' + (r === 0 && h > 1 ? 's' : '') + (r === 0 ? '' : '-' + lt1000(r))
  }
  let r = '', x = Math.round(n)
  if (x >= 1000000) { const m = Math.floor(x / 1000000); r += lt1000(m) + ' million' + (m > 1 ? 's' : '') + ' '; x %= 1000000 }
  if (x >= 1000) { const k = Math.floor(x / 1000); r += (k === 1 ? '' : lt1000(k) + '-') + 'mille '; x %= 1000 }
  r += lt1000(x)
  return r.trim()
}

const COLUMN_LABELS = {
  id: 'ID Projet',
  client: 'Client',
  type: 'Type',
  designation: 'Désignation',
  cost: 'Coût Total',
  versed: 'Versé',
  remaining: 'Reste',
  date: 'Date',
  status: 'Statut',
  koba: 'Versement (KOBA)',
  actions: 'Actions',
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ClientProjectsPage() {
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    id: false,
    client: false,
    type: false,
    designation: false,
    cost: false,
    versed: false,
    remaining: false,
    date: false,
    status: false,
    koba: false,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('client-projects-collapsed')
      if (saved) {
        try { setCollapsedColumns(JSON.parse(saved)) } catch { /* ignore */ }
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('client-projects-collapsed', JSON.stringify(collapsedColumns))
  }, [collapsedColumns])

  const renderCollapsibleHeader = (colKey: string, label: string, isRightAligned = false, isCentered = false) => {
    const isCollapsed = collapsedColumns[colKey]
    const toggle = (e: React.MouseEvent) => {
      e.stopPropagation()
      setCollapsedColumns(prev => ({ ...prev, [colKey]: !prev[colKey] }))
    }

    if (isCollapsed) {
      return (
        <TableHead className="px-1 py-2 text-center w-10 min-w-[40px] max-w-[40px] transition-all duration-300">
          <button 
            onClick={toggle}
            type="button"
            title={`Dérouler la colonne ${label}`}
            className="mx-auto flex items-center justify-center p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </TableHead>
      )
    }

    return (
      <TableHead className={`px-4 py-3 text-xs uppercase whitespace-nowrap transition-all duration-300 ${isRightAligned ? 'text-right' : isCentered ? 'text-center' : ''}`}>
        <div className={`flex items-center gap-1.5 ${isRightAligned ? 'justify-end' : isCentered ? 'justify-center' : 'justify-between'}`}>
          <span>{label}</span>
          <button 
            onClick={toggle}
            type="button"
            title={`Rabattre la colonne ${label}`}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </TableHead>
    )
  }

  const renderCollapsibleCell = (colKey: string, content: React.ReactNode, isRightAligned = false, className = "") => {
    const isCollapsed = collapsedColumns[colKey]
    if (isCollapsed) {
      return (
        <TableCell className="px-1 py-3 text-center w-10 min-w-[40px] max-w-[40px] transition-all duration-300 bg-muted/10" />
      )
    }
    return (
      <TableCell className={`px-4 py-3 transition-all duration-300 ${className} ${isRightAligned ? 'text-right' : ''}`}>
        {content}
      </TableCell>
    )
  }

  const [projects,         setProjects]         = useState<ClientProject[]>([])
  const [transactions,     setTransactions]     = useState<Transaction[]>([])
  const [clients,          setClients]          = useState<ClientOption[]>([])
  const [invoices,         setInvoices]         = useState<InvoiceOption[]>([])
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoice[]>([])
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState('')
  const [search,           setSearch]           = useState('')
  const [tableNotFound,    setTableNotFound]    = useState(false)

  const [kobaUser, setKobaUser] = useState<any>(null)
  const [kobaAccounts, setKobaAccounts] = useState<any[]>([])

  useEffect(() => {
    const checkKobaSession = async () => {
      const { data: { session } } = await kobaSupabase.auth.getSession()
      if (session?.user) {
        setKobaUser(session.user)
        try {
          const { data: pfData } = await kobaSupabase.from('portefeuilles').select('id, nom')
          const { data: prData } = await kobaSupabase.from('projets').select('id, nom')
          
          const accountsList = [
            ...(pfData || []).map(p => ({ id: p.id, nom: p.nom, type: 'portfolio' })),
            ...(prData || []).map(p => ({ id: p.id, nom: p.nom, type: 'project' }))
          ]
          setKobaAccounts(accountsList)
        } catch (err) {
          console.error('Error loading KOBA accounts:', err)
        }
      }
    }
    checkKobaSession()
  }, [])

  const handleKobaAccountChange = async (project: ClientProject, selectedAccountId: string) => {
    try {
      const selectedAcc = kobaAccounts.find(a => a.id === selectedAccountId)
      const nextKobaId = selectedAccountId || null
      const nextKobaName = selectedAcc ? selectedAcc.nom : null
      const nextKobaType = selectedAcc ? selectedAcc.type : null

      const res = await fetch(`/api/admin/client-projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          koba_account_id: nextKobaId,
          koba_account_name: nextKobaName,
          koba_account_type: nextKobaType
        })
      })
      const j = await res.json()
      if (!j.success) {
        alert("Erreur lors de la mise à jour du compte: " + j.error)
        return
      }

      setProjects(prev => prev.map(pr => pr.id === project.id ? {
        ...pr,
        koba_account_id: nextKobaId,
        koba_account_name: nextKobaName,
        koba_account_type: nextKobaType
      } : pr))

      const projectDesc = `${project.client_name} (${project.designation})`
      await kobaSupabase.from('transactions').delete().eq('description', projectDesc)

      if (nextKobaId) {
        const txs = transactions.filter(t => t.project_id === project.id)
        if (txs.length > 0) {
          const firstPortfolioId = kobaAccounts.find(a => a.type === 'portfolio')?.id || ''

          const kobaTxs = txs.map(t => {
            const pfId = nextKobaType === 'portfolio' ? nextKobaId : firstPortfolioId
            return {
              id: crypto.randomUUID(),
              user_id: kobaUser.id,
              local_uuid_owner: kobaUser.id,
              type: 'entree',
              montant: t.amount,
              portefeuille_id: pfId,
              projet_id: nextKobaType === 'project' ? nextKobaId : null,
              description: projectDesc,
              date_heure: new Date(t.date).toISOString(),
              updated_at: new Date().toISOString()
            }
          })

          const { error: kobaErr } = await kobaSupabase.from('transactions').insert(kobaTxs)
          if (kobaErr) {
            console.error('Error inserting transactions to KOBA:', kobaErr)
            alert("Projet lié avec succès, mais échec de la copie des transactions vers KOBA : " + kobaErr.message)
          }
        }
      }
    } catch (err: any) {
      console.error(err)
      alert("Erreur: " + err.message)
    }
  }

  const [clientFilter, setClientFilter] = useState<string>('Tout')
  const [clientSearch, setClientSearch] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)

  const [modalOpen,      setModalOpen]      = useState(false)
  const [editing,        setEditing]        = useState<ClientProject | null>(null)
  const [viewing,        setViewing]        = useState<ClientProject | null>(null)
  const [paymentProject, setPaymentProject] = useState<ClientProject | null>(null)
  const [docProject,     setDocProject]     = useState<ClientProject | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/admin/client-projects')
      const j = await r.json()
      if (j.tableNotFound) { setTableNotFound(true); setProjects([]) }
      else if (j.success) setProjects(j.data ?? [])
      else setError(j.error)
    } catch { setError('Erreur de connexion') }
    finally { setLoading(false) }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/project-transactions')
      const j = await r.json()
      if (j.success) setTransactions(j.data ?? [])
    } catch { /* silent */ }
  }, [])

  const fetchClients = useCallback(async () => {
    try { const r = await fetch('/api/admin/clients'); const j = await r.json(); if (j.success) setClients(j.data ?? []) } catch { /* */ }
  }, [])

  const fetchInvoices = useCallback(async () => {
    try { const r = await fetch('/api/admin/invoices?type=Facture'); const j = await r.json(); if (j.success) setInvoices(j.data ?? []) } catch { /* */ }
  }, [])

  const fetchProformas = useCallback(async () => {
    try { const r = await fetch('/api/admin/invoices?type=Facture Proforma'); const j = await r.json(); if (j.success) setProformaInvoices(j.data ?? []) } catch { /* */ }
  }, [])

  useEffect(() => { fetchProjects(); fetchTransactions(); fetchClients(); fetchInvoices(); fetchProformas() },
    [fetchProjects, fetchTransactions, fetchClients, fetchInvoices, fetchProformas])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function projTx(pid: string) { return transactions.filter((t) => t.project_id === pid) }
  function versedTotal(pid: string) { return projTx(pid).reduce((s, t) => s + (t.amount ?? 0), 0) }
  function remaining(p: ClientProject) { return (p.total ?? 0) - versedTotal(p.id) }

  const filtered = search
    ? projects.filter((p) => p.designation.toLowerCase().includes(search) || p.client_name.toLowerCase().includes(search) || p.custom_id.toLowerCase().includes(search))
    : projects

  const filteredByClient = clientFilter === 'Tout'
    ? filtered
    : filtered.filter(p => p.client_id === clientFilter)

  const selectedClientObjFilter = clientFilter !== 'Tout' ? clients.find(c => c.id === clientFilter) : null;
  const displayFilterValue = selectedClientObjFilter ? (selectedClientObjFilter.name || selectedClientObjFilter.email) : 'Tout';

  const filteredClients = clients.filter(c => 
    (c.name || c.email).toLowerCase().includes(clientSearch.toLowerCase())
  )

  const deleteProject = async (id: string) => {
    if (!confirm('Supprimer ce projet ?')) return
    await fetch(`/api/admin/client-projects/${id}`, { method: 'DELETE' })
    fetchProjects()
  }

  const totalProjects  = projects.length
  const activeProjects = projects.filter((p) => p.status === 'actif').length
  const typesCount     = new Map<string, number>()
  projects.forEach((p) => typesCount.set(p.type, (typesCount.get(p.type) ?? 0) + 1))

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-muted-foreground" /></div>
  if (error)   return <div className="flex flex-col items-center justify-center h-64 gap-3 text-destructive"><AlertCircle size={32} /><p>{error}</p><Button variant="outline" onClick={fetchProjects}>Réessayer</Button></div>

  if (tableNotFound) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <FolderOpen size={48} className="opacity-40" />
      <p className="font-medium">Table &quot;client_projects&quot; introuvable dans Supabase</p>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto max-w-2xl whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS plans.client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_id text, client_id text, client_code text, client_name text,
  type text, designation text, invoice_id uuid, date text,
  status text DEFAULT 'actif', created_at timestamptz DEFAULT now()
);`}</pre>
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total projets',       value: totalProjects,          color: 'text-blue-400' },
          { label: 'Actifs',              value: activeProjects,         color: 'text-emerald-400' },
          { label: 'Types différents',    value: typesCount.size,        color: 'text-purple-400' },
          { label: 'Clients avec projets',value: new Set(projects.map((p) => p.client_id)).size, color: 'text-orange-400' },
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-start gap-3 relative z-50">
        {/* Client Combobox */}
        <div className="relative w-full sm:w-72">
             <div className="relative flex items-center">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <Input 
                  value={isClientDropdownOpen ? clientSearch : (clientFilter === 'Tout' ? '' : displayFilterValue)}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    if (!isClientDropdownOpen) setIsClientDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setIsClientDropdownOpen(true);
                    setClientSearch('');
                  }}
                  onBlur={() => {
                    setTimeout(() => setIsClientDropdownOpen(false), 200);
                  }}
                  placeholder={clientFilter === 'Tout' ? "Filtrer par client..." : displayFilterValue}
                  className="pl-8 h-10 w-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-foreground focus-visible:border-input transition-all cursor-pointer"
                />
                {clientFilter !== 'Tout' && !isClientDropdownOpen && (
                  <button 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    onClick={(e) => { e.stopPropagation(); setClientFilter('Tout'); setClientSearch(''); }}
                  >
                    <X size={14} />
                  </button>
                )}
             </div>
             {isClientDropdownOpen && (
                <div className="absolute z-20 top-full mt-1 left-0 w-full bg-card border rounded-xl shadow-lg max-h-64 overflow-y-auto custom-scrollbar p-1">
                  <button 
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted/60 transition-colors ${clientFilter === 'Tout' ? 'font-semibold bg-muted/40' : ''}`}
                    onMouseDown={() => { setClientFilter('Tout'); setIsClientDropdownOpen(false); }}
                  >
                    Tous les clients
                  </button>
                  {filteredClients.map(c => {
                    const val = c.name || c.email;
                    const isSelected = clientFilter === c.id;
                    return (
                      <button 
                        key={c.id}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between ${isSelected ? 'font-semibold bg-muted/40' : ''}`}
                        onMouseDown={() => { setClientFilter(c.id); setIsClientDropdownOpen(false); }}
                      >
                        <div className="flex flex-col pr-2 overflow-hidden">
                          <span className="truncate">{val}</span>
                          {c.name && c.email && c.name !== c.email && (
                            <span className="text-[10px] text-muted-foreground truncate leading-tight">{c.email}</span>
                          )}
                        </div>
                        {isSelected && <CheckCircle size={14} className="text-foreground shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredClients.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun client trouvé</div>
                  )}
                </div>
              )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par projet, ID…" className="w-full pl-9" />
          </div>

          <div className="flex gap-2 items-center shrink-0">
            <Button variant="outline" onClick={() => { fetchProjects(); fetchTransactions() }} className="gap-2 h-10">
              <RefreshCw size={14} /> Actualiser
            </Button>
            <Button onClick={() => { setEditing(null); setModalOpen(true) }} className="gap-2 h-10">
              <Plus size={16} /> Nouveau projet
            </Button>
          </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm overflow-hidden w-full max-w-full">
        <CardContent className="p-0 overflow-x-auto">
          <Table 
            style={{ 
              minWidth: (() => {
                let width = 150 // actions
                width += collapsedColumns.id ? 40 : 120
                width += collapsedColumns.client ? 40 : 180
                width += collapsedColumns.type ? 40 : 180
                width += collapsedColumns.designation ? 40 : 220
                width += collapsedColumns.cost ? 40 : 110
                width += collapsedColumns.versed ? 40 : 110
                width += collapsedColumns.remaining ? 40 : 110
                width += collapsedColumns.date ? 40 : 100
                width += collapsedColumns.status ? 40 : 90
                width += collapsedColumns.koba ? 40 : 160
                return `${width}px`
              })() 
            }} 
            className="w-full"
          >
            <TableHeader>
              <TableRow>
                {renderCollapsibleHeader('id', 'ID Projet')}
                {renderCollapsibleHeader('client', 'Client')}
                {renderCollapsibleHeader('type', 'Type')}
                {renderCollapsibleHeader('designation', 'Désignation')}
                {renderCollapsibleHeader('cost', 'Coût Total', true)}
                {renderCollapsibleHeader('versed', 'Versé', true)}
                {renderCollapsibleHeader('remaining', 'Reste', true)}
                {renderCollapsibleHeader('date', 'Date')}
                {renderCollapsibleHeader('status', 'Statut', false, true)}
                {renderCollapsibleHeader('koba', 'Versement (KOBA)')}
                <TableHead className="px-4 py-3 text-xs uppercase whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredByClient.length === 0
                ? <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Aucun projet client.</TableCell></TableRow>
                : filteredByClient.map((p) => {
                  const versed = versedTotal(p.id)
                  const rest   = (p.total ?? 0) - versed
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      {renderCollapsibleCell('id', p.custom_id, false, "font-mono text-xs font-semibold whitespace-nowrap")}
                      {renderCollapsibleCell('client', (
                        <>
                          <p className="font-semibold text-sm">{p.client_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{p.client_code}</p>
                        </>
                      ))}
                      {renderCollapsibleCell('type', (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${TYPE_COLORS[p.type] ?? TYPE_COLORS['Autre']}`}>{p.type}</span>
                      ))}
                      {renderCollapsibleCell('designation', p.designation, false, "text-sm max-w-xs truncate")}
                      {renderCollapsibleCell('cost', p.total ? fmt(p.total) : '—', true, "text-sm font-semibold")}
                      {renderCollapsibleCell('versed', versed > 0 ? fmt(versed) : '—', true, "text-sm text-blue-400 font-semibold")}
                      {renderCollapsibleCell('remaining', (
                        <span className={rest > 0 ? 'text-red-400' : rest === 0 && versed > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>
                          {p.total ? fmt(rest) : '—'}
                        </span>
                      ), true, "text-sm font-bold")}
                      {renderCollapsibleCell('date', p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—', false, "text-sm text-muted-foreground")}
                      {renderCollapsibleCell('status', (
                        <Badge variant={p.status === 'actif' ? 'default' : 'secondary'} className="text-xs">
                          {p.status === 'actif' ? 'Actif' : p.status}
                        </Badge>
                      ), false, "text-center")}
                      {renderCollapsibleCell('koba', (
                        kobaUser ? (
                          <select
                            value={p.koba_account_id || ''}
                            onChange={(e) => handleKobaAccountChange(p, e.target.value)}
                            className="text-xs bg-background/50 border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px]"
                          >
                            <option value="">Compte NGnior</option>
                            {kobaAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.nom} ({acc.type === 'portfolio' ? 'Porte.' : 'Proj.'})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Non connecté à KOBA</span>
                        )
                      ))}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-400 hover:text-emerald-300" title="Versement" onClick={() => setPaymentProject(p)}>
                            <DollarSign size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-400 hover:text-blue-300" title="Documents / Reçu" aria-label="Voir la facture" onClick={() => setDocProject(p)}>
                            <Printer size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Détails" aria-label="Voir le projet" onClick={() => setViewing(p)}>
                            <Eye size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Modifier" aria-label="Modifier le projet" onClick={() => { setEditing(p); setModalOpen(true) }}>
                            <Edit2 size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Supprimer" aria-label="Supprimer le projet" onClick={() => deleteProject(p.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── View Modal ─────────────────────────────────────────────────────────── */}
      {viewing && (
        <Modal title={`Détails — ${viewing.custom_id}`} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <InfoRow label="ID Projet"   value={viewing.custom_id} mono />
            <InfoRow label="Client"      value={`${viewing.client_name} (${viewing.client_code})`} />
            <InfoRow label="Type"        value={viewing.type} />
            <InfoRow label="Désignation" value={viewing.designation} />
            <InfoRow label="Date"        value={viewing.date ? new Date(viewing.date).toLocaleDateString('fr-FR') : '—'} />
            <InfoRow label="Statut"      value={viewing.status} />
            {viewing.invoice_id && <InfoRow label="Facture liée" value={viewing.invoice_id} mono />}
            {viewing.total !== undefined && viewing.total > 0 && (
              <>
                <InfoRow label="Coût total" value={fmt(viewing.total)} />
                <InfoRow label="Total versé"    value={fmt(versedTotal(viewing.id))} />
                <InfoRow label="Reste à payer"  value={fmt(remaining(viewing))} />
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Create / Edit Modal ────────────────────────────────────────────────── */}
      {modalOpen && (() => {
        const selectedClientFromFilter = clientFilter !== 'Tout' ? clientFilter : undefined;
        return (
          <ProjectFormModal
            editing={editing} initialClientId={selectedClientFromFilter} clients={clients} invoices={invoices} proformaInvoices={proformaInvoices}
            onClose={() => setModalOpen(false)}
            onSaved={() => { setModalOpen(false); fetchProjects(); fetchInvoices() }}
          />
        );
      })()}

      {/* ── Payment Modal ──────────────────────────────────────────────────────── */}
      {paymentProject && (
        <PaymentModal
          project={paymentProject}
          onClose={() => setPaymentProject(null)}
          onSaved={() => { setPaymentProject(null); fetchProjects(); fetchTransactions() }}
          onChanged={() => { fetchProjects(); fetchTransactions() }}
        />
      )}

      {/* ── Doc / Receipt Modal ───────────────────────────────────────────────── */}
      {docProject && (
        <DocModal
          project={docProject}
          transactions={projTx(docProject.id)}
          onClose={() => setDocProject(null)}
        />
      )}
    </div>
  )
}

// ─── Info Row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-muted/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[60%] truncate ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  )
}

// ─── Modal Wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-card border rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Doc / Receipt Modal ───────────────────────────────────────────────────────

function DocModal({ project, transactions, onClose }: {
  project: ClientProject
  transactions: Transaction[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<'factures' | 'recus'>('factures')
  const [linkedInvoice, setLinkedInvoice] = useState<any | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!project.invoice_id) return
    fetch('/api/admin/invoices')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const found = (j.data ?? []).find((d: any) => d.id === project.invoice_id)
          setLinkedInvoice(found ?? null)
        }
      })
      .catch(() => { /* silent */ })
  }, [project.invoice_id])
  const versed  = transactions.reduce((s, t) => s + (t.amount ?? 0), 0)
  const rest    = (project.total ?? 0) - versed

  async function toBase64(url: string): Promise<string> {
    try {
      const r = await fetch(url); const b = await r.blob()
      return await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b) })
    } catch { return '' }
  }

  async function generateInvoiceHtml(inv: any, print = false): Promise<string> {
    const base = window.location.origin
    const [logo64, sig64, stamp64] = await Promise.all([
      toBase64(base + '/ngnior-logo.png'),
      toBase64(base + '/signature.png'),
      toBase64(base + '/tampon.png'),
    ])

    const itemsList = inv.items || []
    const rows = itemsList.map((i: any) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #ddd">${i.desc}</td>
        <td style="text-align:center;padding:7px 10px;border-bottom:1px solid #ddd">${Number(i.qty)}</td>
        <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${Number(i.price).toLocaleString('fr-FR')} F CFA</td>
        <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${(Number(i.qty)*Number(i.price)).toLocaleString('fr-FR')} F CFA</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${inv.type} ${inv.number}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#fff;width:210mm;min-height:297mm;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:0;display:flex;flex-direction:column}
  .header{background:#000;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:12px 20px}
  .header-logo img{height:60px;object-fit:contain}
  .header-title{text-align:right}
  .header-title h1{font-size:28px;font-weight:900;letter-spacing:1px;margin-bottom:2px}
  .header-title .ref{font-size:12px}
  .company{padding:10px 20px 8px}
  .company h2{font-size:14px;font-weight:bold}
  .company p{font-size:10px;color:#444;line-height:1.6}
  .company a{color:#0066cc;text-decoration:none}
  hr.divider{border:none;border-top:2px solid #000;margin:0 20px}
  .client-block{padding:10px 20px}
  .client-block h4{font-size:10px;font-weight:bold;text-decoration:underline;margin-bottom:4px}
  .client-block p{font-size:10px;line-height:1.8}
  .items-table{width:calc(100% - 40px);margin:6px 20px;border-collapse:collapse}
  .items-table thead tr{background:#000;color:#fff}
  .items-table thead th{padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  .items-table thead th:nth-child(2){text-align:center}
  .items-table thead th:nth-child(3),.items-table thead th:nth-child(4){text-align:right}
  .items-table tbody tr:nth-child(even){background:#f9f9f9}
  .items-table tbody td{font-size:10px}
  .totals{margin:6px 20px 0 auto;width:280px}
  .totals table{width:100%;border-collapse:collapse}
  .totals td{padding:5px 8px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row{font-weight:bold;font-size:13px;border-top:2px solid #000;background:#eee}
  .notes{padding:10px 20px;font-style:italic;color:#555;font-size:10px;border-top:1px solid #ccc;margin-top:8px}
  .sign-area{display:flex;justify-content:space-between;align-items:flex-end;padding:16px 40px 10px}
  .sign-block{text-align:center}
  .sign-block img{height:80px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold;margin-top:4px}
  .sign-block span{font-size:10px;color:#444}
  .page-footer{margin-top:30px;background:#fff;color:#000;padding:10px 20px 20px;font-size:11px;border-top:3px solid #000;line-height:1.6;}
  .page-footer a{color:#000;text-decoration:none}
  .print-bar{display:flex;gap:10px;justify-content:center;padding:16px;background:#f0f0f0;border-bottom:1px solid #ddd}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold}
  .btn-pdf{background:#000;color:#fff}
  .btn-close{background:#eee;color:#333}
  @media print{.print-bar{display:none!important}body,html{width:210mm}@page{margin:0}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn btn-pdf" onclick="window.print()">⬇ Télécharger / Imprimer PDF</button>
</div>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="NGnior Conception">` : '<span style="font-size:22px;font-weight:900">NGnior</span>'}</div>
    <div class="header-title">
      <h1>${(inv.type || 'FACTURE').toUpperCase()}</h1>
      <div class="ref">N° : <strong>${inv.number}</strong></div>
      <div class="ref">Date : ${inv.date ? new Date(inv.date).toLocaleDateString('fr-FR') : ''}</div>
    </div>
  </div>

  <!-- COMPANY INFO -->
  <div class="company">
    <h2>Ngnior Conception</h2>
    <p>Conception - Suivi - Réalisation<br>Ouagadougou, Burkina Faso<br><a href="https://www.ngniorconception.com">www.ngniorconception.com</a></p>
  </div>
  <hr class="divider">

  <!-- CLIENT -->
  <div class="client-block">
    <h4>ADRESSÉE À :</h4>
    <p>${(inv.client_name?.startsWith('M. ') || inv.client_name?.startsWith('Mme ')) ? inv.client_name : 'M./Mme ' + (inv.client_name || '—')}<br>
    ${inv.client_email ? `Email : ${inv.client_email}<br>` : ''}
    ${inv.client_phone ? `Tél : ${inv.client_phone}<br>` : ''}
    ${inv.client_address ? `${inv.client_address}` : ''}
    </p>
  </div>
  ${inv.objet ? `<div style="padding:4px 20px 6px;font-size:10px"><strong>Objet :</strong> ${inv.objet}</div>` : ''}

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead><tr>
      <th style="width:55%">DÉSIGNATION</th>
      <th style="width:8%">QTÉ</th>
      <th style="width:19%">PRIX UNIT.</th>
      <th style="width:18%">TOTAL</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- TOTALS -->
  <div class="totals">
    <table>
      <tr><td>SOUS-TOTAL HT :</td><td>${(inv.total_ht || 0).toLocaleString('fr-FR')} F CFA</td></tr>
      <tr><td>TVA (${inv.tva_rate || '18 %'}) :</td><td>${(inv.total_tva || 0).toLocaleString('fr-FR')} F CFA</td></tr>
      <tr class="total-row"><td><strong>TOTAL TTC :</strong></td><td><strong>${(inv.total || 0).toLocaleString('fr-FR')} F CFA</strong></td></tr>
    </table>
  </div>

  <!-- NOTES -->
  ${inv.notes ? `<div class="notes">${inv.notes.replace(/\n/g,'<br>')}</div>` : ''}

  <!-- SIGNATURE & STAMP -->
  <div class="sign-area">
    <div></div>
    <div style="display:flex; align-items:flex-end;">
      <div class="sign-block" style="margin-right: -10px; z-index: 2; position: relative;">
        ${sig64 ? `<img src="${sig64}" alt="Signature">` : ''}
        <p>Le Directeur</p>
        <span>SANOU Mohamed Yacine</span>
      </div>
      <div class="sign-block" style="z-index: 1; position: relative;">
        ${stamp64 ? `<img src="${stamp64}" alt="Cachet" style="margin-bottom: -15px;">` : ''}
      </div>
    </div>
  </div>

  <!-- PAGE FOOTER -->
  <div class="page-footer">
    <div style="word-spacing: 6px;">Société à Responsabilité Limité &nbsp;&nbsp;&nbsp;&nbsp; ngniorconceptions@gmail.com &nbsp; www.ngniorconception.com</div>
    <div>RCCM : BFOUA2019B1915 IF : 00117306P |+226 56 88 65 05 | +226 71 35 33 75 |</div>
  </div>
</div>
${print ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body></html>`
    return html;
  }

  async function generateReceiptHtml(print = false): Promise<string> {
    const base    = window.location.origin
    const logo64  = await toBase64(base + '/ngnior-logo.png')
    const sig64   = await toBase64(base + '/signature.png')
    const stamp64 = await toBase64(base + '/tampon.png')

    const now     = new Date()
    const year2   = now.getFullYear().toString().slice(2)
    const recuNum = `R-${year2}-${project.custom_id}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
    const dateStr = now.toLocaleDateString('fr-FR')

    const txRows = transactions.map((t) => `
      <tr>
        <td>${t.date ? new Date(t.date).toLocaleDateString('fr-FR') : '—'}</td>
        <td>${t.reference}</td>
        <td>${t.notes || project.designation}</td>
        <td style="text-align:right">${(t.amount ?? 0).toLocaleString('fr-FR')}</td>
      </tr>`).join('')

    const words = numToWords(Math.round(versed)) + ' francs CFA'

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Reçu ${recuNum}</title>
<style>
  @page { size: A4 portrait; margin: 0 }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#fff;width:210mm;min-height:297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:0;display:flex;flex-direction:column}
  .header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:2px solid #000}
  .header-logo img{height:64px;object-fit:contain}
  .header-company{text-align:right}
  .header-company h2{font-size:15px;font-weight:900;color:#0055aa;margin-bottom:2px}
  .header-company p{font-size:9px;color:#555}
  .title-bar{text-align:center;padding:14px;background:#f5f5f5;border-bottom:1px solid #ddd}
  .title-bar h1{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
  .meta{display:flex;justify-content:space-between;padding:10px 24px;border-bottom:1px solid #eee;font-size:10px}
  .meta span{color:#555}.meta strong{color:#000}
  .client-box{margin:12px 24px;border:1px solid #ddd;border-radius:4px;padding:10px 14px;font-size:10px;background:#fafafa}
  .client-box p{margin-bottom:3px}.client-box span.lbl{color:#0055aa;font-weight:bold;margin-right:6px}
  .project-box{margin:0 24px 10px;border:1px solid #0055aa30;border-radius:4px;padding:10px 14px;font-size:10px;background:#f0f5ff}
  .project-box p{margin-bottom:3px;color:#0044aa}
  table.tx{width:calc(100% - 48px);margin:0 24px;border-collapse:collapse}
  table.tx thead tr{background:#000;color:#fff}
  table.tx thead th{padding:7px 10px;font-size:10px;text-align:left;letter-spacing:.5px}
  table.tx thead th:last-child{text-align:right}
  table.tx tbody td{padding:7px 10px;border-bottom:1px solid #eee;font-size:10px}
  table.tx tbody td:last-child{text-align:right;font-weight:bold}
  .totals{margin:8px 24px 0;border-top:2px solid #000}
  .totals table{width:220px;margin-left:auto}
  .totals td{padding:5px 8px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row td{font-weight:bold;background:#e8f4e8;color:#006600}
  .totals .rest-row td{font-weight:bold;background:#fde8e8;color:#cc0000;font-size:12px}
  .arrete{margin:10px 24px;font-style:italic;font-size:10px;color:#333;border-top:1px dashed #ccc;padding-top:8px}
  .sign-area{display:flex;justify-content:flex-end;align-items:flex-end;padding:16px 40px 8px;margin-top:10px}
  .sign-block{text-align:center;min-width:120px}
  .sign-block .line{border-top:1px solid #333;margin-bottom:4px;margin-top:60px}
  .sign-block img{height:72px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold}
  .footer{margin-top:30px;background:#fff;color:#000;padding:10px 20px 20px;font-size:11px;border-top:3px solid #000;line-height:1.6;}
  .footer a{color:#000;text-decoration:none}
  .print-bar{display:flex;gap:10px;justify-content:center;padding:14px;background:#f0f0f0;border-bottom:1px solid #ccc}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold}
  .btn-pdf{background:#000;color:#fff}.btn-close{background:#eee;color:#333}
  @media print{.print-bar{display:none!important}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn btn-pdf" onclick="window.print()">⬇ Imprimer / PDF</button>
</div>
<div class="page">
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="NGnior">` : '<span style="font-size:18px;font-weight:900">NGnior</span>'}</div>
    <div class="header-company">
      <h2>NGnior Conception</h2>
      <p>Service : Conception - Etude - Suivi contrôle – construction</p>
      <p>Date: ${dateStr}</p>
    </div>
  </div>

  <div class="title-bar"><h1>Reçu de Paiement</h1></div>

  <div class="meta">
    <span>Reçu N° : <strong>${recuNum}</strong></span>
    <span>Projet Réf. : <strong>${project.custom_id}</strong></span>
  </div>

  <div class="client-box">
    <p><span class="lbl">Entreprise :</span>NGnior Conception</p>
    <p><span class="lbl">Client Réf. :</span>${project.client_code}</p>
    <p><span class="lbl">Doit :</span>${project.client_name}</p>
  </div>

  <div class="project-box">
    <p><strong>Projet Associé :</strong> ${project.designation} (${project.type})</p>
    ${project.total ? `<p><strong>Coût total du projet :</strong> ${project.total.toLocaleString('fr-FR')} Fcfa</p>` : ''}
  </div>

  <p style="padding:8px 24px 4px;font-size:10px;font-weight:bold;">Détail des paiements reçus pour ce projet :</p>

  <table class="tx">
    <thead><tr>
      <th>Date</th><th>Référence Transaction</th><th>Désignation</th><th>Montant (Fcfa)</th>
    </tr></thead>
    <tbody>${txRows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:12px">Aucun versement enregistré</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Total Reçu :</td><td>${versed.toLocaleString('fr-FR')} Fcfa</td></tr>
      ${project.total ? `<tr class="rest-row"><td>Reste à Payer :</td><td>${rest.toLocaleString('fr-FR')} Fcfa</td></tr>` : ''}
    </table>
  </div>

  ${versed > 0 ? `<div class="arrete"><em>Arrêté le présent reçu à la somme totale des paiements de : <strong>${words}</strong>.</em></div>` : ''}

  <div class="sign-area">
    <div style="display:flex; align-items:flex-end;">
      <div class="sign-block" style="position: relative; z-index: 2; margin-right: -40px;">
        <div class="line"></div>
        <p>Le Gérant</p>
        ${sig64 ? `<img src="${sig64}" alt="Signature" style="margin-top:-50px;position:relative;z-index:2">` : ''}
      </div>
      <div class="sign-block" style="position: relative; z-index: 1;">
        ${stamp64 ? `<img src="${stamp64}" alt="Cachet" style="margin-bottom: -15px;">` : ''}
      </div>
    </div>
  </div>

  <div class="footer">
    <div style="word-spacing: 6px;">Société à Responsabilité Limité &nbsp;&nbsp;&nbsp;&nbsp; ngniorconceptions@gmail.com &nbsp; www.ngniorconception.com</div>
    <div>RCCM : BFOUA2019B1915 IF : 00117306P |+226 56 88 65 05 | +226 71 35 33 75 |</div>
  </div>
</div>
${print ? '<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>' : ''}
</body></html>`
    return html;
  }

  async function openInvoicePreview() {
    if (!linkedInvoice) return;
    const html = await generateInvoiceHtml(linkedInvoice, false);
    const blob = new Blob([html], { type: 'text/html' })
    setPreviewUrl(URL.createObjectURL(blob))
  }

  async function openReceiptPreview() {
    const html = await generateReceiptHtml(false);
    const blob = new Blob([html], { type: 'text/html' })
    setPreviewUrl(URL.createObjectURL(blob))
  }

  async function printReceipt() {
    const html = await generateReceiptHtml(true);
    const blob = new Blob([html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  function fmt(val: number) { return val.toLocaleString('fr-FR') + ' F CFA' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <h3 className="font-bold text-lg">📄 {project.custom_id} — {project.client_name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 px-5 pt-4 shrink-0">
          <button onClick={() => setTab('factures')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'factures' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            <FileText size={14} /> Factures
          </button>
          <button onClick={() => setTab('recus')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'recus' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            <Receipt size={14} /> Reçus / Versements
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* ── Factures tab ──────────────────────────────────────────────────── */}
          {tab === 'factures' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Facture liée au projet</p>
              {linkedInvoice ? (
                <>
                  <div 
                    className="bg-muted/40 border rounded-xl p-4 space-y-2 cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={openInvoicePreview}
                    title="Cliquez pour afficher un aperçu de la facture"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm font-semibold">{linkedInvoice.number}</span>
                      <Badge>{linkedInvoice.type}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Client :</span>
                      <span>{linkedInvoice.client_name || '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2 mt-1">
                      <span>Montant TTC :</span>
                      <span className="text-emerald-400">{fmt(linkedInvoice.total)}</span>
                    </div>
                    <p className="text-center text-xs text-muted-foreground pt-2 flex items-center justify-center gap-1">
                      <Eye size={12} /> Cliquez pour voir l'aperçu complet
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <Button onClick={() => {
                        localStorage.setItem('ngbureau_edit_invoice', linkedInvoice.id);
                        window.dispatchEvent(new CustomEvent('switchTab', { detail: 'invoices' }));
                        window.dispatchEvent(new Event('checkInvoiceEdit'));
                        onClose();
                    }} variant="outline" className="flex-1 gap-2 border-foreground hover:bg-foreground hover:text-background">
                      <Edit2 size={15} /> Éditer la Facture
                    </Button>
                    <Button onClick={openInvoicePreview} variant="outline" className="flex-1 gap-2 border-foreground hover:bg-foreground hover:text-background">
                      <Eye size={15} /> Aperçu
                    </Button>
                    <Button onClick={async () => {
                        const html = await generateInvoiceHtml(linkedInvoice, true);
                        const blob = new Blob([html], { type: 'text/html' })
                        window.open(URL.createObjectURL(blob), '_blank')
                      }} 
                      className="flex-1 gap-2 bg-foreground text-background hover:bg-foreground/90"
                    >
                      <Printer size={15} /> Télécharger (PDF)
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucune facture liée à ce projet.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Reçus tab ────────────────────────────────────────────────────── */}
          {tab === 'recus' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase font-bold">Historique des versements</p>

              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucun versement enregistré.</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Réf.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground uppercase">Notes</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-muted-foreground uppercase">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground">{t.date ? new Date(t.date).toLocaleDateString('fr-FR') : '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{t.reference}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[120px]">{t.notes || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold text-blue-400">{fmt(t.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Récapitulatif */}
              <div className="bg-muted/30 border rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Coût total du projet :</span>
                  <span className="font-semibold">{project.total ? fmt(project.total) : '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total versé :</span>
                  <span className="font-semibold text-blue-400">{fmt(versed)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Reste à payer :</span>
                  <span className={rest > 0 ? 'text-red-400' : 'text-emerald-400'}>{project.total ? fmt(rest) : '—'}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button onClick={openReceiptPreview} variant="outline" className="flex-1 gap-2 border-foreground hover:bg-foreground hover:text-background">
                  <Eye size={15} /> Aperçu rapide
                </Button>
                <Button
                  onClick={() => window.open(`/api/admin/client-projects/${project.id}/recu`, '_blank')}
                  disabled={versed <= 0}
                  title={versed <= 0 ? 'Aucun versement enregistré — rien à reçuter' : 'Génère (ou récupère) le reçu officiel R-26-N, numéroté et archivé dans les documents'}
                  className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Receipt size={15} /> Reçu officiel (PDF)
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Le <strong>Reçu officiel</strong> est numéroté (R-26-…), enregistré dans « Factures &amp; Devis »
                et identique à celui envoyé par le bot WhatsApp. Si aucun nouveau versement, le reçu existant est réutilisé.
              </p>
            </div>
          )}
        </div>

        <div className="p-5 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full">Fermer</Button>
        </div>

        {/* ── Modal d'aperçu Iframe ── */}
        {previewUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewUrl(null)}>
            <div className="bg-card border rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden relative" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-3 border-b shrink-0 bg-muted/30">
                <h3 className="font-bold text-sm">Aperçu du Document</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, '_blank')} className="text-xs h-8">
                    Ouvrir & Télécharger (PDF)
                  </Button>
                  <button onClick={() => setPreviewUrl(null)} className="p-1 hover:bg-muted rounded"><X size={18} /></button>
                </div>
              </div>
              <iframe src={previewUrl} className="w-full flex-1 bg-white" title="Aperçu" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const DEFAULT_AI_PROMPT = `Tu es un assistant commercial pour NGMarket Marketplace, fournisseur de matériaux de construction au Burkina Faso.
Génère les lignes d'articles pour ce document commercial :
- Type de document : {doc_type}
- Objet            : {objet}
- Client           : {client}

Retourne UNIQUEMENT le résultat au format strict ci-dessous, sans texte avant ni après :
{(Description;Quantité;Prix_unitaire_FCFA;Prix_total_FCFA);(…);(…)}

Exemples :
{(Ciment CPA 45 – Sac 50kg;10;5750;57500);(Sable fin – m³;5;15000;75000);(Fer à béton HA10 – barre;20;3500;70000)}

Règles :
- Séparateur entre champs : point-virgule (;)
- Prix en chiffres entiers, sans espace ni symbole
- Quantités réalistes pour le secteur construction
- 3 à 6 lignes selon l'objet`

const DEFAULT_DESIG_PROMPT = `Tu es un assistant expert en rédaction de documents professionnels. 
Reformule la description de ce projet de manière très professionnelle, claire et concise, pour qu'elle puisse figurer sur un devis ou une facture officielle.
Projet saisi : "{projet}"

Retourne UNIQUEMENT la reformulation, sans guillemets, sans texte avant ni après.
Exemple :
Saisie : "batiment r+1"
Retour : Projet de construction d'un bâtiment R+1 à usage d'habitation`

const STORAGE_KEY = 'ngbureau_doc_models'

function ProjectFormModal({ editing, initialClientId, clients, invoices, proformaInvoices, onClose, onSaved }: {
  editing: ClientProject | null; initialClientId?: string; clients: ClientOption[]; invoices: InvoiceOption[]
  proformaInvoices: ProformaInvoice[]; onClose: () => void; onSaved: () => void
}) {
  const [selectedClient, setSelectedClient] = useState(editing?.client_id ?? initialClientId ?? '')
  const [type,        setType]        = useState(editing?.type ?? '')
  const [designation, setDesignation] = useState(editing?.designation ?? '')
  const [date,        setDate]        = useState(editing?.date ? editing.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  
  // Invoice logic
  const [invoiceType, setInvoiceType] = useState('Facture')
  const [items,   setItems]   = useState<{desc: string; qty: number; price: number}[]>([{ desc: '', qty: 1, price: 0 }])
  const [tva,     setTva]     = useState('18 %')
  const [notes,   setNotes]   = useState('Paiement à la signature du contrat.\nMerci de votre confiance.')

  const [saving,      setSaving]      = useState(false)
  const [err,         setErr]         = useState('')

  const [deepseekKey, setDeepseekKey] = useState('')
  const [glmKey,      setGlmKey]      = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiProcessingStatus, setAiProcessingStatus] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeepseekKey(localStorage.getItem('deepseek_api_key') || '')
      setGlmKey(localStorage.getItem('glm_api_key') || '')
    }
  }, [])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const formEl = document.getElementById('project-form')
      if (!formEl) return

      const items = e.clipboardData?.items;
      const files = e.clipboardData?.files;
      
      let hasImage = false;
      let imageFile: File | null = null;
      let textContent = '';

      // 1. Check files list first (robust for explorer copy & screenshots)
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            hasImage = true;
            imageFile = file;
            break;
          }
        }
      }

      // 2. Check items if no file found
      if (!hasImage && items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            hasImage = true;
            imageFile = item.getAsFile();
            break;
          }
        }
      }

      // 3. Fallback to text
      if (!hasImage && e.clipboardData) {
        textContent = e.clipboardData.getData('text') || '';
      }

      if (hasImage && imageFile) {
        e.preventDefault();
        const glmKeyLocal = localStorage.getItem('glm_api_key') || ''
        if (!glmKeyLocal) {
          alert("Veuillez d'abord configurer votre clé API GLM dans les paramètres IA.")
          return
        }
        setIsAiProcessing(true)
        setAiProcessingStatus("Extraction du texte de l'image (OCR GLM)...")
        
        try {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64data = reader.result as string
            try {
              const res = await fetch('/api/admin/glm-ocr', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-GLM-Key': glmKeyLocal
                },
                body: JSON.stringify({ image: base64data })
              })
              const j = await res.json()
              if (!j.success) {
                alert("Erreur OCR GLM : " + j.error)
                setIsAiProcessing(false)
                return
              }

              setAiProcessingStatus("Interprétation du devis/DQE par DeepSeek...")
              const parseRes = await fetch('/api/admin/ai-parse-articles', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-DeepSeek-Key': localStorage.getItem('deepseek_api_key') || ''
                },
                body: JSON.stringify({ text: j.text })
              })
              const parseJ = await parseRes.json()
              if (parseJ.success && Array.isArray(parseJ.items)) {
                setItems(parseJ.items)
              } else {
                alert("Erreur d'interprétation DeepSeek : " + (parseJ.error || "Format non reconnu"))
              }
            } catch (err: any) {
              alert("Erreur : " + err.message)
            } finally {
              setIsAiProcessing(false)
            }
          }
          reader.readAsDataURL(imageFile)
        } catch (err: any) {
          alert("Erreur lors de la lecture de l'image : " + err.message)
          setIsAiProcessing(false)
        }
      } else if (textContent && textContent.trim().length > 10) {
        const activeEl = document.activeElement;
        const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
        
        if (!isInput || textContent.includes('\n') || textContent.includes(';')) {
          e.preventDefault();
          setIsAiProcessing(true)
          setAiProcessingStatus("Interprétation du devis/DQE collé par DeepSeek...")
          try {
            const parseRes = await fetch('/api/admin/ai-parse-articles', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-DeepSeek-Key': localStorage.getItem('deepseek_api_key') || ''
              },
              body: JSON.stringify({ text: textContent })
            })
            const parseJ = await parseRes.json()
            if (parseJ.success && Array.isArray(parseJ.items)) {
              setItems(parseJ.items)
            } else {
              alert("Erreur d'interprétation DeepSeek : " + (parseJ.error || "Format non reconnu"))
            }
          } catch (err: any) {
            alert("Erreur réseau : " + err.message)
          } finally {
            setIsAiProcessing(false)
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // AI & Models
  const [aiPrompt,    setAiPrompt]    = useState(DEFAULT_AI_PROMPT)
  const [showAIPaste, setShowAIPaste] = useState(false)
  const [showPrompt,  setShowPrompt]  = useState(false)

  const [desigPrompt,    setDesigPrompt]    = useState(DEFAULT_DESIG_PROMPT)
  const [showDesigPrompt,  setShowDesigPrompt]  = useState(false)
  const [isGeneratingDesig, setIsGeneratingDesig] = useState(false)

  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const [showModels,    setShowModels]    = useState(false)
  const [modelName,     setModelName]     = useState('')
  const [showSaveModel, setShowSaveModel] = useState(false)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  const selectedClientObj = clients.find((c) => c.id === selectedClient)

  useEffect(() => {
    if (editing?.invoice_id) {
      const fetchInvoice = async () => {
        try {
          const r = await fetch(`/api/admin/invoices?id=${editing.invoice_id}`)
          const j = await r.json()
          if (j.success && j.data) {
            const doc = j.data
            setInvoiceType(doc.type || 'Facture')
            setTva(doc.tva_rate || '18 %')
            setNotes(doc.notes || '')
            if (Array.isArray(doc.items)) {
              setItems(doc.items.map((i: any) => ({
                desc: i.desc || i.description || '',
                qty: Number(i.qty) || 1,
                price: Number(i.price) || 0
              })))
            }
          }
        } catch (err) {
          console.error("Error fetching linked invoice:", err)
        }
      }
      fetchInvoice()
    }
  }, [editing])

  const handleClose = () => {
    if (!editing && !saving) {
      const hasUnsaved = selectedClient !== (initialClientId ?? '') || type !== '' || designation.trim() !== '' || items.length > 1 || items[0].desc.trim() !== '';
      if (hasUnsaved) {
        setShowConfirmClose(true);
        return;
      }
    }
    onClose();
  }

  const handleGenerateDesignation = async () => {
    if (!designation.trim()) {
      alert("Veuillez d'abord saisir une désignation à reformuler.");
      return;
    }
    setIsGeneratingDesig(true);
    try {
      const currentKey = typeof window !== 'undefined' ? (localStorage.getItem('deepseek_api_key') || '') : ''
      const r = await fetch('/api/admin/generate-designation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-DeepSeek-Key': currentKey
        },
        body: JSON.stringify({ prompt: desigPrompt, text: designation })
      });
      const j = await r.json();
      if (j.success && j.result) {
        setDesignation(j.result);
      } else {
        alert(j.error || "Erreur de génération");
      }
    } catch (e) {
      alert("Erreur de connexion");
    } finally {
      setIsGeneratingDesig(false);
    }
  }

  // Totals
  function n(v: unknown) { return Number(v) || 0 }
  function fmt(val: number) { return val.toLocaleString('fr-FR') + ' F CFA' }
  const ht     = items.reduce((s, i) => s + n(i.qty) * n(i.price), 0)
  const tvaPct = parseFloat(tva.replace(' %', '')) / 100
  const tvaVal = ht * tvaPct
  const ttc    = ht + tvaVal

  const addItem    = () => setItems((v) => [...v, { desc: '', qty: 1, price: 0 }])
  const removeItem = (i: number) => setItems((v) => v.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: string, val: string | number) =>
    setItems((v) => v.map((row, idx) => idx === i ? { ...row, [field]: field === 'desc' ? val : n(val) } : row))

  // AI Parsing
  function parseAIPaste(raw: string) {
    const parsed: {desc: string, qty: number, price: number}[] = []
    const matches = Array.from(raw.matchAll(/[({[]([^)\]}]+)[)\]}]/g))
    for (const m of matches) {
      const parts = m[1].split(';').map((s) => s.trim())
      if (parts.length < 3) continue
      const desc = parts[0]
      if (!desc || desc.toLowerCase().startsWith('description')) continue
      const idx2Is = /^\d/.test(parts[1]) ? 0 : 1
      const qty    = parseFloat(parts[1 + idx2Is]) || 1
      const price  = parseFloat(parts[2 + idx2Is]) || 0
      parsed.push({ desc, qty, price })
    }
    return parsed
  }

  // Models
  function collectFormData() {
    return { 
      type: invoiceType, 
      number: '', 
      client_name: '', 
      client_email: '', 
      client_phone: '', 
      client_address: '', 
      date, 
      due_date: date, 
      objet: designation, 
      items, 
      tva_rate: tva, 
      notes, 
      invoice_type: invoiceType,
      project_type: type
    }
  }
  function applyFormData(data: any) {
    if (data.project_type) setType(data.project_type)
    else if (data.type && !['Facture', 'Devis', 'Facture Proforma'].includes(data.type)) setType(data.type)

    if (data.designation) setDesignation(data.designation)
    else if (data.objet) setDesignation(data.objet)

    if (data.tva_rate) setTva(data.tva_rate)
    if (data.notes) setNotes(data.notes)

    if (data.invoice_type) setInvoiceType(data.invoice_type)
    else if (data.type && ['Facture', 'Devis', 'Facture Proforma'].includes(data.type)) setInvoiceType(data.type)

    if (Array.isArray(data.items) && data.items.length) {
      setItems(data.items.map((i: any) => ({
        desc: i.desc || i.description || '',
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0
      })))
    }
  }
  function getSavedModels() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
  }
  function saveModel() {
    if (!modelName.trim()) return
    const models = getSavedModels()
    models.unshift({ name: modelName.trim(), data: collectFormData() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models.slice(0, 20)))
    setModelName(''); setShowSaveModel(false)
  }
  function deleteModel(i: number) {
    const models = getSavedModels().filter((_: any, idx: number) => idx !== i)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
  }
  function handleImportJSON(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.items || data.designation) applyFormData(data)
        else alert('Format JSON invalide')
      } catch { alert('Fichier JSON invalide') }
    }
    reader.readAsText(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const body: Record<string, unknown> = {
        client_id:    selectedClient,
        client_code:  selectedClientObj?.client_code ?? '',
        client_name:  selectedClientObj?.name ?? '',
        client_email: selectedClientObj?.email ?? '',
        client_phone: selectedClientObj?.phone ?? '',
        type, designation, date,
      }
      
      if (!editing) {
         body.generate_invoice = true;
         body.invoice_type = invoiceType;
         body.items = items.filter((i) => i.desc.trim());
         body.tva_rate = tva;
         body.total_ht = ht;
         body.total_tva = tvaVal;
         body.total = ttc;
         body.notes = notes;
      }
      
      const url    = editing ? `/api/admin/client-projects/${editing.id}` : '/api/admin/client-projects'
      const method = editing ? 'PUT' : 'POST'
      if (editing) {
        delete body.client_email
        delete body.client_phone
      }
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (j.success) {
        if (editing) {
          // 1. Update linked invoice if it exists
          if (editing.invoice_id) {
            const invoiceBody = {
              client_name:  selectedClientObj?.name ?? editing.client_name,
              client_email: selectedClientObj?.email ?? '',
              client_phone: selectedClientObj?.phone ?? '',
              objet:        designation,
              type:         invoiceType,
              tva_rate:     tva,
              items:        items.filter((i) => i.desc.trim()),
              total_ht:     ht,
              total_tva:    tvaVal,
              total:        ttc,
              notes:        notes
            }
            await fetch(`/api/admin/invoices/${editing.invoice_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(invoiceBody)
            })
          }

          // 2. Update KOBA transactions description if linked
          if (editing.koba_account_id) {
            const oldDesc = `${editing.client_name} (${editing.designation})`
            const newDesc = `${selectedClientObj?.name ?? editing.client_name} (${designation})`
            
            await kobaSupabase
              .from('transactions')
              .update({ description: newDesc })
              .eq('description', oldDesc)
          }
        }
        onSaved()
      }
      else setErr(j.tableNotFound ? 'Table "client_projects" introuvable dans Supabase.' : (j.error ?? 'Erreur'))
    } catch { setErr('Erreur de connexion') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold">{editing ? 'Modifier le projet' : 'Nouveau projet'}</h3>
            {!editing && (
              <div className="flex gap-1 ml-2">
                {['Facture', 'Devis', 'Facture Proforma'].map((t) => (
                  <button key={t} type="button" onClick={() => setInvoiceType(t)}
                    className={`px-2 py-0.5 text-xs rounded-md font-semibold transition-colors ${invoiceType === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model bar */}
          {!editing && (
            <div className="flex gap-1 flex-wrap">
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => setShowModels(true)}>
                📋 Charger modèle
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => {
                const input = jsonInputRef.current; input?.click()
              }}>
                <FileJson size={13} /> Importer JSON
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => setShowSaveModel(true)}>
                <Save size={13} /> Sauver modèle
              </Button>
              <input ref={jsonInputRef} type="file" accept=".json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportJSON(f); e.target.value = '' }} />
            </div>
          )}

          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 relative">
          {isAiProcessing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-4">
              <Loader2 className="animate-spin text-primary mb-3" size={36} />
              <p className="text-sm font-semibold">{aiProcessingStatus}</p>
              <p className="text-xs text-muted-foreground mt-1">Veuillez patienter pendant le traitement...</p>
            </div>
          )}
          <form id="project-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client */}
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Client *</label>
                <select id="project-client" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                  <option value="">— Sélectionner un client —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.client_code ? `[${c.client_code}] ` : ''}{c.name || c.email} {c.name && c.email && c.name !== c.email ? `(${c.email})` : ''}</option>)}
                </select>
              </div>
              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Type de projet *</label>
                <select id="project-type" value={type} onChange={(e) => setType(e.target.value)} required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">— Sélectionner le type —</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Désignation */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-muted-foreground">Désignation *</label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleGenerateDesignation} disabled={isGeneratingDesig} className="h-6 text-[10px] gap-1 px-2">
                    {isGeneratingDesig ? <Loader2 size={11} className="animate-spin" /> : <Bot size={11} />} 
                    {isGeneratingDesig ? "Génération..." : "Générer avec l'IA"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-1.5" onClick={() => setShowDesigPrompt(true)}>
                    <Settings2 size={11} />
                  </Button>
                </div>
              </div>
              <textarea id="project-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} required rows={2}
                placeholder="Ex: Projet d'un bâtiment R+1 à usage d'habitation"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-64 h-9 text-sm" />
            </div>

            {(!editing || editing.invoice_id) && (
              <div className="pt-2 border-t mt-4 space-y-4">
                <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Articles & Facturation Automatique</h4>
                
                {/* AI bar */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowAIPaste(true)} className="gap-1">
                    <Bot size={13} /> Générer avec l'IA
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="px-2" onClick={() => setShowPrompt(true)}>
                    <Settings2 size={13} />
                  </Button>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[1fr_70px_120px_100px_30px] gap-2 px-1 mb-1">
                  {['Description', 'Qté', 'Prix unit. (F)', 'Total', ''].map((h, i) => (
                    <span key={i} className="text-xs font-bold text-muted-foreground">{h}</span>
                  ))}
                </div>
                {/* Rows */}
                <div className="space-y-1.5">
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_120px_100px_30px] gap-2 items-center">
                      <Input value={item.desc} onChange={(e) => updateItem(i, 'desc', e.target.value)}
                        placeholder="Description de la prestation" className="h-9 text-sm" />
                      <Input type="number" value={item.qty === 0 ? '' : item.qty}
                        onChange={(e) => updateItem(i, 'qty', e.target.value)}
                        placeholder="1" className="h-9 text-sm text-center" />
                      <Input type="number" value={item.price === 0 ? '' : item.price}
                        onChange={(e) => updateItem(i, 'price', e.target.value)}
                        placeholder="0" className="h-9 text-sm text-right" />
                      <span className="text-sm text-right text-muted-foreground pr-1 tabular-nums font-medium">
                        {fmt(n(item.qty) * n(item.price))}
                      </span>
                      <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive p-1 flex justify-center">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="mt-2 gap-1">
                  <Plus size={13} /> Ajouter une ligne
                </Button>

                {/* Récapitulatif */}
                <div className="bg-muted/30 rounded-xl border p-4 space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total HT :</span>
                    <span className="font-medium tabular-nums">{fmt(ht)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">TVA :</span>
                      <select value={tva} onChange={(e) => setTva(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                        {['0 %', '10 %', '18 %'].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <span className="tabular-nums">{fmt(tvaVal)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Total TTC :</span>
                    <span className="text-yellow-400 tabular-nums">{fmt(ttc)}</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Notes de facture</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            )}
            
            {err && <p className="text-sm text-destructive font-semibold">{err}</p>}
          </form>

          {/* ── Sub-modals ── */}
          {showPrompt && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPrompt(false)}>
              <div className="bg-card border rounded-2xl w-full max-w-lg p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-3">⚙ Prompt IA par défaut</h3>
                
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Clé API DeepSeek</label>
                  <Input 
                    type="password" 
                    placeholder="sk-..." 
                    value={deepseekKey} 
                    onChange={(e) => {
                      setDeepseekKey(e.target.value)
                      localStorage.setItem('deepseek_api_key', e.target.value)
                    }} 
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    La clé est sauvegardée localement dans votre navigateur et partagée par toutes les fonctionnalités d'IA.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Clé API GLM (Zhipu AI - OCR)</label>
                  <Input 
                    type="password" 
                    placeholder="Clé API GLM..." 
                    value={glmKey} 
                    onChange={(e) => {
                      setGlmKey(e.target.value)
                      localStorage.setItem('glm_api_key', e.target.value)
                    }} 
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    La clé est sauvegardée localement dans votre navigateur et utilisée pour l'OCR des images collées (Ctrl + V).
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  Modifiez ce prompt pour l'adapter à vos besoins (par ex: services au lieu de matériaux, ou BTP général).
                  Copiez ce texte et collez-le dans ChatGPT, Claude ou Gemini.
                </p>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={10}
                  className="w-full text-sm font-mono bg-muted p-3 rounded-lg border focus:ring-2 focus:ring-primary/50 outline-none resize-none mb-4" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setAiPrompt(DEFAULT_AI_PROMPT)}>Réinitialiser</Button>
                  <Button type="button" onClick={() => setShowPrompt(false)}>Terminer</Button>
                </div>
              </div>
            </div>
          )}

          {showAIPaste && (() => {
            let pasteText = ''
            const p = aiPrompt
              .replace('{doc_type}', invoiceType)
              .replace('{objet}', designation || '—')
              .replace('{client}', selectedClientObj?.name || selectedClientObj?.email || '—')
            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAIPaste(false)}>
                <div className="bg-card border rounded-2xl w-full max-w-xl p-5 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-3">✨ Génération par IA</h3>
                  
                  <div className="bg-muted p-3 rounded-lg mb-4 text-xs">
                    <p className="font-bold text-foreground mb-1">1. Copiez ce prompt et collez-le dans ChatGPT/Claude :</p>
                    <div className="relative">
                      <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground mt-2 max-h-32 overflow-y-auto">{p}</pre>
                      <button type="button" onClick={() => navigator.clipboard.writeText(p)}
                        className="absolute top-0 right-0 bg-background border px-2 py-1 rounded text-[10px] font-bold hover:bg-muted">
                        Copier
                      </button>
                    </div>
                  </div>

                  <p className="font-bold text-sm mb-2">2. Collez le résultat ici :</p>
                  <textarea rows={6} placeholder="{(Description;10;5000;50000);...}"
                    className="w-full text-sm font-mono bg-background p-3 rounded-lg border focus:ring-2 focus:ring-primary/50 outline-none resize-none mb-4 flex-1"
                    onChange={(e) => { pasteText = e.target.value }} />
                  
                  <div className="flex gap-2 justify-end mt-auto pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowAIPaste(false)}>Annuler</Button>
                    <Button type="button" onClick={() => {
                      const res = parseAIPaste(pasteText)
                      if (res.length) { setItems(res); setShowAIPaste(false) }
                      else alert("Aucun article valide trouvé. Vérifiez le format.")
                    }}>Importer les articles</Button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Sub-modals for Designation AI ── */}
          {showDesigPrompt && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDesigPrompt(false)}>
              <div className="bg-card border rounded-2xl w-full max-w-lg p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-3">⚙ Prompt IA Désignation</h3>
                
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Clé API DeepSeek</label>
                  <Input 
                    type="password" 
                    placeholder="sk-..." 
                    value={deepseekKey} 
                    onChange={(e) => {
                      setDeepseekKey(e.target.value)
                      localStorage.setItem('deepseek_api_key', e.target.value)
                    }} 
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    La clé est sauvegardée localement dans votre navigateur et partagée par toutes les fonctionnalités d'IA.
                  </p>
                </div>

                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  Modifiez ce prompt pour l'adapter à vos besoins de reformulation de projet.
                  Copiez ce texte et collez-le dans ChatGPT, Claude ou Gemini.
                </p>
                <textarea value={desigPrompt} onChange={e => setDesigPrompt(e.target.value)} rows={10}
                  className="w-full text-sm font-mono bg-muted p-3 rounded-lg border focus:ring-2 focus:ring-primary/50 outline-none resize-none mb-4" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDesigPrompt(DEFAULT_DESIG_PROMPT)}>Réinitialiser</Button>
                  <Button type="button" onClick={() => setShowDesigPrompt(false)}>Terminer</Button>
                </div>
              </div>
            </div>
          )}

          {showSaveModel && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowSaveModel(false)}>
              <div className="bg-card border rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-3">Sauvegarder ce modèle</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Sauvegarde les informations actuelles (Type, Désignation, Articles, TVA, Notes) dans votre navigateur.
                </p>
                <Input autoFocus placeholder="Nom du modèle (ex: Projet standard)"
                  value={modelName} onChange={(e) => setModelName(e.target.value)} className="mb-4" />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowSaveModel(false)}>Annuler</Button>
                  <Button type="button" onClick={saveModel} disabled={!modelName.trim()}>Enregistrer</Button>
                </div>
              </div>
            </div>
          )}

          {showModels && (() => {
            const models = getSavedModels()
            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModels(false)}>
                <div className="bg-card border rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4">Vos modèles enregistrés</h3>
                  {models.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Aucun modèle sauvegardé.</div>
                  ) : (
                    <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                      {models.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                          <button type="button" onClick={() => { applyFormData(m.data); setShowModels(false) }} className="flex-1 text-left">
                            <p className="font-bold text-sm">{m.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">
                              <span className="font-semibold text-foreground">{m.data.invoice_type || m.data.type || 'Facture'}</span> • {m.data.designation || m.data.objet || 'Sans désignation'} • {m.data.items?.length || 0} article(s)
                            </p>
                          </button>
                          <button type="button" onClick={() => deleteModel(i)} className="p-2 text-muted-foreground hover:text-destructive rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t flex justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowModels(false)}>Fermer</Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
        <div className="p-5 border-t shrink-0 flex gap-3">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Annuler</Button>
          <Button type="submit" form="project-form" disabled={saving || (!editing && !selectedClient)} className="flex-1 gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {editing ? 'Enregistrer les modifications' : `Créer Projet & ${invoiceType}`}
          </Button>
        </div>
      </div>

      {showConfirmClose && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { e.stopPropagation(); setShowConfirmClose(false) }}>
          <div className="bg-card border rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">Quitter sans enregistrer ?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Vous avez des informations non enregistrées. Êtes-vous sûr de vouloir quitter ? Toutes vos saisies seront perdues.
            </p>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowConfirmClose(false)}>Continuer l'édition</Button>
              <Button type="button" variant="destructive" onClick={onClose}>Oui, quitter</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({ project, onClose, onSaved, onChanged }: { project: ClientProject; onClose: () => void; onSaved: () => void; onChanged?: () => void }) {
  const [amount, setAmount] = useState('')
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [tableNotFound, setTableNotFound] = useState(false)
  const [history, setHistory] = useState<Transaction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/project-transactions?project_id=${project.id}`)
      const j = await r.json()
      if (j.success) setHistory(j.data ?? [])
    } catch { /* silencieux — l'historique est informatif */ }
    finally { setLoadingHistory(false) }
  }, [project.id])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleDelete = async (txId: string) => {
    setDeletingId(txId); setErr('')
    try {
      const r = await fetch(`/api/admin/project-transactions/${txId}`, { method: 'DELETE' })
      const j = await r.json()
      if (j.success) {
        setHistory(prev => prev.filter(t => t.id !== txId))
        onChanged?.()
      } else setErr(j.error ?? 'Suppression impossible')
    } catch { setErr('Erreur de connexion') }
    finally { setDeletingId(null); setConfirmDeleteId(null) }
  }

  const totalVersed = history.reduce((s, t) => s + (t.amount || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) { setErr('Le montant doit être supérieur à 0'); return }
    setSaving(true); setErr('')
    try {
      const r = await fetch('/api/admin/project-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: project.id, project_name: project.designation, project_custom_id: project.custom_id, client_id: project.client_id, client_name: project.client_name, type: 'versement', amount: parseFloat(amount), date, notes }),
      })
      const j = await r.json()
      if (j.success) {
        if (project.koba_account_id) {
          const { data: { session } } = await kobaSupabase.auth.getSession()
          if (session?.user) {
            let pfId = project.koba_account_id
            if (project.koba_account_type === 'project') {
              const { data: pfData } = await kobaSupabase.from('portefeuilles').select('id')
              if (pfData && pfData.length > 0) {
                pfId = pfData[0].id
              }
            }

            await kobaSupabase.from('transactions').insert({
              id: crypto.randomUUID(),
              user_id: session.user.id,
              local_uuid_owner: session.user.id,
              type: 'entree',
              montant: parseFloat(amount),
              portefeuille_id: pfId,
              projet_id: project.koba_account_type === 'project' ? project.koba_account_id : null,
              description: `${project.client_name} (${project.designation})`,
              date_heure: new Date(date).toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        }
        onSaved()
      }
      else if (j.tableNotFound) setTableNotFound(true)
      else setErr(j.error ?? 'Erreur')
    } catch { setErr('Erreur de connexion') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">💰 Ajouter un versement</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project summary */}
          <div className="bg-muted/50 rounded-lg p-3 border space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground text-xs">Projet:</span><span className="font-semibold">{project.designation}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-xs">ID Projet:</span><span className="font-mono text-xs">{project.custom_id}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-xs">Client:</span><span>{project.client_name}</span></div>
            {project.total !== undefined && project.total > 0 && (
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="text-muted-foreground text-xs">Coût projet:</span>
                <span className="font-semibold text-emerald-400">{project.total.toLocaleString('fr-FR')} F CFA</span>
              </div>
            )}
          </div>

          {/* Historique des versements existants (avec suppression) */}
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Chargement des versements…</div>
          ) : history.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                <span className="text-xs font-bold uppercase text-muted-foreground">Versements existants ({history.length})</span>
                <span className="text-xs font-semibold text-emerald-400">{totalVersed.toLocaleString('fr-FR')} F CFA versés</span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y">
                {history.map(tx => (
                  <div key={tx.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{(tx.amount || 0).toLocaleString('fr-FR')} F</span>
                      <span className="text-xs text-muted-foreground ml-2">{tx.date}</span>
                      {tx.notes && <span className="text-xs text-muted-foreground ml-2 truncate">— {tx.notes}</span>}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{tx.reference}</span>
                    {confirmDeleteId === tx.id ? (
                      <span className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => handleDelete(tx.id)} disabled={deletingId === tx.id}
                          className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50">
                          {deletingId === tx.id ? <Loader2 size={12} className="animate-spin" /> : 'Supprimer ?'}
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs text-muted-foreground hover:underline">Non</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(tx.id)} title="Supprimer ce versement"
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Montant du versement (F CFA) *</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 500000" required />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Date du versement</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Acompte sur projet..." rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          {tableNotFound && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-yellow-400">⚠ Table &quot;project_transactions&quot; introuvable</p>
              <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS plans.project_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL,
  project_name      text, project_custom_id text,
  client_id         text, client_name text,
  type              text DEFAULT 'versement',
  reference         text NOT NULL,
  amount            numeric DEFAULT 0,
  date              text, notes text,
  status            text DEFAULT 'completed',
  created_at        timestamptz DEFAULT now()
);`}</pre>
              <Button variant="outline" size="sm" onClick={() => setTableNotFound(false)} className="w-full">Fermer</Button>
            </div>
          )}

          {!tableNotFound && (
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                Enregistrer
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
