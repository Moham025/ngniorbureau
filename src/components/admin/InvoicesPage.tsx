'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, RefreshCw, Bot, Settings2, X, Trash2, Save, Loader2, FileText, AlertCircle, Edit2, Download, FileJson, FileSpreadsheet, Eye, Printer, Search, CheckCircle, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocItem { desc: string; qty: number; price: number }
interface Doc {
  id?: string; type: DocType; number: string
  client_name?: string; client_email?: string; client_phone?: string; client_address?: string
  date?: string; due_date?: string; objet?: string
  items: DocItem[]
  tva_rate: string; total_ht: number; total_tva: number; total: number
  notes?: string; status?: string; created_at?: string
}
interface ClientRow { id: string; name: string; email: string; phone?: string; client_code?: string }
type DocType = 'Facture' | 'Devis' | 'Reçu' | 'Facture Proforma'

const DOC_TYPES: DocType[] = ['Facture', 'Devis', 'Reçu', 'Facture Proforma']
const TVA_OPTS = ['0 %', '10 %', '18 %']
const DOC_COLORS: Record<DocType, string> = {
  Facture: 'text-blue-400', Devis: 'text-yellow-400', Reçu: 'text-emerald-400', 'Facture Proforma': 'text-purple-400',
}
const STORAGE_KEY = 'ngbureau_doc_models'

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

const DEFAULT_NOTES_PROMPT = `Tu es un assistant commercial. Propose ou reformule des conditions de vente/paiement courtes et professionnelles.
- Type de document : {doc_type}
- Objet            : {objet}
- Client           : {client}

Réponds uniquement avec le texte final, sans introduction ni puces Markdown superflues.`

function genRef(type: DocType) {
  const now = new Date()
  const year2 = now.getFullYear().toString().slice(2)
  const p = type === 'Facture' ? 'FAC' : type === 'Devis' ? 'DEV' : type === 'Reçu' ? 'REC' : type === 'Facture Proforma' ? 'FPR' : 'DOC'
  return `${p}-${year2}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
}
function todayStr() { return new Date().toLocaleDateString('fr-FR') }
function n(v: unknown) { return Number(v) || 0 }
function fmtNum(v: number) { return v.toLocaleString('fr-FR') + ' F CFA' }

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [docs,    setDocs]    = useState<Doc[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [filter,  setFilter]  = useState<DocType | 'Tout'>('Tout')
  const [clientFilter, setClientFilter] = useState<string>('Tout')
  const [clientSearch, setClientSearch] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [clientProjects, setClientProjects] = useState<any[]>([])
  const [projectFilter, setProjectFilter] = useState('Tout')
  const [view,    setView]    = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Doc | null>(null)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(false)

  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true)
    const type = filter === 'Tout' ? '' : filter
    const r = await fetch(`/api/admin/invoices?type=${type}`)
    const j = await r.json()
    if (j.tableNotFound) setTableNotFound(true)
    if (j.success) setDocs(j.data ?? [])
    setLoadingDocs(false)
  }, [filter])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  useEffect(() => {
    const checkEdit = () => {
      const editId = localStorage.getItem('ngbureau_edit_invoice');
      if (editId) {
        localStorage.removeItem('ngbureau_edit_invoice');
        const docToEdit = docs.find(d => d.id === editId);
        if (docToEdit) {
          setEditing(docToEdit);
          setView('form');
        } else {
          fetch(`/api/admin/invoices?id=${editId}`).then(r => r.json()).then(j => {
            if (j.success && j.data) {
              setEditing(j.data);
              setView('form');
            }
          });
        }
      }
    };
    checkEdit();
    window.addEventListener('checkInvoiceEdit', checkEdit);
    return () => window.removeEventListener('checkInvoiceEdit', checkEdit);
  }, [docs]);

  useEffect(() => {
    fetch('/api/admin/clients').then((r) => r.json()).then((j) => {
      if (j.success) setClients(j.data.map((c: { id: string; name: string; email: string; phone?: string; client_code?: string }) => ({
        id: c.id, name: c.name, email: c.email, phone: c.phone, client_code: c.client_code,
      })))
    })
  }, [])

  useEffect(() => {
    if (clientFilter !== 'Tout') {
      const c = clients.find(cl => (cl.name || cl.email) === clientFilter)
      if (c) {
        fetch(`/api/admin/client-projects?client_id=${c.id}`).then(r => r.json()).then(j => {
          if (j.success) setClientProjects(j.data)
          else setClientProjects([])
        })
      }
    } else {
      setClientProjects([])
      setProjectFilter('Tout')
    }
  }, [clientFilter, clients])

  const openNew  = () => { setEditing(null); setView('form') }
  const openEdit = (doc: Doc) => { setEditing(doc); setView('form') }
  const closeForm = () => { setView('list'); setEditing(null) }
  const afterSave = () => { closeForm(); fetchDocs() }

  const deleteDoc = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return
    await fetch(`/api/admin/invoices/${id}`, { method: 'DELETE' })
    fetchDocs()
  }

  const filtered = docs.filter((d) => {
    const matchType = filter === 'Tout' || d.type === filter;
    const matchClient = clientFilter === 'Tout' || 
      (d.client_name && d.client_name === clientFilter) || 
      (d.client_email && d.client_email === clientFilter);
    
    let matchProject = true;
    if (projectFilter !== 'Tout') {
      const p = clientProjects.find(x => x.id === projectFilter);
      if (p) {
        matchProject = (d.id === p.invoice_id) || (d.objet && d.objet.includes(p.designation));
      }
    }

    return matchType && matchClient && matchProject;
  })

  const filteredClients = clients.filter(c => 
    (c.name || c.email).toLowerCase().includes(clientSearch.toLowerCase())
  )

  if (tableNotFound && view !== 'form') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center p-8 h-full">
        <AlertCircle size={40} className="text-yellow-400" />
        <h3 className="font-bold text-lg">Table <code>plans.documents</code> introuvable</h3>
        <p className="text-sm text-muted-foreground max-w-lg">
          Exécutez ce SQL dans le <strong>SQL Editor</strong> de Supabase :
        </p>
        <pre className="bg-muted rounded-xl p-4 text-xs text-left overflow-x-auto max-w-2xl w-full whitespace-pre-wrap">{
`CREATE TABLE IF NOT EXISTS plans.documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL DEFAULT 'Facture',
  number      text NOT NULL,
  client_name text, client_email text, client_phone text, client_address text,
  date text, due_date text, objet text,
  items       jsonb DEFAULT '[]',
  tva_rate    text DEFAULT '18 %',
  total_ht    numeric DEFAULT 0, total_tva numeric DEFAULT 0, total numeric DEFAULT 0,
  notes text, status text DEFAULT 'draft',
  created_at  timestamptz DEFAULT now()
);`}</pre>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setTableNotFound(false); fetchDocs() }}>
            <RefreshCw size={14} className="mr-2" /> Réessayer
          </Button>
          <Button onClick={openNew}><Plus size={14} className="mr-2" /> Créer quand même</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-130px)] animate-in fade-in duration-500">

      {/* ── Left panel: list ───────────────────────────────────────────────── */}
      <div className={`flex flex-col bg-card border rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${view === 'form' ? 'w-72 shrink-0' : 'flex-1'}`}>
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0">
          <span className="font-semibold text-sm">Documents ({filtered.length})</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fetchDocs} disabled={loadingDocs}>
              <RefreshCw size={13} className={loadingDocs ? 'animate-spin' : ''} />
            </Button>
            <Button size="sm" className="h-7 gap-1 px-2" onClick={openNew}>
              <Plus size={13} /> Nouveau
            </Button>
          </div>
        </div>
        <div className="flex px-3 pt-2 gap-1 shrink-0 flex-wrap">
          {(['Tout', ...DOC_TYPES] as const).map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${filter === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/50'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="px-3 pt-2 pb-3 shrink-0 border-b relative">
          <p className="text-xs font-bold text-muted-foreground mb-2 px-1">Filtrer par client :</p>
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input 
                value={isClientDropdownOpen ? clientSearch : (clientFilter === 'Tout' ? '' : clientFilter)}
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
                placeholder={clientFilter === 'Tout' ? "Rechercher un client..." : clientFilter}
                className="pl-8 h-9 text-sm w-full bg-muted/50 border-transparent focus-visible:ring-1 focus-visible:ring-foreground focus-visible:border-input transition-all cursor-pointer"
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
                  const isSelected = clientFilter === val;
                  return (
                    <button 
                      key={c.id}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between ${isSelected ? 'font-semibold bg-muted/40' : ''}`}
                      onMouseDown={() => { setClientFilter(val); setIsClientDropdownOpen(false); }}
                    >
                      <span className="truncate pr-2">{val}</span>
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
        </div>

        {/* ── Projet Filter ── */}
        {clientProjects.length > 0 && (
          <div className="px-3 py-2 shrink-0 border-b bg-muted/10 animate-in fade-in slide-in-from-top-2">
            <p className="text-xs font-bold text-muted-foreground mb-1 px-1">Projet du client :</p>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="Tout">Tous ses projets</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.custom_id} — {p.designation}</option>
              ))}
            </select>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {filtered.length === 0 && !loadingDocs && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <FileText size={32} className="mx-auto mb-3 opacity-40" />Aucun document
              </div>
            )}
            {filtered.map((doc) => (
              <div key={doc.id}
                className={`bg-muted/40 border rounded-xl p-3 cursor-pointer hover:bg-muted/70 transition-colors group ${editing?.id === doc.id ? 'ring-2 ring-foreground' : ''}`}
                onClick={() => openEdit(doc)}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${DOC_COLORS[doc.type as DocType] ?? ''}`}>{doc.type}</span>
                  <span className="text-xs text-muted-foreground font-mono truncate ml-2">{doc.number}</span>
                </div>
                <p className="text-sm font-medium truncate">{doc.client_name || doc.client_email || '—'}</p>
                {doc.objet && <p className="text-xs text-muted-foreground truncate">{doc.objet}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-bold text-yellow-400">{fmtNum(n(doc.total))}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button aria-label="Modifier la facture" className="p-1 text-muted-foreground hover:text-foreground rounded" onClick={(e) => { e.stopPropagation(); openEdit(doc) }}>
                      <Edit2 size={12} />
                    </button>
                    <button aria-label="Supprimer la facture" className="p-1 text-muted-foreground hover:text-destructive rounded" onClick={(e) => { e.stopPropagation(); doc.id && deleteDoc(doc.id) }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right panel: form ──────────────────────────────────────────────── */}
      {view === 'form' && (() => {
        const selectedClientFromFilter = clientFilter !== 'Tout' 
          ? clients.find(c => (c.name || c.email) === clientFilter)
          : undefined;
        const defaultType = filter !== 'Tout' ? filter : 'Facture';
        return (
          <div className="flex-1 min-w-0 bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <DocForm 
              doc={editing} 
              initialClient={selectedClientFromFilter} 
              initialType={defaultType as DocType} 
              clients={clients} 
              onSave={afterSave} 
              onCancel={closeForm} 
            />
          </div>
        );
      })()}
    </div>
  )
}

// ─── Document Form ────────────────────────────────────────────────────────────

function DocForm({ doc, initialClient, initialType, clients, onSave, onCancel }: {
  doc: Doc | null; initialClient?: ClientRow; initialType?: DocType; clients: ClientRow[]; onSave: () => void; onCancel: () => void
}) {
  const isEdit = !!doc?.id
  const [type,    setType]    = useState<DocType>(doc?.type ?? initialType ?? 'Facture')
  const [number,  setNumber]  = useState(doc?.number ?? genRef(doc?.type ?? initialType ?? 'Facture'))

  const initNameVal = doc?.client_name ?? initialClient?.name ?? '';
  const initCiv = initNameVal.startsWith('Mme ') ? 'Mme' : initNameVal.startsWith('M. ') ? 'M.' : 'M./Mme';
  const initNameClean = initNameVal.replace(/^(Mme |M\. )/, '');
  
  const [civility, setCivility] = useState(initCiv)
  const [name,    setName]    = useState(initNameClean)
  const [email,   setEmail]   = useState(doc?.client_email ?? initialClient?.email ?? '')
  const [phone,   setPhone]   = useState(doc?.client_phone ?? initialClient?.phone ?? '')
  const [address, setAddress] = useState(doc?.client_address ?? '')
  const [date,    setDate]    = useState(doc?.date ?? todayStr())
  const [dueDate, setDueDate] = useState(doc?.due_date ?? '')
  const [objet,   setObjet]   = useState(doc?.objet ?? '')
  const [items,   setItems]   = useState<DocItem[]>(doc?.items?.length ? doc.items : [{ desc: '', qty: 1, price: 0 }])
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null)
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null)
  const [dragEnabledIdx, setDragEnabledIdx]   = useState<number | null>(null)
  const [tva,     setTva]     = useState(doc?.tva_rate ?? '18 %')
  const [notes,   setNotes]   = useState(doc?.notes ?? 'Paiement à réception de facture.\nMerci de votre confiance.')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // AI
  const [aiPrompt,    setAiPrompt]    = useState(DEFAULT_AI_PROMPT)
  const [showAIPaste, setShowAIPaste] = useState(false)
  const [showPrompt,  setShowPrompt]  = useState(false)

  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiProcessingStatus, setAiProcessingStatus] = useState('')

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const formEl = document.getElementById('doc-form')
      if (!formEl) return

      const items = e.clipboardData?.items;
      if (!items) return;

      let hasImage = false;
      let imageFile: File | null = null;
      let textContent = '';

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          hasImage = true;
          imageFile = item.getAsFile();
          break;
        } else if (item.type === 'text/plain') {
          textContent = e.clipboardData.getData('text');
        }
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
  
  const [aiNotesPrompt,    setAiNotesPrompt]    = useState(DEFAULT_NOTES_PROMPT)
  const [showNotesPrompt,  setShowNotesPrompt]  = useState(false)
  const [generatingNotes,  setGeneratingNotes]  = useState(false)

  // Models
  const [showModels,    setShowModels]    = useState(false)
  const [modelName,     setModelName]     = useState('')
  const [showSaveModel, setShowSaveModel] = useState(false)

  const jsonInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!isEdit) setNumber(genRef(type)) }, [type, isEdit])

  // ── Totals ────────────────────────────────────────────────────────────────

  const ht     = items.reduce((s, i) => s + n(i.qty) * n(i.price), 0)
  const tvaPct = parseFloat(tva.replace(' %', '')) / 100
  const tvaVal = ht * tvaPct
  const ttc    = ht + tvaVal

  // ── Items ─────────────────────────────────────────────────────────────────

  const addItem    = () => setItems((v) => [...v, { desc: '', qty: 1, price: 0 }])
  const removeItem = (i: number) => setItems((v) => v.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof DocItem, val: string | number) =>
    setItems((v) => v.map((row, idx) => idx === i ? { ...row, [field]: field === 'desc' ? val : n(val) } : row))

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverItemIdx !== index) setDragOverItemIdx(index)
  }
  const handleDragEnd = () => {
    setDraggedItemIdx(null)
    setDragOverItemIdx(null)
    setDragEnabledIdx(null)
  }
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedItemIdx === null) return
    if (draggedItemIdx !== index) {
      const newItems = [...items]
      const draggedItem = newItems.splice(draggedItemIdx, 1)[0]
      newItems.splice(index, 0, draggedItem)
      setItems(newItems)
    }
    handleDragEnd()
  }

  // Selected client for code retrieval
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(
    doc?.client_name 
      ? clients.find(c => c.name === doc.client_name || c.email === doc.client_email) ?? null 
      : initialClient ?? null
  )

  // ── Client selector ───────────────────────────────────────────────────────

  const selectClient = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const c = clients.find((cl) => cl.id === e.target.value)
    if (c) { 
      const cNameVal = c.name || '';
      const cCiv = cNameVal.startsWith('Mme ') ? 'Mme' : cNameVal.startsWith('M. ') ? 'M.' : 'M./Mme';
      const cNameClean = cNameVal.replace(/^(Mme |M\. )/, '');
      setCivility(cCiv);
      setName(cNameClean); 
      setEmail(c.email); 
      setPhone(c.phone ?? ''); 
      setSelectedClient(c);
    }
  }

  // ── Parse AI paste ────────────────────────────────────────────────────────

  function parseAIPaste(raw: string): DocItem[] {
    const parsed: DocItem[] = []
    // Support {(…)} and {[…]} formats
    const matches = Array.from(raw.matchAll(/[({[]([^)\]}]+)[)\]}]/g))
    for (const m of matches) {
      const parts = m[1].split(';').map((s) => s.trim())
      if (parts.length < 3) continue
      const desc = parts[0]
      if (!desc || desc.toLowerCase().startsWith('description')) continue
      // Detect if parts[1] is "ff" (non-numeric label field from desktop format)
      const idx2Is = /^\d/.test(parts[1]) ? 0 : 1   // skip non-numeric "ff" field
      const qty    = parseFloat(parts[1 + idx2Is]) || 1
      const price  = parseFloat(parts[2 + idx2Is]) || 0
      parsed.push({ desc, qty, price })
    }
    return parsed
  }

  // ── AI Direct Generation for Notes ────────────────────────────────────────

  async function generateNotesDirect() {
    setGeneratingNotes(true)
    try {
      const basePrompt = aiNotesPrompt.replace('{doc_type}', type).replace('{objet}', objet || '…').replace('{client}', name || email || '…')
      const finalPrompt = notes.trim() 
        ? `${basePrompt}\n\nVoici le texte actuel à reformuler ou améliorer :\n"${notes}"`
        : `${basePrompt}\n\nGénère une proposition de conditions standard appropriée.`

      const deepseekKey = typeof window !== 'undefined' ? (localStorage.getItem('deepseek_api_key') || '') : ''
      const res = await fetch('/api/ai/description', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-DeepSeek-Key': deepseekKey
        },
        body: JSON.stringify({ prompt: finalPrompt })
      })
      const j = await res.json()
      if (j.success && j.text) setNotes(j.text)
      else alert("Erreur lors de la génération IA : " + (j.error || "Inconnue"))
    } catch (e) {
      alert("Erreur réseau lors de la génération")
    } finally {
      setGeneratingNotes(false)
    }
  }

  // ── Models (localStorage) ─────────────────────────────────────────────────

  function collectFormData() {
    const finalName = civility !== 'M./Mme' ? `${civility} ${name}` : name;
    return { type, number, client_name: finalName, client_email: email, client_phone: phone, client_address: address,
             date, due_date: dueDate, objet, items, tva_rate: tva, notes }
  }
  function applyFormData(data: Record<string, unknown>) {
    if (data.type && DOC_TYPES.includes(data.type as DocType)) setType(data.type as DocType)
    if (data.client_name) {
      const cNameVal = data.client_name as string;
      const cCiv = cNameVal.startsWith('Mme ') ? 'Mme' : cNameVal.startsWith('M. ') ? 'M.' : 'M./Mme';
      const cNameClean = cNameVal.replace(/^(Mme |M\. )/, '');
      setCivility(cCiv);
      setName(cNameClean);
    }
    if (data.client_email)   setEmail(data.client_email as string)
    if (data.client_phone)   setPhone(data.client_phone as string)
    if (data.client_address) setAddress(data.client_address as string)
    if (data.objet)    setObjet(data.objet as string)
    if (data.due_date) setDueDate(data.due_date as string)
    if (data.tva_rate) setTva(data.tva_rate as string)
    if (data.notes)    setNotes(data.notes as string)
    if (Array.isArray(data.items) && data.items.length) setItems(data.items as DocItem[])
  }

  function getSavedModels(): { name: string; data: Record<string, unknown> }[] {
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
    const models = getSavedModels().filter((_, idx) => idx !== i)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
  }

  // ── Import JSON file ───────────────────────────────────────────────────────

  function handleImportJSON(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (data.items || data.client_name || data.objet) applyFormData(data)
        else alert('Format JSON invalide (doit contenir items, client_name ou objet)')
      } catch { alert('Fichier JSON invalide') }
    }
    reader.readAsText(file)
  }

  // ── Export JSON ────────────────────────────────────────────────────────────

  function exportJSON() {
    const data = { ...collectFormData(), total_ht: ht, total_tva: tvaVal, total: ttc }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${type}_${number}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  function exportCSV() {
    const lines = [
      `${type} — ${number}`,
      `Client:;${name};${email}`,
      `Date:;${date};Échéance:;${dueDate}`,
      `Objet:;${objet}`,
      '',
      'Description;Qté;Prix unit.;Total',
      ...items.map((i) => `${i.desc};${n(i.qty)};${n(i.price)};${n(i.qty) * n(i.price)}`),
      '',
      `Sous-total HT;${ht}`,
      `TVA (${tva});${tvaVal}`,
      `Total TTC;${ttc}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${type}_${number}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── Preview / PDF ──────────────────────────────────────────────────────────

  async function toBase64(url: string): Promise<string> {
    try {
      const r = await fetch(url); const b = await r.blob()
      return await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b) })
    } catch { return '' }
  }

  async function openPreview(autoPrint = false) {
    const base = window.location.origin
    const [logo64, sig64, stamp64] = await Promise.all([
      toBase64(base + '/ngnior-logo.png'),
      toBase64(base + '/signature.png'),
      toBase64(base + '/tampon.png'),
    ])

    const rows = items.map((i) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #ddd">${i.desc}</td>
        <td style="text-align:center;padding:7px 10px;border-bottom:1px solid #ddd">${n(i.qty)}</td>
        <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${n(i.price).toLocaleString('fr-FR')} F CFA</td>
        <td style="text-align:right;padding:7px 10px;border-bottom:1px solid #ddd">${(n(i.qty)*n(i.price)).toLocaleString('fr-FR')} F CFA</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${type} ${number}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#fff;width:210mm;min-height:297mm;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{width:210mm;min-height:297mm;padding:0;display:flex;flex-direction:column}
  /* header */
  .header{background:#000;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:12px 20px}
  .header-logo img{height:60px;object-fit:contain}
  .header-title{text-align:right}
  .header-title h1{font-size:28px;font-weight:900;letter-spacing:1px;margin-bottom:2px}
  .header-title .ref{font-size:12px}
  /* company info */
  .company{padding:10px 20px 8px}
  .company h2{font-size:14px;font-weight:bold}
  .company p{font-size:10px;color:#444;line-height:1.6}
  .company a{color:#0066cc;text-decoration:none}
  hr.divider{border:none;border-top:2px solid #000;margin:0 20px}
  /* client section */
  .client-block{padding:10px 20px}
  .client-block h4{font-size:10px;font-weight:bold;text-decoration:underline;margin-bottom:4px}
  .client-block p{font-size:10px;line-height:1.8}
  /* table */
  .items-table{width:calc(100% - 40px);margin:6px 20px;border-collapse:collapse}
  .items-table thead tr{background:#000;color:#fff}
  .items-table thead th{padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  .items-table thead th:nth-child(2){text-align:center}
  .items-table thead th:nth-child(3),.items-table thead th:nth-child(4){text-align:right}
  .items-table tbody tr:nth-child(even){background:#f9f9f9}
  .items-table tbody td{font-size:10px}
  /* totals */
  .totals{margin:6px 20px 0 auto;width:280px}
  .totals table{width:100%;border-collapse:collapse}
  .totals td{padding:5px 8px;font-size:11px}
  .totals td:last-child{text-align:right}
  .totals .total-row{font-weight:bold;font-size:13px;border-top:2px solid #000;background:#eee}
  /* notes */
  .notes{padding:10px 20px;font-style:italic;color:#555;font-size:10px;border-top:1px solid #ccc;margin-top:8px}
  /* footer signature area */
  .sign-area{display:flex;justify-content:space-between;align-items:flex-end;padding:16px 40px 10px}
  .sign-block{text-align:center}
  .sign-block img{height:80px;object-fit:contain;display:block;margin:0 auto}
  .sign-block p{font-size:10px;font-weight:bold;margin-top:4px}
  .sign-block span{font-size:10px;color:#444}
  /* page footer */
  .page-footer{margin-top:30px;background:#fff;color:#000;padding:10px 20px 20px;font-size:11px;border-top:3px solid #000;line-height:1.6;}
  .page-footer a{color:#000;text-decoration:none}
  /* print button */
  .print-bar{display:flex;gap:10px;justify-content:center;padding:16px;background:#f0f0f0;border-bottom:1px solid #ddd}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:bold}
  .btn-pdf{background:#000;color:#fff}
  .btn-close{background:#eee;color:#333}
  @media print{.print-bar{display:none!important}body,html{width:210mm}@page{margin:0}}
</style></head><body>
<div class="print-bar no-print">
  <button class="btn btn-pdf" onclick="window.print()">⬇ Télécharger / Imprimer PDF</button>
  <button class="btn btn-close" onclick="window.close()">✕ Fermer</button>
</div>
<div class="page">
  <!-- HEADER -->
  <div class="header">
    <div class="header-logo">${logo64 ? `<img src="${logo64}" alt="NGnior Conception">` : '<span style="font-size:22px;font-weight:900">NGnior</span>'}</div>
    <div class="header-title">
      <h1>${type.toUpperCase()}</h1>
      <div class="ref">N° : <strong>${number}</strong></div>
      <div class="ref">Date : ${date}</div>
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
    <p>${civility !== 'M./Mme' ? civility + ' ' : 'M./Mme '}${name || '—'}<br>
    ${email ? `Email : ${email}<br>` : ''}
    ${phone ? `Tél : ${phone}<br>` : ''}
    ${address ? `${address}` : ''}
    </p>
  </div>
  ${objet ? `<div style="padding:4px 20px 6px;font-size:10px"><strong>Objet :</strong> ${objet}</div>` : ''}

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
      <tr><td>SOUS-TOTAL HT :</td><td>${ht.toLocaleString('fr-FR')} F CFA</td></tr>
      <tr><td>TVA (${tva}) :</td><td>${tvaVal.toLocaleString('fr-FR')} F CFA</td></tr>
      <tr class="total-row"><td><strong>TOTAL TTC :</strong></td><td><strong>${ttc.toLocaleString('fr-FR')} F CFA</strong></td></tr>
    </table>
  </div>

  <!-- NOTES -->
  ${notes ? `<div class="notes">${notes.replace(/\n/g,'<br>')}</div>` : ''}

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
${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  // ── Save to DB ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true); setError('')
    const finalName = civility !== 'M./Mme' ? `${civility} ${name}` : name;
    
    const payload: any = {
      type, 
      client_name: finalName, client_email: email, client_phone: phone, client_address: address,
      date, due_date: dueDate, objet,
      items: items.filter((i) => i.desc.trim()),
      tva_rate: tva, total_ht: ht, total_tva: tvaVal, total: ttc,
      notes, status: 'draft',
    }
    
    if (isEdit) {
      payload.number = number;
    } else {
      payload.generate_number = true;
      payload.client_code = selectedClient?.client_code;
    }

    const url    = isEdit ? `/api/admin/invoices/${doc!.id}` : '/api/admin/invoices'
    const method = isEdit ? 'PUT' : 'POST'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const j = await r.json()
    if (j.tableNotFound) setError('Table documents inexistante — voir message sur la page liste')
    else if (!j.success) setError(j.error ?? 'Erreur')
    else {
      // Create a temporary toast element for confirmation
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100] animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-2';
      toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Document ${j.data?.number || number} enregistré`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
      onSave();
    }
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden relative" id="doc-form">
      {isAiProcessing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-4">
          <Loader2 className="animate-spin text-primary mb-3" size={36} />
          <p className="text-sm font-semibold">{aiProcessingStatus}</p>
          <p className="text-xs text-muted-foreground mt-1">Veuillez patienter pendant le traitement...</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{isEdit ? 'Modifier' : 'Nouveau document'}</span>
          <div className="flex gap-1">
            {DOC_TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`px-2 py-0.5 text-xs rounded-md font-semibold transition-colors ${type === t ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Model bar */}
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => setShowModels(true)}>
            📋 Charger modèle
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => {
            const input = jsonInputRef.current; input?.click()
          }}>
            <FileJson size={13} /> Importer JSON
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs px-2" onClick={() => setShowSaveModel(true)}>
            <Save size={13} /> Sauver modèle
          </Button>
          <input ref={jsonInputRef} type="file" accept=".json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportJSON(f); e.target.value = '' }} />
        </div>

        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-4">

          {/* ── Client ───────────────────────────────────────────────────── */}
          <Section title="Informations client">
            <select id="project-client" onChange={selectClient} value={selectedClient?.id ?? ""}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mb-3">
              <option value="">Saisir manuellement</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.email}  &lt;{c.email}&gt;</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <FField label="Nom du client">
                <div className="flex gap-2">
                  <select value={civility} onChange={e => setCivility(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm w-28 shrink-0 focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="M./Mme">M./Mme</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                  <Input id="client-firstname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du client" className="flex-1" />
                </div>
              </FField>
              <FField label="Email"><Input id="client-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" /></FField>
              <FField label="Téléphone"><Input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+226 70 00 00 00" /></FField>
              <FField label="Adresse"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ouagadougou, BF" /></FField>
            </div>
          </Section>

          {/* ── Détails ──────────────────────────────────────────────────── */}
          <Section title="Détails du document">
            <div className="grid grid-cols-3 gap-3">
              <FField label="N° Référence"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></FField>
              <FField label="Date"><Input value={date} onChange={(e) => setDate(e.target.value)} /></FField>
              <FField label="Échéance"><Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="jj/mm/aaaa" /></FField>
            </div>
          </Section>

          {/* ── Objet ────────────────────────────────────────────────────── */}
          <Section title="Objet du document">
            <Input id="project-designation" value={objet} onChange={(e) => setObjet(e.target.value)}
              placeholder="ex : Fourniture de matériaux de construction — Projet Villa R+1" />
          </Section>

          {/* ── Articles ─────────────────────────────────────────────────── */}
          <Section title="Articles / Prestations">
            {/* AI bar */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setShowAIPaste(true)} className="gap-1">
                <Bot size={13} /> Générer avec l'IA
              </Button>
              <Button size="sm" variant="outline" className="px-2" onClick={() => setShowPrompt(true)}>
                <Settings2 size={13} />
              </Button>
            </div>
            {/* Table header */}
            <div className="grid grid-cols-[24px_1fr_64px_110px_90px_28px] gap-1 px-1 mb-1">
              {['', 'Description', 'Qté', 'Prix unit. (F)', 'Total', ''].map((h, i) => (
                <span key={i} className="text-xs font-bold text-muted-foreground">{h}</span>
              ))}
            </div>
            {/* Rows */}
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={i} 
                  draggable={dragEnabledIdx === i}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`relative transition-opacity ${draggedItemIdx === i ? 'opacity-40' : ''}`}
                >
                  {dragOverItemIdx === i && draggedItemIdx !== null && draggedItemIdx > i && (
                    <div className="absolute -top-[3px] left-0 right-0 h-[2px] bg-foreground rounded-full z-10" />
                  )}
                  {dragOverItemIdx === i && draggedItemIdx !== null && draggedItemIdx < i && (
                    <div className="absolute -bottom-[3px] left-0 right-0 h-[2px] bg-foreground rounded-full z-10" />
                  )}
                  <div className={`grid grid-cols-[24px_1fr_64px_110px_90px_28px] gap-1 items-center bg-card rounded-md ${dragOverItemIdx === i ? 'bg-muted/30' : ''}`}>
                    <div 
                      onMouseEnter={() => setDragEnabledIdx(i)}
                      onMouseLeave={() => setDragEnabledIdx(null)}
                      className="flex items-center justify-center h-8 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground transition-colors"
                      title="Maintenir pour déplacer"
                    >
                      <GripVertical size={14} />
                    </div>
                    <Input value={item.desc} onChange={(e) => updateItem(i, 'desc', e.target.value)}
                      placeholder="Description" className="h-8 text-sm" />
                    <Input type="number" value={item.qty === 0 ? '' : item.qty}
                      onChange={(e) => updateItem(i, 'qty', e.target.value)}
                      placeholder="1" className="h-8 text-sm text-center" />
                    <Input type="number" id={i === 0 ? "invoice-unit-price" : undefined} value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateItem(i, 'price', e.target.value)}
                      onInput={(e) => updateItem(i, 'price', e.currentTarget.value)}
                      placeholder="0" className="h-8 text-sm text-right" />
                    <span className="text-xs text-right text-muted-foreground pr-1 tabular-nums">
                      {(n(item.qty) * n(item.price)).toLocaleString('fr-FR')}
                    </span>
                    <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive p-1">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={addItem} className="mt-2 gap-1">
              <Plus size={13} /> Ajouter une ligne
            </Button>
          </Section>

          {/* ── Récapitulatif ─────────────────────────────────────────────── */}
          <Section title="Récapitulatif">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total HT :</span>
                <span className="font-medium tabular-nums">{fmtNum(ht)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">TVA :</span>
                  <select value={tva} onChange={(e) => setTva(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                    {TVA_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <span className="tabular-nums">{fmtNum(tvaVal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Total TTC :</span>
                <span className="text-yellow-400 tabular-nums">{fmtNum(ttc)}</span>
              </div>
            </div>
          </Section>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <Section title="Notes / Conditions">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={generateNotesDirect} disabled={generatingNotes} className="gap-1">
                {generatingNotes ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                {generatingNotes ? "Génération en cours..." : "Générer avec l'IA"}
              </Button>
              <Button size="sm" variant="outline" className="px-2" onClick={() => setShowNotesPrompt(true)}>
                <Settings2 size={13} />
              </Button>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </Section>

          {/* ── Export buttons ────────────────────────────────────────────── */}
          <div className="flex gap-2 flex-wrap pb-2">
            <Button variant="outline" onClick={() => openPreview(false)} className="gap-1 flex-1 min-w-[100px]">
              <Eye size={14} /> Aperçu
            </Button>
            <Button onClick={() => openPreview(true)} className="gap-1 flex-1 min-w-[100px] bg-foreground text-background hover:bg-foreground/90">
              <Printer size={14} /> PDF
            </Button>
            <Button variant="outline" onClick={exportCSV} className="gap-1 flex-1 min-w-[100px]">
              <FileSpreadsheet size={14} /> Excel / CSV
            </Button>
            <Button variant="outline" onClick={exportJSON} className="gap-1 flex-1 min-w-[100px]">
              <FileJson size={14} /> JSON
            </Button>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t bg-card sticky bottom-0 z-50 mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {error && <p className="text-destructive text-xs mb-2">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
          <Button id="btn-save-invoice" onClick={handleSave} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Enregistrer' : 'Créer le document'}
          </Button>
        </div>
      </div>

      {/* ══ Modals ══════════════════════════════════════════════════════════════ */}

      {/* AI Paste Modal */}
      {showAIPaste && (
        <AIPasteModal
          prompt={aiPrompt} type={type} objet={objet} client={name || email}
          onImport={(parsed) => { setItems(parsed); setShowAIPaste(false) }}
          onClose={() => setShowAIPaste(false)}
          parseAIPaste={parseAIPaste}
        />
      )}

      {/* Prompt Modal */}
      {showPrompt && (
        <PromptModal title="Prompt IA — Articles" subtitle="Variables : {doc_type}  {objet}  {client}"
          value={aiPrompt} defaultValue={DEFAULT_AI_PROMPT}
          onSave={(v) => { setAiPrompt(v); setShowPrompt(false) }}
          onClose={() => setShowPrompt(false)} />
      )}

      {/* Prompt Modal for Notes */}
      {showNotesPrompt && (
        <PromptModal title="Prompt IA — Notes & Conditions" subtitle="Variables : {doc_type}  {objet}  {client}"
          value={aiNotesPrompt} defaultValue={DEFAULT_NOTES_PROMPT}
          onSave={(v) => { setAiNotesPrompt(v); setShowNotesPrompt(false) }}
          onClose={() => setShowNotesPrompt(false)} />
      )}

      {/* Save Model Modal */}
      {showSaveModel && (
        <Overlay onClose={() => setShowSaveModel(false)} title="Sauver le modèle">
          <div className="space-y-3">
            <FField label="Nom du modèle">
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)}
                placeholder="ex: Permis de Construire R+1" onKeyDown={(e) => e.key === 'Enter' && saveModel()} />
            </FField>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSaveModel(false)}>Annuler</Button>
              <Button className="flex-1" onClick={saveModel}><Save size={14} className="mr-1" /> Enregistrer</Button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Load Model Modal */}
      {showModels && (
        <ModelPickerModal
          onLoad={(data) => { applyFormData(data); setShowModels(false) }}
          onClose={() => setShowModels(false)}
          getSavedModels={getSavedModels}
          deleteModel={deleteModel}
        />
      )}
    </div>
  )
}

// ─── AI Paste Modal ────────────────────────────────────────────────────────────

function AIPasteModal({ prompt, type, objet, client, onImport, onClose, parseAIPaste }: {
  prompt: string; type: string; objet: string; client: string
  onImport: (items: DocItem[]) => void
  onClose: () => void
  parseAIPaste: (raw: string) => DocItem[]
}) {
  const [text,   setText]   = useState('')
  const [status, setStatus] = useState('')
  const fullPrompt = prompt.replace('{doc_type}', type).replace('{objet}', objet || '…').replace('{client}', client || '…')

  function validate() {
    if (!text.trim()) { setStatus('⚠ Collez le texte IA ici.'); return }
    const parsed = parseAIPaste(text)
    if (parsed.length === 0) { setStatus('⚠ Format non reconnu — utilisez {(desc;qty;prix;total);…}'); return }
    onImport(parsed)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h4 className="font-bold">✦ Générer avec l'IA — Coller le texte</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Format : {'{(Description;Quantité;Prix_unit;Total);(…)}'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Prompt to copy */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Prompt à envoyer à l'IA</span>
              <button className="text-xs text-blue-400 hover:underline" onClick={() => navigator.clipboard.writeText(fullPrompt)}>
                Copier le prompt
              </button>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
              {fullPrompt}
            </pre>
          </div>

          {/* Paste area */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1">Coller la réponse IA ici</label>
            <textarea value={text} onChange={(e) => { setText(e.target.value); setStatus('') }}
              rows={8} autoFocus
              placeholder={`{(Ciment CPA 45 – Sac 50kg;10;5750;57500);(Sable fin – m³;5;15000;75000)}`}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            {status && <p className="text-xs text-destructive mt-1">{status}</p>}
          </div>
        </div>

        <div className="p-5 border-t flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={validate}><Download size={14} className="mr-1" /> Importer les lignes</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Model Picker Modal ────────────────────────────────────────────────────────

function ModelPickerModal({ onLoad, onClose, getSavedModels, deleteModel }: {
  onLoad: (data: Record<string, unknown>) => void
  onClose: () => void
  getSavedModels: () => { name: string; data: Record<string, unknown> }[]
  deleteModel: (i: number) => void
}) {
  const [models, setModels] = useState(() => getSavedModels())
  const [sel, setSel] = useState(-1)

  function doDelete(i: number) {
    deleteModel(i)
    setModels(getSavedModels())
    if (sel >= i) setSel(Math.max(-1, sel - 1))
  }

  return (
    <Overlay onClose={onClose} title="📋 Charger un modèle">
      {models.length === 0
        ? <p className="text-sm text-muted-foreground py-4 text-center">Aucun modèle sauvegardé.<br />Utilisez « Sauver modèle » d'abord.</p>
        : (
          <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
            {models.map((m, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${sel === i ? 'bg-foreground/10 border-foreground' : 'hover:bg-muted/50'}`}
                onClick={() => setSel(i)}>
                <input type="radio" checked={sel === i} readOnly className="shrink-0" />
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">{(m.data.type as string) || ''}</span>
                <button onClick={(e) => { e.stopPropagation(); doDelete(i) }} className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button className="flex-1" disabled={sel === -1} onClick={() => sel !== -1 && onLoad(models[sel].data)}>
          Charger
        </Button>
      </div>
    </Overlay>
  )
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}
function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h4 className="font-bold">{title}</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
function PromptModal({ title, subtitle, value, defaultValue, onSave, onClose }: {
  title: string; subtitle?: string; value: string; defaultValue: string
  onSave: (v: string) => void; onClose: () => void
}) {
  const [v, setV] = useState(value)
  const [dsKey, setDsKey] = useState('')
  const [glmKey, setGlmKey] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDsKey(localStorage.getItem('deepseek_api_key') || '')
      setGlmKey(localStorage.getItem('glm_api_key') || '')
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h4 className="font-bold">{title}</h4>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Clé API DeepSeek</label>
              <Input 
                type="password" 
                placeholder="sk-..." 
                value={dsKey} 
                onChange={(e) => {
                  setDsKey(e.target.value)
                  localStorage.setItem('deepseek_api_key', e.target.value)
                }} 
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Clé API GLM (OCR)</label>
              <Input 
                type="password" 
                placeholder="Clé API GLM..." 
                value={glmKey} 
                onChange={(e) => {
                  setGlmKey(e.target.value)
                  localStorage.setItem('glm_api_key', e.target.value)
                }} 
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          <textarea value={v} onChange={(e) => setV(e.target.value)} rows={8}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setV(defaultValue)}>Réinitialiser</Button>
            <Button size="sm" className="flex-1" onClick={() => onSave(v)}>Appliquer</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
