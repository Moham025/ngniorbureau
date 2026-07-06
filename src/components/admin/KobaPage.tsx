"use client"

import { useState, useEffect, useMemo } from 'react'
import { createClient, User } from '@supabase/supabase-js'
import { 
  Wallet, FolderOpen, ArrowUpRight, ArrowDownRight, Plus, 
  RefreshCw, LogOut, ChevronLeft, Link as LinkIcon, Trash2,
  Lock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

// --- Supabase Client pour KOBA ---
const KOBA_URL = 'https://xajozimjmbgsgxsaqhbb.supabase.co'
const KOBA_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhham96aW1qbWJnc2d4c2FxaGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDU2NDAsImV4cCI6MjA4NzE4MTY0MH0.NWqLZXHDw4tvlmTR_c0lwvMrJl-vhr-N5ghARCWgO2s'

const kobaSupabase = createClient(KOBA_URL, KOBA_ANON_KEY, {
  auth: {
    storageKey: 'koba-supabase-token',
    persistSession: true,
    autoRefreshToken: true
  }
})

// --- Types ---
type AccountType = 'portfolio' | 'project'

interface Account {
  id: string
  nom: string
  icone?: string
  couleur?: string
  type: AccountType
  solde: number
  is_archived?: boolean
}

interface Transaction {
  id: string
  user_id: string
  type: 'entree' | 'depense'
  montant: number
  portefeuille_id: string
  projet_id?: string
  description?: string
  date_heure: string
  authorName?: string
}

interface Collaborator {
  user_id: string
  nom: string | null
  email: string | null
  alias: string | null
}

const PALETTE = ['#00E5A0', '#00B4D8', '#FF5252', '#F5C842', '#A855F7', '#FF8C42', '#06D6A0', '#EF476F']

export default function KobaPage() {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  // --- Data State ---
  const [accounts, setAccounts] = useState<Account[]>([])
  const [portefeuillesList, setPortefeuillesList] = useState<any[]>([]) // Used for selecting portfolio when adding project tx
  const [loadingData, setLoadingData] = useState(false)
  
  // --- Detail View State ---
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [collaborators, setCollaborators] = useState<Record<string, string>>({})

  // --- Modals State ---
  const [modalType, setModalType] = useState<'portfolio' | 'project' | 'sync' | 'transaction' | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  // Form states
  const [formName, setFormName] = useState('')
  const [formSolde, setFormSolde] = useState('0')
  const [formColor, setFormColor] = useState(PALETTE[0])
  
  const [formSyncCode, setFormSyncCode] = useState('')

  const [formTxType, setFormTxType] = useState<'entree'|'depense'>('entree')
  const [formTxAmount, setFormTxAmount] = useState('')
  const [formTxDesc, setFormTxDesc] = useState('')
  const [formTxPortefeuilleId, setFormTxPortefeuilleId] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await kobaSupabase.auth.getSession()
      setUser(session?.user ?? null)
      setAuthLoading(false)
    }
    checkSession()

    const { data: authListener } = kobaSupabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (user) {
      loadAccounts()
    } else {
      setAccounts([])
      setActiveAccount(null)
    }
  }, [user])

  useEffect(() => {
    if (activeAccount) {
      loadTransactions(activeAccount)
    }
  }, [activeAccount])

  // --- Helpers ---
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' })
      .format(amount)
      .replace('XOF', 'FCFA')
  }

  const generateUuid = () => crypto.randomUUID()

  // --- Auth Actions ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    const { error } = await kobaSupabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const handleGoogleLogin = async () => {
    setAuthLoading(true)
    setAuthError('')
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
    const { error } = await kobaSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    })
    if (error) {
      setAuthError(error.message)
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    await kobaSupabase.auth.signOut()
  }

  // --- Data Loading ---
  const loadAccounts = async () => {
    setLoadingData(true)
    try {
      // Load Portefeuilles
      const { data: pfData, error: pfErr } = await kobaSupabase.from('portefeuilles').select('*')
      if (pfErr) throw pfErr

      // Load Projects
      const { data: prData, error: prErr } = await kobaSupabase.from('projets').select('*')
      if (prErr) throw prErr

      // Calculate project balances by fetching all transactions
      const { data: txsData, error: txErr } = await kobaSupabase.from('transactions').select('projet_id, type, montant')
      if (txErr) throw txErr

      const projBalances: Record<string, number> = {}
      if (txsData) {
        txsData.forEach(tx => {
          if (tx.projet_id) {
            const val = tx.type === 'entree' ? Number(tx.montant) : -Number(tx.montant)
            projBalances[tx.projet_id] = (projBalances[tx.projet_id] || 0) + val
          }
        })
      }

      const merged: Account[] = [
        ...(pfData || []).map(p => ({ ...p, type: 'portfolio' as const, solde: Number(p.solde) })),
        ...(prData || []).map(p => ({ ...p, type: 'project' as const, solde: projBalances[p.id] || 0 }))
      ]

      setAccounts(merged)
      setPortefeuillesList(pfData || [])

      // Update active account if it's currently open to refresh balance
      if (activeAccount) {
        const updatedActive = merged.find(a => a.id === activeAccount.id)
        if (updatedActive) setActiveAccount(updatedActive)
      }
    } catch (e: any) {
      console.error("Error loading accounts:", e)
    } finally {
      setLoadingData(false)
    }
  }

  const loadTransactions = async (account: Account) => {
    setLoadingTx(true)
    try {
      const col = account.type === 'portfolio' ? 'portefeuille_id' : 'projet_id'
      const { data: txsData, error: txErr } = await kobaSupabase
        .from('transactions')
        .select('*')
        .eq(col, account.id)
        .order('date_heure', { ascending: false })
      
      if (txErr) throw txErr

      // Load collaborators to map user_id to names
      let membersData: Collaborator[] = []
      if (account.type === 'portfolio') {
        const { data } = await kobaSupabase.from('shared_wallets_view').select('collaborator_user_id, collaborator_email, collaborator_nom, collaborator_alias').eq('wallet_id', account.id)
        if (data) membersData = data.map(d => ({ user_id: d.collaborator_user_id, nom: d.collaborator_nom, email: d.collaborator_email, alias: d.collaborator_alias }))
      } else {
        const { data } = await kobaSupabase.from('shared_projets_view').select('collaborator_user_id, collaborator_email, collaborator_nom, collaborator_alias').eq('projet_id', account.id)
        if (data) membersData = data.map(d => ({ user_id: d.collaborator_user_id, nom: d.collaborator_nom, email: d.collaborator_email, alias: d.collaborator_alias }))
      }

      const colMap: Record<string, string> = {}
      membersData.forEach(m => {
        colMap[m.user_id] = m.alias || m.nom || m.email || 'Utilisateur'
      })
      setCollaborators(colMap)

      const formattedTxs = (txsData || []).map(t => ({
        ...t,
        authorName: t.user_id === user?.id ? 'vous' : (colMap[t.user_id] || 'Utilisateur inconnu')
      }))

      setTransactions(formattedTxs)
    } catch (e) {
      console.error("Error loading txs:", e)
    } finally {
      setLoadingTx(false)
    }
  }

  // --- Modal Submits ---
  const handleAddPortfolio = async () => {
    if (!formName.trim()) return
    setModalLoading(true)
    setModalError('')
    try {
      const id = generateUuid()
      const soldeInit = parseFloat(formSolde) || 0
      
      const { error: pfErr } = await kobaSupabase.from('portefeuilles').insert({
        id,
        user_id: user!.id,
        local_uuid_owner: user!.id,
        nom: formName.trim(),
        solde: soldeInit,
        couleur: formColor,
        icone: 'wallet',
        updated_at: new Date().toISOString(),
        sync_version: 1,
        sync_status: 'synced'
      })
      if (pfErr) throw pfErr

      // Add to collaborators table to ensure RLS access later
      await kobaSupabase.from('wallet_collaborators').insert({
        wallet_id: id,
        user_id: user!.id,
        role: 'owner'
      })

      if (soldeInit > 0) {
        await kobaSupabase.from('transactions').insert({
          id: generateUuid(),
          user_id: user!.id,
          local_uuid_owner: user!.id,
          type: 'entree',
          montant: soldeInit,
          portefeuille_id: id,
          description: 'Solde initial',
          date_heure: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      closeModal()
      loadAccounts()
    } catch (e: any) {
      setModalError(e.message)
    } finally {
      setModalLoading(false)
    }
  }

  const handleAddProject = async () => {
    if (!formName.trim()) return
    setModalLoading(true)
    setModalError('')
    try {
      const id = generateUuid()
      
      const { error: prErr } = await kobaSupabase.from('projets').insert({
        id,
        user_id: user!.id,
        local_uuid_owner: user!.id,
        nom: formName.trim(),
        icone: 'folder',
        statut: 'actif',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      if (prErr) throw prErr

      await kobaSupabase.from('projet_collaborators').insert({
        projet_id: id,
        user_id: user!.id,
        role: 'owner'
      })

      closeModal()
      loadAccounts()
    } catch (e: any) {
      setModalError(e.message)
    } finally {
      setModalLoading(false)
    }
  }

  const handleSyncAccount = async () => {
    const code = formSyncCode.toUpperCase().trim()
    if (code.length !== 6) {
      setModalError('Le code doit contenir 6 caractères.')
      return
    }
    setModalLoading(true)
    setModalError('')
    try {
      // Check wallet invites
      const { data: wInvite } = await kobaSupabase
        .from('wallet_invites')
        .select('*')
        .eq('code', code)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (wInvite) {
        const { data: res, error } = await kobaSupabase.rpc('join_wallet_by_code', {
          p_code: code,
          p_user_id: user!.id
        })
        if (error) throw error
        if (res && res.success === false) throw new Error(res.message)
      } else {
        // Check project invites
        const { data: pInvite } = await kobaSupabase
          .from('projet_invites')
          .select('*')
          .eq('code', code)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
        
        if (pInvite) {
          const { data: res, error } = await kobaSupabase.rpc('join_projet_by_code', {
            p_code: code,
            p_user_id: user!.id
          })
          if (error) throw error
          if (res && res.success === false) throw new Error(res.message)
        } else {
          throw new Error('Code invalide ou expiré.')
        }
      }

      closeModal()
      loadAccounts()
    } catch (e: any) {
      setModalError(e.message)
    } finally {
      setModalLoading(false)
    }
  }

  const handleAddTransaction = async () => {
    const amount = parseFloat(formTxAmount)
    if (isNaN(amount) || amount <= 0) {
      setModalError('Montant invalide.')
      return
    }
    if (activeAccount?.type === 'project' && !formTxPortefeuilleId) {
      setModalError('Veuillez sélectionner un portefeuille pour cette transaction de projet.')
      return
    }

    setModalLoading(true)
    setModalError('')
    try {
      const targetPfId = activeAccount?.type === 'portfolio' ? activeAccount.id : formTxPortefeuilleId
      const targetProjId = activeAccount?.type === 'project' ? activeAccount.id : null

      const newTxId = generateUuid()
      const txData: any = {
        id: newTxId,
        user_id: user!.id,
        local_uuid_owner: user!.id,
        type: formTxType,
        montant: amount,
        portefeuille_id: targetPfId,
        description: formTxDesc.trim() || null,
        date_heure: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      if (targetProjId) {
        txData.projet_id = targetProjId
      }

      // 1. Insert transaction
      const { error: txErr } = await kobaSupabase.from('transactions').insert(txData)
      if (txErr) throw txErr

      // 2. Update portefeuille solde
      const pfToUpdate = portefeuillesList.find(p => p.id === targetPfId)
      if (pfToUpdate) {
        const currentSolde = parseFloat(pfToUpdate.solde || 0)
        const newSolde = formTxType === 'entree' ? currentSolde + amount : currentSolde - amount
        await kobaSupabase.from('portefeuilles').update({
          solde: newSolde,
          updated_at: new Date().toISOString()
        }).eq('id', targetPfId)
      }

      closeModal()
      // Refresh current view
      loadAccounts() // will also trigger loadTransactions for active account
    } catch (e: any) {
      setModalError(e.message)
    } finally {
      setModalLoading(false)
    }
  }

  const openModal = (type: typeof modalType) => {
    setModalError('')
    setFormName('')
    setFormSolde('0')
    setFormColor(PALETTE[0])
    setFormSyncCode('')
    setFormTxType('entree')
    setFormTxAmount('')
    setFormTxDesc('')
    if (portefeuillesList.length > 0) {
      setFormTxPortefeuilleId(portefeuillesList[0].id)
    }
    setModalType(type)
  }

  const closeModal = () => setModalType(null)

  // --- Views ---

  if (authLoading) {
    return <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[400px]">Chargement de KOBA...</div>
  }

  if (!user) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Card className="w-full max-w-md bg-card/60 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
              <Wallet size={32} className="text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Synchronisation KOBA</CardTitle>
            <CardDescription className="text-sm">
              Connectez-vous à votre compte KOBA pour synchroniser vos portefeuilles et projets et gérer vos transactions directement depuis Ngbureau.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email KOBA</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="votre@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background/50"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-background/50"
                  required 
                />
              </div>
              {authError && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">{authError}</p>}
              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={authLoading}>
                {authLoading ? 'Connexion en cours...' : 'Se connecter'}
              </Button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-xs uppercase">Ou</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-11 text-base font-semibold gap-2.5 bg-background/50 hover:bg-muted"
                onClick={handleGoogleLogin}
                disabled={authLoading}
              >
                <img src="/Google__G__logo.png" alt="Google" className="w-5 h-5" />
                Se connecter avec Google
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 p-4 rounded-xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 p-3 rounded-xl border border-primary/30">
            <Wallet className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">KOBA — Comptes & Portefeuilles</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Lock size={12} /> Connecté en tant que <span className="font-medium text-foreground">{user.email}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!activeAccount && (
            <>
              <Button variant="outline" size="sm" onClick={() => openModal('portfolio')} className="gap-1.5">
                <Wallet size={16} /> Nouveau portefeuille
              </Button>
              <Button variant="outline" size="sm" onClick={() => openModal('project')} className="gap-1.5">
                <FolderOpen size={16} /> Nouveau projet
              </Button>
              <Button variant="outline" size="sm" onClick={() => openModal('sync')} className="gap-1.5 bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
                <LinkIcon size={16} /> Synchroniser
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => activeAccount ? loadTransactions(activeAccount) : loadAccounts()} disabled={loadingData || loadingTx} title="Actualiser">
            <RefreshCw size={18} className={(loadingData || loadingTx) ? "animate-spin" : ""} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive hover:bg-destructive/10" title="Déconnexion">
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      {/* WORKSPACE CONTENT */}
      {!activeAccount ? (
        <div className="space-y-8">
          {loadingData ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">Chargement de vos comptes...</div>
          ) : (
            <>
              {/* Portefeuilles */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 px-1">
                  <Wallet size={18} className="text-emerald-500" /> Portefeuilles
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {accounts.filter(a => a.type === 'portfolio').map(pf => (
                    <Card 
                      key={pf.id} 
                      className="cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group overflow-hidden"
                      onClick={() => setActiveAccount(pf)}
                    >
                      <div className="h-1.5 w-full" style={{ backgroundColor: pf.couleur || PALETTE[0] }} />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="font-medium truncate pr-4 text-base" title={pf.nom}>{pf.nom}</div>
                          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
                            <Wallet size={16} />
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold tracking-tight">
                            {formatMoney(pf.solde)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Portefeuille KOBA</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {accounts.filter(a => a.type === 'portfolio').length === 0 && (
                    <div className="col-span-full p-8 text-center border border-dashed rounded-xl text-muted-foreground">
                      Aucun portefeuille trouvé.
                    </div>
                  )}
                </div>
              </div>

              {/* Projets */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 px-1">
                  <FolderOpen size={18} className="text-purple-500" /> Projets KOBA
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {accounts.filter(a => a.type === 'project').map(pr => (
                    <Card 
                      key={pr.id} 
                      className="cursor-pointer hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all group overflow-hidden"
                      onClick={() => setActiveAccount(pr)}
                    >
                      <div className="h-1.5 w-full bg-purple-500" />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="font-medium truncate pr-4 text-base" title={pr.nom}>{pr.nom}</div>
                          <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500 shrink-0">
                            <FolderOpen size={16} />
                          </div>
                        </div>
                        <div>
                          <div className={`text-2xl font-bold tracking-tight ${pr.solde < 0 ? 'text-destructive' : ''}`}>
                            {formatMoney(pr.solde)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-medium">Projet Partagé</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {accounts.filter(a => a.type === 'project').length === 0 && (
                    <div className="col-span-full p-8 text-center border border-dashed rounded-xl text-muted-foreground">
                      Aucun projet trouvé.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* DETAIL VIEW */
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveAccount(null)} className="text-muted-foreground -ml-2">
              <ChevronLeft size={18} className="mr-1" /> Retour
            </Button>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-border">
            <div className={`h-2 w-full ${activeAccount.type === 'portfolio' ? '' : 'bg-purple-500'}`} style={{ backgroundColor: activeAccount.type === 'portfolio' ? (activeAccount.couleur || PALETTE[0]) : undefined }} />
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/40 backdrop-blur-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {activeAccount.type === 'portfolio' ? <Wallet size={16} className="text-emerald-500" /> : <FolderOpen size={16} className="text-purple-500" />}
                  <span className="uppercase text-xs font-bold tracking-wider">{activeAccount.type === 'portfolio' ? 'Portefeuille' : 'Projet KOBA'}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{activeAccount.nom}</h2>
              </div>
              <div className="flex flex-col md:items-end gap-3">
                <div className="text-sm text-muted-foreground font-medium">Solde actuel</div>
                <div className={`text-4xl md:text-5xl font-black tracking-tighter ${activeAccount.solde < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                  {formatMoney(activeAccount.solde)}
                </div>
                <Button onClick={() => openModal('transaction')} className="mt-2 w-full md:w-auto gap-2" size="lg">
                  <Plus size={18} /> Ajouter Transaction
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 pt-4">
            <h3 className="text-xl font-bold tracking-tight">Historique des transactions</h3>
            <Card>
              {loadingTx ? (
                <div className="p-12 text-center text-muted-foreground">Chargement des transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                  <div className="bg-muted p-4 rounded-full"><RefreshCw size={24} className="text-muted-foreground/50" /></div>
                  <p>Aucune transaction dans ce compte.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map(tx => (
                    <div key={tx.id} className="p-4 md:p-5 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full shrink-0 ${tx.type === 'entree' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {tx.type === 'entree' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                        </div>
                        <div>
                          <div className="font-semibold text-base">
                            {tx.description || (tx.type === 'entree' ? 'Dépôt' : 'Retrait')}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>{new Date(tx.date_heure).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30"></span>
                            <span className="font-medium italic">par {tx.authorName}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold text-lg whitespace-nowrap ${tx.type === 'entree' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {tx.type === 'entree' ? '+' : '-'} {formatMoney(tx.montant)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* MODALS */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[425px]">
          {modalType === 'portfolio' && (
            <>
              <DialogHeader>
                <DialogTitle>Nouveau Portefeuille</DialogTitle>
                <DialogDescription>Créez un portefeuille pour y stocker des fonds.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nom du portefeuille</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Caisse Principale" autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Solde initial (FCFA)</Label>
                  <Input type="number" value={formSolde} onChange={e => setFormSolde(e.target.value)} />
                </div>
                <div className="space-y-3 pt-2">
                  <Label>Couleur</Label>
                  <div className="flex gap-2 flex-wrap">
                    {PALETTE.map(c => (
                      <button 
                        key={c}
                        type="button"
                        onClick={() => setFormColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${formColor === c ? 'scale-110 border-white ring-2 ring-primary' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                {modalError && <p className="text-sm text-destructive text-left w-full mb-2">{modalError}</p>}
                <Button variant="outline" onClick={closeModal}>Annuler</Button>
                <Button onClick={handleAddPortfolio} disabled={modalLoading}>{modalLoading ? 'Création...' : 'Créer'}</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'project' && (
            <>
              <DialogHeader>
                <DialogTitle>Nouveau Projet</DialogTitle>
                <DialogDescription>Un espace partagé pour regrouper des transactions.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nom du projet</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Chantier Villa" autoFocus />
                </div>
              </div>
              <DialogFooter>
                {modalError && <p className="text-sm text-destructive text-left w-full mb-2">{modalError}</p>}
                <Button variant="outline" onClick={closeModal}>Annuler</Button>
                <Button onClick={handleAddProject} disabled={modalLoading}>{modalLoading ? 'Création...' : 'Créer'}</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'sync' && (
            <>
              <DialogHeader>
                <DialogTitle>Synchroniser un compte</DialogTitle>
                <DialogDescription>Entrez un code d'invitation KOBA pour rejoindre un portefeuille ou projet partagé.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="space-y-2">
                  <Label>Code d'invitation (6 caractères)</Label>
                  <Input 
                    value={formSyncCode} 
                    onChange={e => setFormSyncCode(e.target.value)} 
                    placeholder="Ex: 2TT4NY" 
                    className="uppercase tracking-widest text-center font-mono text-2xl h-14" 
                    maxLength={6}
                    autoFocus 
                  />
                </div>
              </div>
              <DialogFooter>
                {modalError && <p className="text-sm text-destructive text-left w-full mb-2">{modalError}</p>}
                <Button variant="outline" onClick={closeModal}>Annuler</Button>
                <Button onClick={handleSyncAccount} disabled={modalLoading || formSyncCode.trim().length !== 6}>{modalLoading ? 'Vérification...' : 'Synchroniser'}</Button>
              </DialogFooter>
            </>
          )}

          {modalType === 'transaction' && (
            <>
              <DialogHeader>
                <DialogTitle>Ajouter une transaction</DialogTitle>
                <DialogDescription>Enregistrez un dépôt ou un retrait pour {activeAccount?.nom}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    type="button" 
                    variant={formTxType === 'entree' ? 'default' : 'outline'} 
                    className={formTxType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                    onClick={() => setFormTxType('entree')}
                  >
                    <ArrowDownRight className="mr-2" size={16} /> Dépôt
                  </Button>
                  <Button 
                    type="button" 
                    variant={formTxType === 'depense' ? 'default' : 'outline'} 
                    className={formTxType === 'depense' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                    onClick={() => setFormTxType('depense')}
                  >
                    <ArrowUpRight className="mr-2" size={16} /> Retrait
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Montant (FCFA)</Label>
                  <Input type="number" value={formTxAmount} onChange={e => setFormTxAmount(e.target.value)} placeholder="0" autoFocus />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={formTxDesc} onChange={e => setFormTxDesc(e.target.value)} placeholder="Ex: Approvisionnement matériel" />
                </div>

                {activeAccount?.type === 'project' && (
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-primary font-medium flex items-center gap-2"><Wallet size={14}/> Portefeuille source/destination</Label>
                    <p className="text-xs text-muted-foreground mb-2">Les transactions de projet doivent être liées à un portefeuille.</p>
                    <Select value={formTxPortefeuilleId} onValueChange={setFormTxPortefeuilleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un portefeuille" />
                      </SelectTrigger>
                      <SelectContent>
                        {portefeuillesList.map(pf => (
                          <SelectItem key={pf.id} value={pf.id}>
                            {pf.nom} ({formatMoney(pf.solde)})
                          </SelectItem>
                        ))}
                        {portefeuillesList.length === 0 && (
                          <SelectItem value="none" disabled>Aucun portefeuille disponible</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                {modalError && <p className="text-sm text-destructive text-left w-full mb-2">{modalError}</p>}
                <Button variant="outline" onClick={closeModal}>Annuler</Button>
                <Button onClick={handleAddTransaction} disabled={modalLoading}>{modalLoading ? 'Enregistrement...' : 'Enregistrer'}</Button>
              </DialogFooter>
            </>
          )}

        </DialogContent>
      </Dialog>
    </div>
  )
}
