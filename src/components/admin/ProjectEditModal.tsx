'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Save, Trash2, UploadCloud, Link, Loader2, Bot, Settings2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; slug: string; label: string; sort_order: number }

interface ProjectFile {
  id: string; project_id: string; file_name: string
  file_type: string; package_type: string
  storage_path: string; file_size_kb: number
  public_url: string | null; sort_order: number
}

interface Project {
  id: string; slug: string; title: string; tier: string
  description?: string; price_fcfa: number; price_discount?: number
  cover_url?: string; is_active: boolean; created_at: string
  category_id: string; specs?: Record<string, unknown>
  likes_count?: number; views_count?: number
  rating_avg?: number; rating_count?: number
  categories?: { slug: string; label: string }
}

interface Props {
  project: Project
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

// ─── Prompt par défaut ────────────────────────────────────────────────────────

const DEFAULT_PROMPT = `Tu es un expert en architecture et immobilier de luxe.
Génère une description commerciale courte et attractive (2-3 phrases maximum) pour ce projet architectural.

Informations du projet :
- Titre : {title}
- Catégorie : {category}
- Tier : {tier}
- Prix : {price} FCFA
- Chambres : {chambres}
- Superficie : {surface_m2} m²
- Style architectural : {style}
- Étages : {etages}
- Piscine : {piscine}

La description doit être en français, professionnelle et mettre en valeur les points forts du projet. Ne pas inclure le prix dans la description.`

const FILE_ICON: Record<string, string> = {
  image_preview: '🖼', plan_pdf: '📄', plan_dwg: '📐',
  plan_excel: '📊', detail_materiaux: '🏗', estimation_json: '📋',
}

function fmtKb(kb: number) { return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` }

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProjectEditModal({ project, categories, onClose, onSaved }: Props) {
  const specs = (project.specs as Record<string, unknown>) ?? {}

  // Champs de base
  const [title, setTitle]       = useState(project.title)
  const [slug, setSlug]         = useState(project.slug)
  const [tier, setTier]         = useState(project.tier)
  const [price, setPrice]       = useState(project.price_fcfa ?? 0)
  const [discount, setDiscount] = useState(project.price_discount ?? 0)
  const [isActive, setIsActive] = useState(project.is_active)
  const [coverUrl, setCoverUrl] = useState(project.cover_url ?? '')
  const [catId, setCatId]       = useState(project.category_id)
  const [description, setDescription] = useState(project.description ?? '')

  // Specs
  const [chambres, setChambres]   = useState(String(specs.chambres ?? ''))
  const [surface, setSurface]     = useState(String(specs.surface_m2 ?? ''))
  const [style, setStyle]         = useState(String(specs.style ?? ''))
  const [etages, setEtages]       = useState(String(specs.etages ?? ''))
  const [piscine, setPiscine]     = useState(specs.piscine ? 'Oui' : 'Non')

  // Fichiers storage
  const [files, setFiles]   = useState<ProjectFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploadingTier, setUploadingTier] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUpload, setPendingUpload] = useState<{ tier: string; sub: string } | null>(null)

  // IA
  const [aiPrompt, setAiPrompt]     = useState(DEFAULT_PROMPT)
  const [showPrompt, setShowPrompt] = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiStatus, setAiStatus]     = useState('')

  // Sauvegarde
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // URLs panel
  const [showUrls, setShowUrls] = useState(false)

  // Active storage tab — controlled to persist across reloads
  const [storageTab, setStorageTab] = useState('preview')

  // ─── Chargement des fichiers ─────────────────────────────────────────────

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true)
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/files`)
      const json = await res.json()
      if (json.success) setFiles(json.data)
    } finally {
      setLoadingFiles(false)
    }
  }, [project.id])

  useEffect(() => { loadFiles() }, [loadFiles])

  // ─── Sauvegarde projet ───────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const newSpecs: Record<string, unknown> = {}
      if (chambres) newSpecs.chambres = parseInt(chambres) || 0
      if (surface)  newSpecs.surface_m2 = parseFloat(surface) || 0
      if (style)    newSpecs.style = style
      if (etages)   newSpecs.etages = parseInt(etages) || 0
      newSpecs.piscine = piscine === 'Oui'

      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, slug, tier, price_fcfa: price,
          price_discount: discount || null,
          is_active: isActive, cover_url: coverUrl || null,
          category_id: catId, description: description || null, specs: newSpecs,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSaveMsg('✅ Modifications enregistrées')
        onSaved()
        setTimeout(() => setSaveMsg(''), 3000)
      } else {
        setSaveMsg(`❌ ${json.error}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Suppression projet ──────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement "${project.title}" et tous ses fichiers ?`)) return
    await fetch(`/api/admin/projects/${project.id}`, { method: 'DELETE' })
    onSaved()
    onClose()
  }

  // ─── Upload fichier ──────────────────────────────────────────────────────

  const triggerUpload = (tier: string, sub: string) => {
    setPendingUpload({ tier, sub })
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0 || !pendingUpload) return

    // Capture files array BEFORE clearing the input — clearing can invalidate FileList in some browsers
    const selectedFiles = Array.from(fileList)
    e.target.value = ''

    const { tier: t, sub: s } = pendingUpload
    setUploadingTier(`${t}/${s}`)

    await Promise.all(selectedFiles.map((file) => {
      const form = new FormData()
      form.append('file', file)
      form.append('tier', t)
      form.append('subFolder', s)
      return fetch(`/api/admin/projects/${project.id}/files`, { method: 'POST', body: form })
    }))

    await loadFiles()
    setUploadingTier(null)
    setPendingUpload(null)
  }

  // ─── Suppression de tous les fichiers d'un dossier ───────────────────────

  const handleDeleteFolder = async (tier: string, sub: string) => {
    const folderFiles = filesByTierSub(tier, sub)
    if (folderFiles.length === 0) return
    if (!confirm(`Supprimer les ${folderFiles.length} fichier(s) de ${tier}/${sub} ?`)) return
    setUploadingTier(`${tier}/${sub}`)
    await Promise.all(folderFiles.map((f) =>
      fetch(`/api/admin/projects/${project.id}/files/${f.id}`, { method: 'DELETE' })
    ))
    await loadFiles()
    setUploadingTier(null)
  }

  // ─── Suppression fichier ─────────────────────────────────────────────────

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Supprimer ce fichier ?')) return
    await fetch(`/api/admin/projects/${project.id}/files/${fileId}`, { method: 'DELETE' })
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // ─── IA Description ──────────────────────────────────────────────────────

  const generateDescription = async () => {
    setAiLoading(true)
    setAiStatus('Appel DeepSeek…')
    try {
      const catLabel = categories.find((c) => c.id === catId)?.label ?? ''
      const prompt = aiPrompt
        .replace('{title}', title)
        .replace('{category}', catLabel)
        .replace('{tier}', tier)
        .replace('{price}', String(price))
        .replace('{chambres}', chambres || '—')
        .replace('{surface_m2}', surface || '—')
        .replace('{style}', style || '—')
        .replace('{etages}', etages || '—')
        .replace('{piscine}', piscine)

      const res = await fetch('/api/ai/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const json = await res.json()
      if (json.success) {
        setDescription(json.text)
        setAiStatus('✅ Description générée')
      } else {
        setAiStatus(`❌ ${json.error?.slice(0, 60)}`)
      }
    } finally {
      setAiLoading(false)
      setTimeout(() => setAiStatus(''), 3000)
    }
  }

  // ─── Fichiers par tier/sub ───────────────────────────────────────────────

  const filesByTierSub = (t: string, s: string) =>
    files.filter((f) => f.storage_path?.includes(`/${t}/${s}/`))

  const imageFiles = files.filter((f) => f.file_type === 'image_preview')

  // ─── RENDU ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      {/* Fermer en cliquant dehors */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel latéral */}
      <div className="w-full max-w-3xl bg-card border-l flex flex-col shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">{project.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{project.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 size={14} className="mr-1" /> Supprimer
            </Button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ─── Informations base de données ────────────────────────────── */}
          <Section title="Informations base de données">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Titre *">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Slug">
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
              </Field>
              <Field label="Tier">
                <select value={tier} onChange={(e) => setTier(e.target.value)} className={selectCls}>
                  {['preview', 'basic', 'premium'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Actif">
                <select value={isActive ? 'Oui' : 'Non'} onChange={(e) => setIsActive(e.target.value === 'Oui')} className={selectCls}>
                  <option>Oui</option><option>Non</option>
                </select>
              </Field>
              <Field label="Prix (FCFA)">
                <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </Field>
              <Field label="Prix remisé">
                <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </Field>
            </div>

            {/* Cover URL + picker */}
            <Field label="Cover URL">
              <div className="flex gap-2">
                <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="flex-1" placeholder="URL de l'image de couverture" />
                {imageFiles.length > 0 && (
                  <select
                    className={selectCls + ' w-40'}
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) setCoverUrl(e.target.value) }}
                  >
                    <option value="">📷 choisir…</option>
                    {imageFiles.map((f) => (
                      <option key={f.id} value={f.public_url ?? ''}>{f.file_name}</option>
                    ))}
                  </select>
                )}
              </div>
            </Field>

            {/* Catégorie */}
            <Field label="Catégorie">
              <select value={catId} onChange={(e) => setCatId(e.target.value)} className={selectCls}>
                <option value="">Sélectionner…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>

            {/* Stats + ID */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>❤ {project.likes_count ?? 0}</span>
              <span>👁 {project.views_count ?? 0}</span>
              <span>⭐ {(project.rating_avg ?? 0).toFixed(1)} ({project.rating_count ?? 0} avis)</span>
            </div>

            {/* Description + IA */}
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
              {/* Barre IA */}
              <div className="flex items-center gap-2 mt-2">
                <Button type="button" size="sm" variant="outline"
                  className="gap-1.5 bg-blue-950 border-blue-800 text-blue-200 hover:bg-blue-900"
                  onClick={generateDescription} disabled={aiLoading}
                >
                  {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />}
                  Générer
                </Button>
                <Button type="button" size="sm" variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setShowPrompt(true)}
                >
                  <Settings2 size={13} /> Prompt
                </Button>
                {aiStatus && <span className="text-xs text-muted-foreground">{aiStatus}</span>}
              </div>
            </Field>
          </Section>

          {/* ─── Spécifications ──────────────────────────────────────────── */}
          <Section title="Spécifications">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Chambres">
                <Input type="number" value={chambres} onChange={(e) => setChambres(e.target.value)} />
              </Field>
              <Field label="Superficie (m²)">
                <Input type="number" value={surface} onChange={(e) => setSurface(e.target.value)} />
              </Field>
              <Field label="Style archi">
                <Input value={style} onChange={(e) => setStyle(e.target.value)} />
              </Field>
              <Field label="Étages">
                <Input type="number" value={etages} onChange={(e) => setEtages(e.target.value)} />
              </Field>
              <Field label="Piscine">
                <select value={piscine} onChange={(e) => setPiscine(e.target.value)} className={selectCls}>
                  <option>Non</option><option>Oui</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ─── Fichiers Storage ─────────────────────────────────────────── */}
          <Section title="Fichiers Storage">
            {loadingFiles ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 size={16} className="animate-spin" /> Chargement…
              </div>
            ) : (
              <Tabs value={storageTab} onValueChange={setStorageTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="premium">Premium</TabsTrigger>
                </TabsList>

                {/* PREVIEW */}
                <TabsContent value="preview">
                  <StorageSubFolder
                    label="preview/images"
                    files={filesByTierSub('preview', 'images')}
                    uploading={uploadingTier === 'preview/images'}
                    onUpload={() => triggerUpload('preview', 'images')}
                    onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('preview', 'images')}
                  />
                </TabsContent>

                {/* BASIC */}
                <TabsContent value="basic" className="space-y-4">
                  <StorageSubFolder label="basic/images" files={filesByTierSub('basic', 'images')}
                    uploading={uploadingTier === 'basic/images'}
                    onUpload={() => triggerUpload('basic', 'images')} onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('basic', 'images')} />
                  <StorageSubFolder label="basic/perspectives" files={filesByTierSub('basic', 'perspectives')}
                    uploading={uploadingTier === 'basic/perspectives'}
                    onUpload={() => triggerUpload('basic', 'perspectives')} onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('basic', 'perspectives')} />
                </TabsContent>

                {/* PREMIUM */}
                <TabsContent value="premium" className="space-y-4">
                  <StorageSubFolder label="premium/plans" files={filesByTierSub('premium', 'plans')}
                    uploading={uploadingTier === 'premium/plans'}
                    onUpload={() => triggerUpload('premium', 'plans')} onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('premium', 'plans')} />
                  <StorageSubFolder label="premium/estimation" files={filesByTierSub('premium', 'estimation')}
                    uploading={uploadingTier === 'premium/estimation'}
                    onUpload={() => triggerUpload('premium', 'estimation')} onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('premium', 'estimation')} />
                  <StorageSubFolder label="premium/sources" files={filesByTierSub('premium', 'sources')}
                    uploading={uploadingTier === 'premium/sources'}
                    onUpload={() => triggerUpload('premium', 'sources')} onDelete={handleDeleteFile}
                    onDeleteAll={() => handleDeleteFolder('premium', 'sources')} />
                </TabsContent>
              </Tabs>
            )}

            {/* URLs panel */}
            <div className="mt-3">
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={() => setShowUrls((v) => !v)}>
                <Link size={13} /> {showUrls ? 'Masquer les URLs' : 'Voir les URLs'}
              </Button>
              {showUrls && (
                <div className="mt-2 p-3 bg-muted/30 rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-2 font-medium">URLs publiques</div>
                  {files.filter((f) => f.public_url).map((f) => (
                    <div key={f.id} className="flex items-center gap-2 py-1">
                      <span className="text-xs">{FILE_ICON[f.file_type] ?? '📎'}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1">{f.file_name}</span>
                      <button
                        className="text-xs text-blue-400 hover:underline"
                        onClick={() => navigator.clipboard.writeText(f.public_url ?? '')}
                      >Copier</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelected} />
          </Section>
        </div>

        {/* Footer sauvegarde */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0 bg-card">
          {saveMsg && <span className="text-sm font-medium">{saveMsg}</span>}
          <div className="ml-auto">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Modal Prompt IA ─────────────────────────────────────────────── */}
      {showPrompt && (
        <PromptModal
          prompt={aiPrompt}
          onSave={(p) => { setAiPrompt(p); setShowPrompt(false) }}
          onClose={() => setShowPrompt(false)}
          defaultPrompt={DEFAULT_PROMPT}
        />
      )}
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

const selectCls = 'w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background/50 border rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-wide border-b border-border pb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  )
}

interface StorageSubFolderProps {
  label: string
  files: ProjectFile[]
  uploading: boolean
  onUpload: () => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
}

function StorageSubFolder({ label, files, uploading, onUpload, onDelete, onDeleteAll }: StorageSubFolderProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <span className="text-xs font-mono text-muted-foreground">{label}/</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{files.length}</Badge>
          {files.length > 0 && (
            <button
              onClick={onDeleteAll}
              title="Supprimer tous les fichiers de ce dossier"
              className="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
      <div className="divide-y">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="text-base">{FILE_ICON[f.file_type] ?? '📎'}</span>
            <span className="flex-1 truncate font-medium">{f.file_name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{fmtKb(f.file_size_kb)}</span>
            <button
              onClick={() => onDelete(f.id)}
              className="shrink-0 w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded"
            >✕</button>
          </div>
        ))}
      </div>
      <button
        onClick={onUpload}
        disabled={uploading}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
        Ajouter dans {label}/
      </button>
    </div>
  )
}

// ─── Modal Prompt IA ──────────────────────────────────────────────────────────

function PromptModal({
  prompt, onSave, onClose, defaultPrompt,
}: { prompt: string; onSave: (p: string) => void; onClose: () => void; defaultPrompt: string }) {
  const [val, setVal] = useState(prompt)

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold">⚙ Prompt IA — Description</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Variables : {'{title} {category} {tier} {price} {chambres} {surface_m2} {style} {etages} {piscine}'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={16}
            className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono resize-none"
          />
        </div>
        <div className="flex gap-2 px-6 py-4 border-t">
          <Button onClick={() => onSave(val)} className="gap-1"><Save size={14} /> Enregistrer</Button>
          <Button variant="outline" onClick={() => setVal(defaultPrompt)} className="gap-1">
            <RefreshCw size={14} /> Réinitialiser
          </Button>
          <Button variant="ghost" onClick={onClose} className="ml-auto gap-1"><X size={14} /> Fermer</Button>
        </div>
      </div>
    </div>
  )
}
