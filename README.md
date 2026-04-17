# NGniorBureau - Tableau de Bord Administratif

Tableau de bord administratif complet pour la gestion de NGniorBureau, une plateforme d'architecture et de construction.

## 🚀 Fonctionnalités

### Tableau de bord
- Statistiques en temps réel (revenus, clients, ventes)
- Activité récente avec timeline
- Graphiques de performance

### Gestion des Projets
- Liste des projets avec recherche
- Création et modification de projets
- Gestion des fichiers (PDF, DWG, images)
- Système de tiers (preview, basic, premium)

### Catégories
- CRUD complet sur les catégories de projets
- Gestion de l'ordre d'affichage
- Slugification automatique

### Estimations
- Upload de fichiers JSON d'estimation
- Visualisation des coûts par section
- Support du format EstimBatiment

### Boutique
- Gestion du catalogue de produits
- Suivi des stocks
- Prix et descriptions

### Gestion des Clients
- Liste des clients avec recherche
- Filtrage par plan (premium/gratuit)
- Statut de confirmation

### Factures & Devis
- Création de factures et devis
- Suivi des statuts de paiement
- Téléchargement des documents

## 🛠️ Stack Technique

- **Framework**: Next.js 16 avec App Router
- **Langage**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui (New York style)
- **Database**: Prisma ORM avec SQLite
- **Icons**: Lucide React
- **Theme**: next-themes (dark/light mode)

## 📦 Installation

```bash
# Installation des dépendances
bun install

# Configuration de la base de données
bun run db:push

# Lancement du serveur de développement
bun run dev
```

## 🌐 Structure du Projet

```
src/
├── app/
│   ├── api/
│   │   └── admin/
│   │       ├── clients/
│   │       ├── projects/
│   │       ├── categories/
│   │       ├── products/
│   │       ├── invoices/
│   │       ├── estimations/
│   │       └── dashboard/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── theme-provider.tsx
│   └── ui/ (shadcn/ui components)
└── lib/
    ├── db.ts (Prisma client)
    └── utils.ts
```

## 🔌 API Routes

### Clients
- `GET /api/admin/clients` - Liste des clients (avec recherche)
- `POST /api/admin/clients` - Créer un client

### Projets
- `GET /api/admin/projects` - Liste des projets (avec filtres)
- `POST /api/admin/projects` - Créer un projet
- `GET /api/admin/projects/[id]` - Détails d'un projet
- `PUT /api/admin/projects/[id]` - Modifier un projet
- `DELETE /api/admin/projects/[id]` - Supprimer un projet

### Catégories
- `GET /api/admin/categories` - Liste des catégories
- `POST /api/admin/categories` - Créer une catégorie
- `PUT /api/admin/categories/[id]` - Modifier une catégorie
- `DELETE /api/admin/categories/[id]` - Supprimer une catégorie

### Produits
- `GET /api/admin/products` - Liste des produits
- `POST /api/admin/products` - Créer un produit

### Factures & Devis
- `GET /api/admin/invoices` - Liste des documents
- `POST /api/admin/invoices` - Créer un document

### Estimations
- `POST /api/admin/estimations` - Upload d'estimation
- `GET /api/admin/estimations` - Liste des estimations

### Statistiques
- `GET /api/admin/dashboard/stats` - Statistiques du tableau de bord

## 💾 Base de Données

Le schéma Prisma inclut les modèles suivants :

- **User** - Utilisateurs/clients
- **Category** - Catégories de projets
- **Project** - Projets d'architecture
- **ProjectFile** - Fichiers associés aux projets
- **Product** - Produits de la boutique
- **Invoice** - Factures et devis
- **Estimation** - Estimations de coûts

## 🎨 Personnalisation

### Thème
Le thème (clair/sombre) est géré via `next-themes` et peut être basculé depuis l'interface.

### Couleurs
Les couleurs sont définies dans `tailwind.config.ts` et utilisent les variables CSS de Tailwind.

### UI Components
Tous les composants UI proviennent de shadcn/ui et peuvent être personnalisés dans `src/components/ui/`.

## 🚀 Déploiement

```bash
# Build pour la production
bun run build

# Lancement en production
bun run start
```

## 📝 Notes

- L'application utilise actuellement des données mockées pour l'API. Connectez-la à votre base de données réelle en modifiant les routes API.
- Le système d'authentification doit être implémenté pour sécuriser les routes administratives.
- Pour la production, remplacez SQLite par PostgreSQL ou MySQL.

## 🤝 Contribution

Contributions bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

Propriétaire - NGniorBureau
