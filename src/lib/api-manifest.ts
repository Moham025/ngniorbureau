/**
 * MANIFESTE DES API NGbureau — source unique de vérité.
 *
 * Chaque endpoint utilisable par un humain ou un agent IA est décrit ici.
 * - La page /api-docs (documentation visuelle) lit ce fichier
 * - GET /api/admin/agent/manifest le sert en JSON (découverte machine)
 *
 * Pour exposer une nouvelle API : ajouter une entrée ici, c'est tout.
 */

export type ApiParam = {
  name: string
  required?: boolean
  description: string
}

export type ApiEndpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  title: string
  description: string
  tag: 'Agent IA' | 'Factures' | 'Clients' | 'Projets' | 'Système'
  queryParams?: ApiParam[]
  bodyExample?: unknown
  responseExample?: unknown
  aiUsable: boolean
}

export const API_AUTH_NOTE =
  "Toutes les routes exigent le header `x-api-key: <AGENT_API_KEY>` (agents) " +
  "ou une session admin obtenue via /login (humains)."

export const API_REFERENCE_VALUES = {
  'project.type': [
    'Plan Architectural',
    'Etude Ingénierie',
    'Plan Architectural et Etude Ingénierie',
    'Construction',
    'Suivi Contrôle',
    'Autre',
  ],
  'invoice.type': ['Facture', 'Devis', 'Reçu', 'Facture Proforma'],
  'invoice.tva_rate': ['0 %', '10 %', '18 %'],
  'invoice.status': ['draft', 'payé', 'annulé', 'converted'],
  'project.status': ['actif', 'terminé', 'suspendu'],
}

export const API_MANIFEST: ApiEndpoint[] = [
  // ── Agent IA ──────────────────────────────────────────────────────────────
  {
    method: 'POST',
    path: '/api/admin/agent/create-full',
    title: 'Créer client + projet + facture (1 appel)',
    description:
      "Création complète en une requête : client (code auto), projet lié (code auto) et facture (numéro auto). " +
      "C'est la route recommandée pour les agents IA.",
    tag: 'Agent IA',
    bodyExample: {
      client: { full_name: 'Konaté Ibrahim', phone: '+226 70 12 34 56', email: 'konate@example.com' },
      project: { type: 'Plan Architectural', designation: "Villa R+1 à Ouaga 2000" },
      invoice: {
        type: 'Facture',
        tva_rate: '18 %',
        items: [{ desc: 'Étude architecturale complète', qty: 1, price: 150000 }],
      },
    },
    responseExample: {
      success: true,
      client: { id: 'uuid', code: 'CL-26-07', name: 'Konaté Ibrahim' },
      project: { id: 'uuid', custom_id: 'P-26-CL-26-07-01' },
      invoice: { id: 'uuid', number: 'FAC-26-CL-26-07-01-01', total: 177000, status: 'draft' },
      pdfUrl: 'https://bureau.ngniorconception.com/api/admin/invoices/{id}/pdf',
    },
    aiUsable: true,
  },
  {
    method: 'GET',
    path: '/api/admin/agent/list',
    title: 'Lister les documents (machine-friendly)',
    description:
      'Listing léger des factures/devis avec URLs PDF pré-calculées. Optimisé pour la lecture par un agent.',
    tag: 'Agent IA',
    queryParams: [
      { name: 'type', description: 'Facture | Devis | Reçu | Facture Proforma' },
      { name: 'clientEmail', description: 'Filtrer par email client' },
      { name: 'limit', description: 'Max résultats (défaut 100, max 500)' },
    ],
    responseExample: {
      success: true,
      count: 1,
      data: [{ id: 'uuid', number: 'FAC-26-...', total: 295000, client_name: '...', pdfUrl: '...' }],
    },
    aiUsable: true,
  },
  {
    method: 'GET',
    path: '/api/admin/agent/manifest',
    title: 'Découvrir toutes les capacités (ce manifeste)',
    description:
      "Renvoie ce manifeste en JSON : un agent IA peut découvrir dynamiquement toutes les API disponibles.",
    tag: 'Agent IA',
    aiUsable: true,
  },

  // ── Factures ──────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/admin/invoices/{id}/pdf',
    title: 'Télécharger une facture en PDF',
    description:
      'PDF binaire (application/pdf) généré côté serveur. ?format=html pour prévisualiser, ?format=print pour impression auto.',
    tag: 'Factures',
    queryParams: [{ name: 'format', description: 'pdf (défaut) | html | print' }],
    aiUsable: true,
  },
  {
    method: 'GET',
    path: '/api/admin/invoices',
    title: 'Lister / lire les factures',
    description: 'Toutes les factures, ou une seule avec ?id=UUID (objet complet avec articles).',
    tag: 'Factures',
    queryParams: [
      { name: 'type', description: 'Filtrer par type de document' },
      { name: 'id', description: 'UUID — renvoie une facture unique' },
    ],
    aiUsable: true,
  },
  {
    method: 'POST',
    path: '/api/admin/invoices',
    title: 'Créer une facture seule',
    description: "Crée un document sans créer de client/projet. Préférer create-full pour une création complète.",
    tag: 'Factures',
    bodyExample: {
      type: 'Facture',
      client_name: 'Konaté Ibrahim',
      items: [{ desc: 'Ciment CPA 45 – Sac 50kg', qty: 10, price: 5750 }],
      tva_rate: '18 %',
      generate_number: true,
    },
    aiUsable: true,
  },
  {
    method: 'PUT',
    path: '/api/admin/invoices/{id}',
    title: 'Modifier une facture',
    description: "Met à jour n'importe quel champ (ex : marquer payée).",
    tag: 'Factures',
    bodyExample: { status: 'payé', notes: 'Paiement reçu le 15/05/2026.' },
    aiUsable: true,
  },
  {
    method: 'DELETE',
    path: '/api/admin/invoices/{id}',
    title: 'Supprimer une facture',
    description: 'Suppression définitive du document.',
    tag: 'Factures',
    aiUsable: false,
  },

  // ── Clients ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/admin/clients',
    title: 'Lister les clients',
    description: 'Tous les clients (code, nom, email, téléphone, nb projets/documents). ?search= pour filtrer.',
    tag: 'Clients',
    queryParams: [{ name: 'search', description: 'Recherche par nom/email' }],
    aiUsable: true,
  },
  {
    method: 'POST',
    path: '/api/admin/clients',
    title: 'Créer un client seul',
    description: 'Crée uniquement le client (sans projet ni facture).',
    tag: 'Clients',
    bodyExample: { full_name: 'Traoré Aminata', phone: '+226 76 00 00 00' },
    aiUsable: true,
  },

  // ── Projets ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/admin/client-projects',
    title: 'Lister les projets clients',
    description: "Tous les projets, ou ceux d'un client avec ?client_id=UUID. Le total est enrichi depuis la facture liée.",
    tag: 'Projets',
    queryParams: [{ name: 'client_id', description: "UUID du client" }],
    aiUsable: true,
  },
  {
    method: 'POST',
    path: '/api/admin/client-projects',
    title: 'Créer un projet (± facture liée)',
    description: 'Crée un projet pour un client existant, avec facture optionnelle (generate_invoice: true).',
    tag: 'Projets',
    bodyExample: {
      client_id: 'uuid-client',
      type: 'Plan Architectural',
      designation: 'Villa R+1 à Ouaga 2000',
      generate_invoice: true,
      items: [{ desc: 'Étude architecturale', qty: 1, price: 150000 }],
    },
    aiUsable: true,
  },
  {
    method: 'DELETE',
    path: '/api/admin/client-projects/{id}',
    title: 'Supprimer un projet',
    description: 'Suppression définitive du projet.',
    tag: 'Projets',
    aiUsable: false,
  },

  // ── Système ───────────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/admin/dashboard/stats',
    title: 'Statistiques du tableau de bord',
    description: "Chiffres globaux de l'activité (clients, documents, montants).",
    tag: 'Système',
    aiUsable: true,
  },
]
