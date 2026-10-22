-- A coach's player search compares names whatever their accents (services/players.service.ts).
-- A trusted extension since PostgreSQL 13: the database owner can create it.
CREATE EXTENSION IF NOT EXISTS unaccent;
