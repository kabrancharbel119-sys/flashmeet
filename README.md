# FlashMeet Backend

Backend Node.js pour l'application de speed dating sur WhatsApp.

## Installation

```bash
npm install
```

## Configuration

1. Copier `.env.example` vers `.env`
2. Remplir les variables d'environnement :
   - Supabase URL et Service Key
   - Twilio Account SID, Auth Token et WhatsApp Number

## Démarrage

```bash
npm start
```

## Développement

```bash
npm run dev
```

## Horaires de service

Le service est actif de 20h00 à 00h00 (UTC+0 - Heure d'Afrique de l'Ouest).

## Fonctionnalités

- Onboarding utilisateur via WhatsApp
- Matching automatique basé sur les préférences
- Chat de 5 minutes entre matches
- Double opt-in pour échanger les contacts
- Notifications automatiques
- Gestion des limites (10 matchs/jour pour utilisateurs gratuits)
