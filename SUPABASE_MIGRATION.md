# Migration Supabase - Nouvelles colonnes pour l'algorithme de matching

## Colonnes à ajouter dans la table `users`

Exécute ces commandes SQL dans l'éditeur SQL de Supabase :

```sql
-- Ajouter les colonnes de profil de personnalité
ALTER TABLE users ADD COLUMN IF NOT EXISTS personality_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS evening_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS communication_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS relationship_type TEXT;

-- Ajouter les préférences d'âge
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_age_pref INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_age_pref INTEGER;

-- Ajouter les coordonnées géographiques (pour futures fonctionnalités)
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude FLOAT;

-- Ajouter des contraintes de validation
ALTER TABLE users ADD CONSTRAINT check_personality_type 
  CHECK (personality_type IS NULL OR personality_type IN ('aventurier', 'calme', 'sociable'));

ALTER TABLE users ADD CONSTRAINT check_evening_style 
  CHECK (evening_style IS NULL OR evening_style IN ('chill', 'festif', 'romantique'));

ALTER TABLE users ADD CONSTRAINT check_relationship_type 
  CHECK (relationship_type IS NULL OR relationship_type IN ('sérieux', 'casual', 'amitié'));

ALTER TABLE users ADD CONSTRAINT check_age_prefs 
  CHECK (min_age_pref IS NULL OR max_age_pref IS NULL OR min_age_pref <= max_age_pref);

ALTER TABLE users ADD CONSTRAINT check_min_age_range 
  CHECK (min_age_pref IS NULL OR (min_age_pref >= 18 AND min_age_pref <= 99));

ALTER TABLE users ADD CONSTRAINT check_max_age_range 
  CHECK (max_age_pref IS NULL OR (max_age_pref >= 18 AND max_age_pref <= 99));
```

## Valeurs possibles

### personality_type
- `aventurier` - Personne qui aime l'aventure et les nouvelles expériences
- `calme` - Personne posée et tranquille
- `sociable` - Personne extravertie et sociale

### evening_style
- `chill` - Soirée détendue et relaxante
- `festif` - Soirée animée et festive
- `romantique` - Soirée romantique et intime

### relationship_type
- `sérieux` - Recherche une relation sérieuse
- `casual` - Recherche quelque chose de décontracté
- `amitié` - Recherche de l'amitié

### Préférences d'âge
- `min_age_pref` - Âge minimum souhaité (18-99)
- `max_age_pref` - Âge maximum souhaité (18-99)

## Vérification

Après avoir exécuté la migration, vérifie que tout fonctionne :

```sql
-- Vérifier la structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Tester l'insertion d'un profil complet
INSERT INTO users (phone, gender, looking_for, age, city, personality_type, evening_style, relationship_type, min_age_pref, max_age_pref)
VALUES ('+225TEST', 'homme', 'femme', 25, 'Abidjan', 'aventurier', 'festif', 'sérieux', 22, 30);
```

## Notes importantes

1. **Communication style** n'est pas encore utilisé dans l'onboarding actuel, mais la colonne est créée pour usage futur
2. **Latitude/Longitude** sont prévus pour une future fonctionnalité de matching géographique avancé
3. Les contraintes SQL garantissent l'intégrité des données
4. Toutes les colonnes sont NULL par défaut pour ne pas casser les profils existants
