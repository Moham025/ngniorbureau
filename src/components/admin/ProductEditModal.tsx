'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { X, Save, Bot, Settings2, Plus, Trash2, UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductVariant { id?: string; label: string; price_xof: number; stock: number }
interface ProductImage   { id: string; image_url: string }

export interface ProductFull {
  id: string
  name: string
  slug: string
  category?: string
  unit_label?: string
  brand?: string
  price_xof: number
  stock: number
  description?: string
  is_available: boolean
  thumbnail_url?: string
  product_variants?: ProductVariant[]
  product_images?: ProductImage[]
}

interface Props {
  product: ProductFull | null
  onClose: () => void
  onSaved: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Gros Œuvre', 'Toiture', 'Ouverture', 'Plomberie',
  'Électricité', 'Revêtement', 'Meubles & Cuisine', 'Matériel Chantier',
]

const DEFAULT_SLUG_PROMPT =
  "Tu es un expert en e-commerce de matériaux. Génère un slug web très court et pertinent (2-4 mots utiles) pour l'URL de ce produit. Ne renvoie QUE le slug formatté correctement (en minuscules, séparé par des tirets), sans guillemets ni ponctuation."

const DEFAULT_DESC_PROMPT =
  "Tu es un copywriter expert en e-commerce B2B/B2C pour les matériaux de construction. Rédige ou améliore la description de ce produit. Si une description est fournie, corrige les fautes et enrichis-la. Si elle est vide, génère une description attractive (3-4 lignes max) mettant en valeur le produit. Sois professionnel, clair et persuasif."

const autoSlug = (v: string) =>
  v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductEditModal({ product, onClose, onSaved }: Props) {
  const isNew = !product

  const [name,        setName]        = useState(product?.name ?? '')
  const [slug,        setSlug]        = useState(product?.slug ?? '')
  const [category,    setCategory]    = useState(product?.category ?? CATEGORIES[0])
  const [unitLabel,   setUnitLabel]   = useState(product?.unit_label ?? '')
  const [brand,       setBrand]       = useState(product?.brand ?? '')
  const [price,       setPrice]       = useState(product?.price_xof ?? 0)
  const [stock,       setStock]       = useState(product?.stock ?? 0)
  const [description, setDescription] = useState(product?.description ?? '')
  const [isAvailable, setIsAvailable] = useState(product?.is_available ?? true)

  const [variants,   setVariants]   = useState<ProductVariant[]>(
    (product?.product_variants ?? []).sort((a, b) => (a as unknown as { position: number }).position - (b as unknown as { position: number }).position)
  )
  const [galleryImages,   setGalleryImages]   = useState<ProductImage[]>(product?.product_images ?? [])
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([])
  const [thumbnailUrl,    setThumbnailUrl]    = useState(product?.thumbnail_url ?? '')
  const [thumbFile,       setThumbFile]       = useState<File | null>(null)
  const [galleryFiles,    setGalleryFiles]    = useState<File[]>([])

  const [slugPrompt, setSlugPrompt] = useState(DEFAULT_SLUG_PROMPT)
  const [descPrompt, setDescPrompt] = useState(DEFAULT_DESC_PROMPT)
  const [showSlugPrompt, setShowSlugPrompt] = useState(false)
  const [showDescPrompt, setShowDescPrompt] = useState(false)

  useEffect(() => {
    const savedSlug = localStorage.getItem('ngb_slug_prompt')
    if (savedSlug) setSlugPrompt(savedSlug)
    const savedDesc = localStorage.getItem('ngb_desc_prompt')
    if (savedDesc) setDescPrompt(savedDesc)
  }, [])

  const [aiLoadingSlug, setAiLoadingSlug] = useState(false)
  const [aiLoadingDesc, setAiLoadingDesc] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [status,        setStatus]        = useState('')
  const [error,         setError]         = useState('')

  const thumbInputRef   = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // ─── AI helpers ───────────────────────────────────────────────────────────

  const callAI = useCallback(async (prompt: string): Promise<string> => {
    const r = await fetch('/api/ai/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    const j = await r.json()
    if (!j.success) throw new Error(j.error ?? 'Erreur IA')
    return j.text as string
  }, [])

  const generateSlug = async () => {
    if (!name) return
    setAiLoadingSlug(true)
    try {
      const ctx = `Nom: ${name}\nCatégorie: ${category}\nMarque: ${brand}\nConditionnement: ${unitLabel}\nPrix: ${price} FCFA`
      const result = await callAI(`${slugPrompt}\n\n${ctx}`)
      setSlug(result.trim().replace(/["']/g, '').toLowerCase())
    } catch (e) { setError(String(e)) }
    finally { setAiLoadingSlug(false) }
  }

  const generateDesc = async () => {
    if (!name) return
    setAiLoadingDesc(true)
    try {
      const ctx = `Nom: ${name}\nCatégorie: ${category}\nMarque: ${brand}\nConditionnement: ${unitLabel}\nPrix: ${price} FCFA\n\nDescription actuelle (à enrichir si présente) : ${description}`
      const result = await callAI(`${descPrompt}\n\n${ctx}`)
      setDescription(result.trim())
    } catch (e) { setError(String(e)) }
    finally { setAiLoadingDesc(false) }
  }

  // ─── Variants ─────────────────────────────────────────────────────────────

  const addVariant = () => setVariants((v) => [...v, { label: '', price_xof: 0, stock: 0 }])
  const removeVariant = (i: number) => setVariants((v) => v.filter((_, idx) => idx !== i))
  const updateVariant = (i: number, field: keyof ProductVariant, value: string | number) =>
    setVariants((v) => v.map((row, idx) => idx === i ? { ...row, [field]: value } : row))

  // ─── Images ───────────────────────────────────────────────────────────────

  const removeGalleryImage = (id: string) => {
    setDeletedImageIds((d) => [...d, id])
    setGalleryImages((imgs) => imgs.filter((img) => img.id !== id))
  }

  const removeGalleryFile = (i: number) => setGalleryFiles((f) => f.filter((_, idx) => idx !== i))

  // ─── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name) { setError('Le nom est requis'); return }
    setSaving(true); setError('')

    try {
      const finalSlug = slug || autoSlug(name)
      const productData = {
        name, slug: finalSlug, category, unit_label: unitLabel, brand: brand || null,
        price_xof: price, stock, is_available: isAvailable, description: description || null,
        variants: variants.filter((v) => v.label.trim()),
      }

      let pid = product?.id

      if (isNew) {
        setStatus('Création du produit…')
        const r = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        })
        const j = await r.json()
        if (!j.success) throw new Error(j.error)
        pid = j.data.id
      } else {
        setStatus('Mise à jour du produit…')
        const r = await fetch(`/api/admin/products/${pid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        })
        const j = await r.json()
        if (!j.success) throw new Error(j.error)
      }

      if (thumbFile && pid) {
        setStatus('Upload vignette…')
        const fd = new FormData(); fd.append('file', thumbFile); fd.append('type', 'thumbnail')
        await fetch(`/api/admin/products/${pid}/images`, { method: 'POST', body: fd })
      }

      for (const imgId of deletedImageIds) {
        await fetch(`/api/admin/products/${pid}/images/${imgId}`, { method: 'DELETE' })
      }

      for (let i = 0; i < galleryFiles.length; i++) {
        setStatus(`Upload galerie (${i + 1}/${galleryFiles.length})…`)
        const fd = new FormData(); fd.append('file', galleryFiles[i]); fd.append('type', 'gallery')
        await fetch(`/api/admin/products/${pid}/images`, { method: 'POST', body: fd })
      }

      setStatus('Enregistré !')
      onSaved()
      setTimeout(onClose, 600)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold">{isNew ? 'Nouveau produit' : 'Modifier le produit'}</h2>
            {!isNew && <p className="text-xs text-muted-foreground font-mono">{product.id.slice(0, 8)}…</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">

            {/* ── Section: Informations générales ────────────────────────── */}
            <Section title="Informations Générales">

              {/* Thumbnail preview */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-20 h-20 rounded-xl bg-muted border flex items-center justify-center overflow-hidden shrink-0">
                  {thumbFile
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={URL.createObjectURL(thumbFile)} alt="" className="w-full h-full object-cover" />
                    : thumbnailUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon size={28} className="text-muted-foreground/50" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Vignette principale</p>
                  <p className="text-xs text-muted-foreground mb-2 truncate">
                    {thumbFile ? thumbFile.name : thumbnailUrl ? thumbnailUrl.split('/').pop() : 'Aucune image'}
                  </p>
                  <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) { setThumbFile(f); setThumbnailUrl('') } }} />
                  <Button size="sm" variant="outline" onClick={() => thumbInputRef.current?.click()}>
                    Parcourir
                  </Button>
                </div>
              </div>

              <Field label="Nom du produit *">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ciment Bélier 42.5R" />
              </Field>

              <Field label="Slug">
                <div className="flex gap-2">
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)}
                    placeholder={name ? autoSlug(name) : 'auto-généré'} className="flex-1" />
                  <Button size="sm" variant="outline" onClick={generateSlug} disabled={aiLoadingSlug || !name} className="gap-1 px-2">
                    {aiLoadingSlug ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  </Button>
                  <Button size="sm" variant="outline" className="px-2" onClick={() => setShowSlugPrompt(true)}>
                    <Settings2 size={14} />
                  </Button>
                </div>
              </Field>

              <Field label="Catégorie *">
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>

              <Field label="Unité de base *">
                <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Sac, Tonne, Mètre…" />
              </Field>

              <Field label="Marque">
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Lafarge, CimFaso…" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Prix de base (FCFA) *">
                  <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                </Field>
                <Field label="Stock global *">
                  <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
                </Field>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)}
                    className="w-4 h-4 rounded accent-foreground" />
                  <span className="text-sm">Disponible à la vente</span>
                </label>
                <Badge variant={isAvailable ? 'default' : 'secondary'}>{isAvailable ? 'Actif' : 'Inactif'}</Badge>
              </div>
            </Section>

            {/* ── Section: Description ────────────────────────────────────── */}
            <Section title="Description">
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" onClick={generateDesc} disabled={aiLoadingDesc || !name} className="gap-1">
                  {aiLoadingDesc ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  Générer
                </Button>
                <Button size="sm" variant="outline" className="gap-1 px-2" onClick={() => setShowDescPrompt(true)}>
                  <Settings2 size={14} /> Prompt
                </Button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Description du produit…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Section>

            {/* ── Section: Variantes ──────────────────────────────────────── */}
            <Section title="Variantes de vente (Optionnel)">
              <p className="text-xs text-muted-foreground mb-3">Exemples: Sac de 50kg, Tonne, Camion 10m³…</p>
              <div className="space-y-2 mb-3">
                {variants.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center bg-muted/40 rounded-lg p-2">
                    <Input value={v.label} onChange={(e) => updateVariant(i, 'label', e.target.value)}
                      placeholder="Label (ex: Sac 50kg)" className="flex-1 h-8 text-sm" />
                    <Input type="number" value={v.price_xof} onChange={(e) => updateVariant(i, 'price_xof', Number(e.target.value))}
                      placeholder="Prix FCFA" className="w-28 h-8 text-sm" />
                    <Input type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', Number(e.target.value))}
                      placeholder="Stock" className="w-20 h-8 text-sm" />
                    <button onClick={() => removeVariant(i)} className="text-muted-foreground hover:text-destructive p-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={addVariant} className="gap-1">
                <Plus size={14} /> Ajouter une variante
              </Button>
            </Section>

            {/* ── Section: Galerie ────────────────────────────────────────── */}
            <Section title="Galerie additionnelle">
              <div className="space-y-2 mb-3">
                {galleryImages.map((img) => (
                  <div key={img.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {img.image_url.split('/').pop()} (existante)
                    </span>
                    <button onClick={() => removeGalleryImage(img.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {galleryFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-3 py-2">
                    <UploadCloud size={16} className="text-emerald-500 shrink-0" />
                    <span className="text-xs flex-1 truncate">{f.name}</span>
                    <button onClick={() => removeGalleryFile(i)} className="text-muted-foreground hover:text-destructive p-1">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  setGalleryFiles((prev) => [...prev, ...files])
                  e.target.value = ''
                }} />
              <Button size="sm" variant="outline" onClick={() => galleryInputRef.current?.click()} className="gap-1">
                <Plus size={14} /> Ajouter des images
              </Button>
            </Section>

          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t bg-background/80 backdrop-blur-sm">
          {error  && <p className="text-destructive text-sm mb-2">{error}</p>}
          {status && <p className="text-muted-foreground text-sm mb-2">{status}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isNew ? 'Créer le produit' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Prompt Modals ─────────────────────────────────────────────────── */}
      {showSlugPrompt && (
        <PromptModal title="Prompt Slug IA" value={slugPrompt} defaultValue={DEFAULT_SLUG_PROMPT}
          onSave={(v) => {
            setSlugPrompt(v)
            localStorage.setItem('ngb_slug_prompt', v)
            setShowSlugPrompt(false)
          }}
          onClose={() => setShowSlugPrompt(false)} />
      )}
      {showDescPrompt && (
        <PromptModal title="Prompt Description IA" value={descPrompt} defaultValue={DEFAULT_DESC_PROMPT}
          onSave={(v) => {
            setDescPrompt(v)
            localStorage.setItem('ngb_desc_prompt', v)
            setShowDescPrompt(false)
          }}
          onClose={() => setShowDescPrompt(false)} />
      )}
    </>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

// ─── Prompt Modal ─────────────────────────────────────────────────────────────

function PromptModal({ title, value, defaultValue, onSave, onClose }: {
  title: string; value: string; defaultValue: string
  onSave: (v: string) => void; onClose: () => void
}) {
  const [v, setV] = useState(value)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h4 className="font-bold">{title}</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <textarea value={v} onChange={(e) => setV(e.target.value)} rows={8}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setV(defaultValue)}>Réinitialiser</Button>
            <Button size="sm" className="flex-1" onClick={() => onSave(v)}>Appliquer</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
