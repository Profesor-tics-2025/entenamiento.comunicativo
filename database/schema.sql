-- ============================================================
-- Entrenamiento Comunicativo — Database Schema
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  current_level TINYINT UNSIGNED DEFAULT 1,
  total_xp INT UNSIGNED DEFAULT 0,
  job_profile ENUM('general','commercial','technical') DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_prompts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  level_required TINYINT UNSIGNED DEFAULT 1,
  title_es VARCHAR(200) NOT NULL,
  description_es TEXT NOT NULL,
  duration_target_seconds SMALLINT UNSIGNED NOT NULL,
  prompt_text_es TEXT,
  difficulty ENUM('short','medium','long') DEFAULT 'short'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  level TINYINT UNSIGNED NOT NULL,
  exercise_id INT UNSIGNED NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  duration_seconds SMALLINT UNSIGNED,
  passed TINYINT(1) DEFAULT 0,
  xp_earned SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise_prompts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_metrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL UNIQUE,
  wpm SMALLINT UNSIGNED,
  long_pauses TINYINT UNSIGNED DEFAULT 0,
  short_pauses TINYINT UNSIGNED DEFAULT 0,
  filler_count TINYINT UNSIGNED DEFAULT 0,
  filler_per_min DECIMAL(4,2) DEFAULT 0,
  gaze_percentage DECIMAL(5,2) DEFAULT 0,
  facial_rigidity_score DECIMAL(5,2) DEFAULT 0,
  head_movement_score DECIMAL(5,2) DEFAULT 0,
  latency_ms SMALLINT UNSIGNED DEFAULT 0,
  lexical_richness DECIMAL(4,3) DEFAULT 0,
  structure_score TINYINT UNSIGNED DEFAULT 0,
  blink_rate DECIMAL(4,2) DEFAULT 0,
  asymmetry_score DECIMAL(4,3) DEFAULT 0,
  mandibular_tension_score DECIMAL(4,3) DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL UNIQUE,
  report_json JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS adaptive_thresholds (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  level TINYINT UNSIGNED NOT NULL,
  metric_name VARCHAR(60) NOT NULL,
  p25 DECIMAL(8,4),
  p50 DECIMAL(8,4),
  p75 DECIMAL(8,4),
  sample_count INT UNSIGNED DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_level_metric (level, metric_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS filler_words (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL UNIQUE,
  frequency_total INT UNSIGNED DEFAULT 1,
  source ENUM('seed','detected') DEFAULT 'detected',
  suggested_alternative VARCHAR(200),
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_memory (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  memory_type ENUM('filler','rigidity','gaze','structure','wpm') NOT NULL,
  description TEXT NOT NULL,
  occurrence_count TINYINT UNSIGNED DEFAULT 1,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_type (user_id, memory_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ran_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  thresholds_updated INT UNSIGNED DEFAULT 0,
  fillers_detected INT UNSIGNED DEFAULT 0,
  exercises_created INT UNSIGNED DEFAULT 0,
  memories_updated INT UNSIGNED DEFAULT 0,
  notes TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
