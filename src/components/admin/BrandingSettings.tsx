'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Save, Loader2, UploadCloud, Eye, Palette } from 'lucide-react'

// Défauts d'AFFICHAGE (miroir de DEFAULT_BRANDING côté serveur — pas de secret ici)
const DEFAULTS = {
  company_name: 'NGnior Conception',
  slogan: 'Conception - Suivi - Réalisation',
  service_line: 'Service : Conception - Etude - Suivi contrôle - construction',
  address: 'Ouagadougou, Burkina Faso',
  website: 'www.ngniorconception.com',
  legal_form: 'Société à Responsabilité Limitée',
  rccm: 'BFOUA2019B1915',
  ifu: '00117306P',
  emails: ['ngniorconceptions@gmail.com'],
  phones: ['+226 56 88 65 05', '+226 71 35 33 75'],
  signatory_label_invoice: 'Le Directeur',
  signatory_name: 'SANOU Mohamed Yacine',
  signatory_label_recu: 'Le Gérant',
  accent_color: '#C9A84C',
  logo_url: '' as string | null,
  signature_url: '' as string | null,
  stamp_url: '' as string | null,
}

type Branding = typeof DEFAULTS

export default function BrandingSettings() {
  const [b, setB] = useState<Branding>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = {
    logo: useRef<HTMLInputElement>(null),
    signature: useRef<HTMLInputElement>(null),
    stamp: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    fetch('/api/admin/settings/invoice_branding')
      .then((r) => r.json())
      .then((j) => { if (j.success && j.value) setB({ ...DEFAULTS, ...j.value }) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof Branding, v: unknown) => setB((prev) => ({ ...prev, [k]: v }))

  const handleUpload = async (type: 'logo' | 'signature' | 'stamp', file: File) => {
    setUploading(type); setMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', type)
      const r = await fetch('/api/admin/settings/branding-asset', { method: 'POST', body: form })
      const j = await r.json()
      if (j.success) set(`${type}_url` as keyof Branding, j.public_url)
      else setMsg('Upload échoué : ' + (j.error ?? '?'))
    } catch { setMsg('Erreur de connexion (upload)') }
    finally { setUploading(null) }
  }

  const handleSave = async () => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch('/api/admin/settings/invoice_branding', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
      })
      const j = await r.json()
      if (j.success) { setMsg('✅ Branding enregistré'); setTimeout(() => setMsg(''), 3000) }
      else if (j.needsMigration) setMsg('⚠ Table manquante : ' + j.error)
      else setMsg('Erreur : ' + (j.error ?? '?'))
    } catch { setMsg('Erreur de connexion') }
    finally { setSaving(false) }
  }

  const previewFacture = async () => {
    for (const t of ['Facture', 'Facture Proforma', 'Devis', 'Reçu']) {
      const r = await fetch(`/api/admin/agent/list?type=${encodeURIComponent(t)}&limit=1`)
      const j = await r.json()
      if (j.success && j.data?.length) { window.open(`/api/admin/invoices/${j.data[0].id}/pdf?format=html`, '_blank'); return }
    }
    setMsg('Aucune facture à prévisualiser — créez-en une d’abord.')
  }
  const previewRecu = async () => {
    const r = await fetch('/api/admin/client-projects')
    const j = await r.json()
    const proj = (j.data ?? []).find((p: { invoice_id?: string }) => p.invoice_id)
    if (proj) window.open(`/api/admin/client-projects/${proj.id}/recu?format=html`, '_blank')
    else setMsg('Aucun projet avec facture pour prévisualiser un reçu.')
  }

  if (loading) return (
    <Card className="border shadow-sm"><CardContent className="p-6 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="animate-spin" size={16} /> Chargement du branding…
    </CardContent></Card>
  )

  const Field = ({ label, k, ph }: { label: string; k: keyof Branding; ph?: string }) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <Input value={(b[k] as string) ?? ''} placeholder={ph} onChange={(e) => set(k, e.target.value)} className="text-sm bg-background/50" />
    </div>
  )

  const uploader = (type: 'logo' | 'signature' | 'stamp', label: string) => {
    const url = b[`${type}_url` as keyof Branding] as string
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
        <div className="flex items-center gap-3 border rounded-lg p-2 bg-background/50">
          <div className="w-16 h-12 bg-muted/40 rounded flex items-center justify-center overflow-hidden shrink-0">
            {url ? <img src={url} alt={label} className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-muted-foreground">défaut</span>}
          </div>
          <input ref={fileRefs[type]} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(type, f); e.target.value = '' }} />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploading === type}
            onClick={() => fileRefs[type].current?.click()}>
            {uploading === type ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Téléverser
          </Button>
          {url && <button type="button" onClick={() => set(`${type}_url` as keyof Branding, '')} className="text-xs text-muted-foreground hover:text-destructive">Réinitialiser</button>}
        </div>
      </div>
    )
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 pb-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="text-primary h-5 w-5" />
            <h4 className="font-bold text-base">Modèles de documents (branding)</h4>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={previewFacture}><Eye size={13} /> Aperçu facture</Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={previewRecu}><Eye size={13} /> Aperçu reçu</Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground -mt-2">
          Ces informations alimentent les PDF de facture, proforma et reçu (côté serveur). Le rendu se met à jour dès l’enregistrement.
        </p>

        {/* Images */}
        <div className="grid sm:grid-cols-3 gap-4">
          {uploader('logo', 'Logo')}
          {uploader('signature', 'Signature')}
          {uploader('stamp', 'Cachet / Tampon')}
        </div>

        {/* Société */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nom de la société" k="company_name" />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Palette size={12} /> Couleur d’accent</label>
            <div className="flex items-center gap-2">
              <input type="color" value={b.accent_color} onChange={(e) => set('accent_color', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
              <Input value={b.accent_color} onChange={(e) => set('accent_color', e.target.value)} className="text-sm font-mono bg-background/50" />
            </div>
          </div>
          <Field label="Slogan (facture)" k="slogan" />
          <Field label="Ligne service (reçu)" k="service_line" />
          <Field label="Adresse" k="address" />
          <Field label="Site web" k="website" />
        </div>

        {/* Légal */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Forme juridique" k="legal_form" />
          <Field label="RCCM" k="rccm" />
          <Field label="IF / IFU" k="ifu" />
        </div>

        {/* Contacts */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Emails (séparés par des virgules)</label>
            <Input value={b.emails.join(', ')} onChange={(e) => set('emails', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="text-sm bg-background/50" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Téléphones (séparés par des virgules)</label>
            <Input value={b.phones.join(', ')} onChange={(e) => set('phones', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="text-sm bg-background/50" />
          </div>
        </div>

        {/* Signataires */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Libellé signataire (facture)" k="signatory_label_invoice" />
          <Field label="Nom du signataire" k="signatory_name" />
          <Field label="Libellé signataire (reçu)" k="signatory_label_recu" />
        </div>

        <div className="pt-4 border-t flex items-center justify-between gap-4">
          {msg ? <p className="text-xs font-medium">{msg}</p> : <span />}
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer le branding
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
