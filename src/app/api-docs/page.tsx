'use client'

import { useMemo, useState } from 'react'
import { Search, Bot, Copy, Check, KeyRound } from 'lucide-react'
import {
  API_MANIFEST,
  API_AUTH_NOTE,
  API_REFERENCE_VALUES,
  type ApiEndpoint,
} from '@/lib/api-manifest'

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  POST: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  PUT: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  DELETE: 'bg-red-500/15 text-red-600 dark:text-red-400',
}

const TAGS = ['Tous', 'Agent IA', 'Factures', 'Clients', 'Projets', 'Système'] as const

function curlFor(ep: ApiEndpoint): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${base}${ep.path}`
  if (ep.method === 'GET') {
    return `curl -H "x-api-key: VOTRE_CLE" "${url}"`
  }
  const body = ep.bodyExample ? ` \\\n  -d '${JSON.stringify(ep.bodyExample)}'` : ''
  return `curl -X ${ep.method} -H "x-api-key: VOTRE_CLE" -H "Content-Type: application/json" "${url}"${body}`
}

function EndpointCard({ ep }: { ep: ApiEndpoint }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyCurl(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(curlFor(ep))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
      >
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${METHOD_STYLE[ep.method]}`}>
          {ep.method}
        </span>
        <code className="shrink truncate text-sm font-medium">{ep.path}</code>
        {ep.aiUsable && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            <Bot size={11} /> IA
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-4 text-sm">
          <p className="font-medium">{ep.title}</p>
          <p className="text-muted-foreground">{ep.description}</p>

          {ep.queryParams && ep.queryParams.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Paramètres URL</p>
              <ul className="space-y-1">
                {ep.queryParams.map(p => (
                  <li key={p.name}>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.name}</code>
                    {p.required && <span className="ml-1 text-xs text-red-500">requis</span>}
                    <span className="ml-2 text-muted-foreground">{p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ep.bodyExample != null && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Body (exemple)</p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(ep.bodyExample, null, 2)}
              </pre>
            </div>
          )}

          {ep.responseExample != null && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Réponse (exemple)</p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(ep.responseExample, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">curl</p>
              <button
                onClick={copyCurl}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{curlFor(ep)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiDocsPage() {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<(typeof TAGS)[number]>('Tous')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return API_MANIFEST.filter(ep => {
      if (tag !== 'Tous' && ep.tag !== tag) return false
      if (!q) return true
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.title.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q)
      )
    })
  }, [search, tag])

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">API NGbureau</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Toutes les capacités de la plateforme, utilisables par un humain ou un agent IA.
        Version machine : <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /api/admin/agent/manifest</code>
      </p>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-muted-foreground">{API_AUTH_NOTE}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un endpoint…"
            className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TAGS.map(t => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tag === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {filtered.map(ep => (
          <EndpointCard key={`${ep.method} ${ep.path}`} ep={ep} />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun endpoint trouvé.</p>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Valeurs de référence</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(API_REFERENCE_VALUES).map(([field, values]) => (
          <div key={field} className="rounded-xl border bg-card p-4">
            <code className="text-xs font-semibold">{field}</code>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {values.map(v => (
                <span key={v} className="rounded-md bg-muted px-2 py-0.5 text-xs">{v}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
