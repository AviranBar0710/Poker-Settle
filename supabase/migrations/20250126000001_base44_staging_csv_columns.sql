-- =====================================================
-- Base44 Staging Tables - CSV Column Alignment
-- =====================================================
-- Migration: 20250126000001_base44_staging_csv_columns.sql
-- Purpose: Recreate staging tables to match base44 CSV export structure
--
-- Run after 20250126000000. If you had the old schema, this fixes it.
-- Reload your CSVs after this runs, then run 20250126000002_base44_migrate_data.sql
-- =====================================================

BEGIN;

DROP TABLE IF EXISTS staging_base44_game_player;
DROP TABLE IF EXISTS staging_base44_game_session;

CREATE TABLE staging_base44_game_session (
  id              text NOT NULL,
  game_date       text,
  chip_ratio      text,
  status          text,
  total_pot       text,
  player_count    text,
  currency        text,
  created_date    text,
  updated_date    text,
  created_by_id   text,
  created_by      text,
  is_sample       text,
  PRIMARY KEY (id)
);

CREATE TABLE staging_base44_game_player (
  id                  text NOT NULL,
  game_session_id     text NOT NULL,
  player_name         text,
  player_profile_id   text,
  player_name_display text,
  total_buy_in        numeric(18, 4) NOT NULL DEFAULT 0,
  final_chip_count    numeric(18, 4),
  final_value         numeric(18, 4) NOT NULL DEFAULT 0,
  net_profit_loss     numeric(18, 4),
  created_date        text,
  updated_date        text,
  created_by_id       text,
  created_by          text,
  is_sample           text,
  PRIMARY KEY (id),
  FOREIGN KEY (game_session_id) REFERENCES staging_base44_game_session(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staging_player_game_session_id ON staging_base44_game_player(game_session_id);

COMMENT ON TABLE staging_base44_game_session IS 'Import GameSession CSV. Columns match base44 export headers.';
COMMENT ON TABLE staging_base44_game_player IS 'Import GamePlayer CSV. Columns match base44 export headers.';

COMMIT;
