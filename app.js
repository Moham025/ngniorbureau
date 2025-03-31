// --- app.js ---
// Fichier minimal pour la configuration Firebase et les utilitaires de base

// Import Firestore functions and db instance
import { db } from './firebase-config.js';
import {
    collection, getDocs, doc, deleteDoc, query, where, orderBy, serverTimestamp, getDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Données Principales ---
let clients = [];
let projets = [];
let transactions = [];
let archives = [];

// --- Firestore Collection References ---
const clientsCollection = collection(db, "clients");
const projetsCollection = collection(db, "projets");
const transactionsCollection = collection(db, "transactions");
const archivesCollection = collection(db, "archives");

// --- Fonctions de génération d'ID structuré ---
function getCurrentYearAA() {
    return new Date().getFullYear().toString().slice(-2);
}

function generateClientId(yearAA, existingClients) {
    const prefix = `CL-${yearAA}-`;
    let maxNN = 0;
    existingClients.forEach(client => {
        if (client.structuredId && client.structuredId.startsWith(prefix)) {
            const nn = parseInt(client.structuredId.substring(prefix.length), 10);
            if (!isNaN(nn) && nn > maxNN) {
                maxNN = nn;
            }
        }
    });
    const nextNN = (maxNN + 1).toString().padStart(2, '0');
    return `${prefix}${nextNN}`;
}

function generateProjetId(yearAA, clientStructuredId, existingProjets) {
    const prefix = `P-${yearAA}-${clientStructuredId}-`;
    let maxPP = 0;
    existingProjets.forEach(projet => {
        if (projet.structuredId && projet.structuredId.startsWith(prefix)) {
            const parts = projet.structuredId.split('-');
            const pp = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pp) && pp > maxPP) {
                maxPP = pp;
            }
        }
    });
    const nextPP = (maxPP + 1).toString().padStart(2, '0');
    return `${prefix}${nextPP}`;
}

function generateTransactionId(yearAA, projetStructuredId, existingTransactions) {
    const prefix = `TR-${yearAA}-${projetStructuredId}-`;
    let maxXXX = 0;
    existingTransactions.forEach(transaction => {
        if (transaction.structuredId && transaction.structuredId.startsWith(prefix)) {
            const parts = transaction.structuredId.split('-');
            const xxx = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(xxx) && xxx > maxXXX) {
                maxXXX = xxx;
            }
        }
    });
    const nextXXX = (maxXXX + 1).toString().padStart(3, '0');
    return `${prefix}${nextXXX}`;
}

function generateArchiveId(type, yearAA, projetStructuredId, existingArchives) {
    const prefix = `${type}-${yearAA}-${projetStructuredId}-`;
    let maxXXX = 0;
    existingArchives.forEach(archive => {
        if (archive.archiveId && archive.archiveId.startsWith(prefix)) {
             const parts = archive.archiveId.split('-');
             const xxx = parseInt(parts[parts.length - 1], 10);
             if (!isNaN(xxx) && xxx > maxXXX) {
                 maxXXX = xxx;
             }
        }
    });
    const nextXXX = (maxXXX + 1).toString().padStart(3, '0');
    return `${prefix}${nextXXX}`;
}

// Export des éléments nécessaires pour les autres modules
export {
    db,
    clients,
    projets,
    transactions,
    archives,
    clientsCollection,
    projetsCollection,
    transactionsCollection,
    archivesCollection,
    getCurrentYearAA,
    generateClientId,
    generateProjetId,
    generateTransactionId,
    generateArchiveId,
    serverTimestamp
};
