-- Migration Supabase - Nouvelles colonnes pour l'algorithme de matching
-- Exécute ce fichier SQL dans l'éditeur SQL de Supabase

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
