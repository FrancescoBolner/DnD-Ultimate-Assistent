import { pool } from '../config/db';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    \`email\`         VARCHAR(255)    NOT NULL,
    \`username\`      VARCHAR(100)    NOT NULL,
    \`password_hash\` VARCHAR(255)    NOT NULL,
    \`avatar\`        VARCHAR(500)    NULL,
    \`is_admin\`      BOOLEAN         NOT NULL DEFAULT FALSE,
    \`is_active\`     BOOLEAN         NOT NULL DEFAULT TRUE,
    \`last_login\`    DATETIME        NULL,
    \`dark_mode\`     BOOLEAN         NOT NULL DEFAULT TRUE,
    \`layout\`        JSON            NULL,
    \`preferences\`   JSON            NULL,
    \`created_at\`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_users_email\`    (\`email\`),
    UNIQUE KEY \`uq_users_username\` (\`username\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`campaigns\` (
    \`id\`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`name\`        VARCHAR(200)  NOT NULL,
    \`description\` TEXT          NULL,
    \`dm_id\`       INT UNSIGNED  NOT NULL,
    \`invite_code\` VARCHAR(20)   NULL,
    \`status\`      ENUM('active','paused','completed','archived') NOT NULL DEFAULT 'active',
    \`image\`       VARCHAR(500)  NULL,
    \`layout\`      JSON          NULL,
    \`permissions\` JSON          NULL,
    \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_invite_code\` (\`invite_code\`),
    CONSTRAINT \`fk_campaigns_dm\` FOREIGN KEY (\`dm_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`campaign_players\` (
    \`campaign_id\` INT UNSIGNED NOT NULL,
    \`user_id\`     INT UNSIGNED NOT NULL,
    \`status\`      ENUM('invited','active','left','kicked','banned') NOT NULL DEFAULT 'invited',
    \`joined_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`campaign_id\`, \`user_id\`),
    CONSTRAINT \`fk_cp_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_cp_user\`     FOREIGN KEY (\`user_id\`)     REFERENCES \`users\`(\`id\`)     ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`characters\` (
    \`id\`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    \`player_id\`   INT UNSIGNED      NULL,
    \`campaign_id\` INT UNSIGNED      NOT NULL,
    \`name\`        VARCHAR(150)      NOT NULL,
    \`race\`        VARCHAR(100)      NULL,
    \`class\`       VARCHAR(100)      NULL,
    \`level\`       TINYINT UNSIGNED  NOT NULL DEFAULT 1,
    \`stats\`       JSON              NULL,
    \`hp_max\`      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    \`hp_current\`  SMALLINT          NOT NULL DEFAULT 1,
    \`hp_temp\`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    \`ac\`          TINYINT UNSIGNED  NOT NULL DEFAULT 10,
    \`speed\`       SMALLINT UNSIGNED NOT NULL DEFAULT 6,
    \`image\`       VARCHAR(500)      NULL,
    \`backstory\`   TEXT              NULL,
    \`is_active\`   BOOLEAN           NOT NULL DEFAULT TRUE,
    \`created_at\`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_char_player\`   FOREIGN KEY (\`player_id\`)   REFERENCES \`users\`(\`id\`)     ON DELETE SET NULL,
    CONSTRAINT \`fk_char_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`creatures\` (
    \`id\`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    \`campaign_id\` INT UNSIGNED      NOT NULL,
    \`name\`        VARCHAR(150)      NOT NULL,
    \`type\`        ENUM('npc','enemy','ally','beast') NOT NULL DEFAULT 'enemy',
    \`cr\`          VARCHAR(10)       NULL,
    \`size\`        ENUM('Tiny','Small','Medium','Large','Huge','Gargantuan') NOT NULL DEFAULT 'Medium',
    \`stats\`       JSON              NULL,
    \`hp_max\`      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    \`hp_current\`  SMALLINT          NOT NULL DEFAULT 1,
    \`hp_temp\`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    \`ac\`          TINYINT UNSIGNED  NOT NULL DEFAULT 10,
    \`speed\`       SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    \`image\`       VARCHAR(500)      NULL,
    \`sheet_image\` VARCHAR(500)      NULL,
    \`notes\`       TEXT              NULL,
    \`tags\`        JSON              NULL,
    \`race\`        VARCHAR(100)      NULL,
    \`religion\`    VARCHAR(100)      NULL,
    \`is_active\`   BOOLEAN           NOT NULL DEFAULT TRUE,
    \`created_at\`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_creatures_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`effects\` (
    \`id\`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`      INT UNSIGNED  NULL,
    \`name\`             VARCHAR(150)  NOT NULL,
    \`description\`      TEXT          NULL,
    \`duration\`         VARCHAR(100)  NULL,
    \`trigger_moment\`   VARCHAR(100)  NULL,
    \`damage\`           VARCHAR(50)   NULL,
    \`damage_type\`      VARCHAR(50)   NULL,
    \`save_type\`        VARCHAR(20)   NULL,
    \`save_dc\`          TINYINT UNSIGNED NULL,
    \`apply_on_save\`    ENUM('half','negate','none') NOT NULL DEFAULT 'none',
    \`conditions\`       JSON          NULL,
    \`stat_modifiers\`   JSON          NULL,
    \`is_concentration\` BOOLEAN       NOT NULL DEFAULT FALSE,
    \`notes\`            TEXT          NULL,
    \`created_at\`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_effects_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`abilities\` (
    \`id\`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`       INT UNSIGNED  NOT NULL,
    \`owner_char_id\`     INT UNSIGNED  NULL,
    \`owner_creature_id\` INT UNSIGNED  NULL,
    \`name\`              VARCHAR(150)  NOT NULL,
    \`description\`       TEXT          NULL,
    \`action_type\`       ENUM('action','bonus','reaction','passive','legendary','free') NOT NULL DEFAULT 'action',
    \`damage\`            VARCHAR(50)   NULL,
    \`damage_type\`       VARCHAR(50)   NULL,
    \`hit_bonus\`         TINYINT       NULL,
    \`range\`             VARCHAR(50)   NULL,
    \`cooldown\`          VARCHAR(100)  NULL,
    \`uses_max\`          TINYINT UNSIGNED NULL,
    \`uses_current\`      TINYINT UNSIGNED NULL,
    \`notes\`             TEXT          NULL,
    \`created_at\`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_abil_campaign\`  FOREIGN KEY (\`campaign_id\`)       REFERENCES \`campaigns\`(\`id\`)  ON DELETE CASCADE,
    CONSTRAINT \`fk_abil_char\`      FOREIGN KEY (\`owner_char_id\`)     REFERENCES \`characters\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_abil_creature\`  FOREIGN KEY (\`owner_creature_id\`) REFERENCES \`creatures\`(\`id\`)  ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`ability_effects\` (
    \`ability_id\`   INT UNSIGNED     NOT NULL,
    \`effect_id\`    INT UNSIGNED     NOT NULL,
    \`apply_order\`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
    \`notes\`        VARCHAR(255)     NULL,
    PRIMARY KEY (\`ability_id\`, \`effect_id\`),
    CONSTRAINT \`fk_ae_ability\` FOREIGN KEY (\`ability_id\`) REFERENCES \`abilities\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_ae_effect\`  FOREIGN KEY (\`effect_id\`)  REFERENCES \`effects\`(\`id\`)   ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`items\` (
    \`id\`                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    \`campaign_id\`       INT UNSIGNED     NOT NULL,
    \`owner_char_id\`     INT UNSIGNED     NULL,
    \`owner_creature_id\` INT UNSIGNED     NULL,
    \`name\`              VARCHAR(200)     NOT NULL,
    \`description\`       TEXT             NULL,
    \`type\`              ENUM('weapon','armor','shield','potion','scroll','wondrous','gear','treasure','other') NOT NULL DEFAULT 'other',
    \`rarity\`            ENUM('common','uncommon','rare','very_rare','legendary','artifact') NULL,
    \`quantity\`          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    \`weight\`            DECIMAL(8,2)     NULL,
    \`value\`             VARCHAR(50)      NULL,
    \`properties\`        JSON             NULL,
    \`is_equipped\`       BOOLEAN          NOT NULL DEFAULT FALSE,
    \`is_attuned\`        BOOLEAN          NOT NULL DEFAULT FALSE,
    \`notes\`             TEXT             NULL,
    \`created_at\`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_items_campaign\`  FOREIGN KEY (\`campaign_id\`)       REFERENCES \`campaigns\`(\`id\`)  ON DELETE CASCADE,
    CONSTRAINT \`fk_items_char\`      FOREIGN KEY (\`owner_char_id\`)     REFERENCES \`characters\`(\`id\`) ON DELETE SET NULL,
    CONSTRAINT \`fk_items_creature\`  FOREIGN KEY (\`owner_creature_id\`) REFERENCES \`creatures\`(\`id\`)  ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`campaign_plugins\` (
    \`id\`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\` INT UNSIGNED  NOT NULL,
    \`slug\`        VARCHAR(50)   NOT NULL,
    \`is_enabled\`  BOOLEAN       NOT NULL DEFAULT TRUE,
    \`config\`      JSON          NULL,
    \`enabled_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uq_campaign_plugin_slug\` (\`campaign_id\`, \`slug\`),
    CONSTRAINT \`fk_cplugins_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`combat\` (
    \`id\`                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`            INT UNSIGNED  NOT NULL,
    \`name\`                   VARCHAR(150)  NULL,
    \`round\`                  SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    \`status\`                 ENUM('pending','active','paused','completed') NOT NULL DEFAULT 'pending',
    \`current_participant_id\` INT UNSIGNED  NULL,
    \`started_at\`             DATETIME      NULL,
    \`ended_at\`               DATETIME      NULL,
    \`created_at\`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_combat_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`combat_participants\` (
    \`id\`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`combat_id\`   INT UNSIGNED  NOT NULL,
    \`char_id\`     INT UNSIGNED  NULL,
    \`creature_id\` INT UNSIGNED  NULL,
    \`initiative\`  SMALLINT      NOT NULL DEFAULT 0,
    \`hp_current\`  SMALLINT      NOT NULL DEFAULT 1,
    \`is_active\`   BOOLEAN       NOT NULL DEFAULT TRUE,
    \`notes\`       TEXT          NULL,
    \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_cprt_combat\`   FOREIGN KEY (\`combat_id\`)   REFERENCES \`combat\`(\`id\`)      ON DELETE CASCADE,
    CONSTRAINT \`fk_cprt_char\`     FOREIGN KEY (\`char_id\`)     REFERENCES \`characters\`(\`id\`) ON DELETE SET NULL,
    CONSTRAINT \`fk_cprt_creature\` FOREIGN KEY (\`creature_id\`) REFERENCES \`creatures\`(\`id\`)  ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`screen\` (
    \`id\`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`  INT UNSIGNED  NOT NULL,
    \`name\`         VARCHAR(200)  NOT NULL DEFAULT 'Main Screen',
    \`target\`       ENUM('dm','player') NOT NULL DEFAULT 'player',
    \`layout\`       JSON          NULL,
    \`is_active\`    BOOLEAN       NOT NULL DEFAULT FALSE,
    \`created_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_screen_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`screen_presets\` (
    \`id\`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\` INT UNSIGNED  NOT NULL,
    \`name\`        VARCHAR(200)  NOT NULL DEFAULT 'New Screen',
    \`layout\`      JSON          NOT NULL,
    \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_sp_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`map\` (
    \`id\`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`  INT UNSIGNED  NOT NULL,
    \`name\`         VARCHAR(200)  NOT NULL DEFAULT 'Map',
    \`image\`        VARCHAR(500)  NULL,
    \`data\`         LONGTEXT      NULL,
    \`grid_size\`    INT UNSIGNED  NOT NULL DEFAULT 50,
    \`is_visible\`   BOOLEAN       NOT NULL DEFAULT FALSE,
    \`view_state\`   JSON          NULL,
    \`created_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_map_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`map_entities\` (
    \`id\`            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    \`map_id\`        INT UNSIGNED      NOT NULL,
    \`entity_type\`   ENUM('character','creature','custom_npc','custom_enemy') NOT NULL,
    \`entity_id\`     INT UNSIGNED      NOT NULL,
    \`x\`             DOUBLE            NOT NULL DEFAULT 0,
    \`y\`             DOUBLE            NOT NULL DEFAULT 0,
    \`scale\`         DOUBLE            NOT NULL DEFAULT 1,
    \`parent_path\`   VARCHAR(255)      NULL,
    \`label\`         VARCHAR(200)      NULL,
    \`created_at\`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_me_map\` FOREIGN KEY (\`map_id\`) REFERENCES \`map\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`map_range_marks\` (
    \`id\`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`map_id\`      INT UNSIGNED  NOT NULL,
    \`shape\`       VARCHAR(20)   NOT NULL DEFAULT 'circle',
    \`x\`           DOUBLE        NOT NULL DEFAULT 0,
    \`y\`           DOUBLE        NOT NULL DEFAULT 0,
    \`x2\`          DOUBLE        NULL,
    \`y2\`          DOUBLE        NULL,
    \`x3\`          DOUBLE        NULL,
    \`y3\`          DOUBLE        NULL,
    \`radius\`      DOUBLE        NOT NULL DEFAULT 1,
    \`color\`       VARCHAR(20)   NOT NULL DEFAULT '#ff5252',
    \`parent_path\` VARCHAR(255)  NULL,
    \`created_at\`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_rm_map\` FOREIGN KEY (\`map_id\`) REFERENCES \`map\`(\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`notes\` (
    \`id\`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    \`campaign_id\`  INT UNSIGNED  NOT NULL,
    \`user_id\`      INT UNSIGNED  NOT NULL,
    \`character_id\` INT UNSIGNED  NULL,
    \`title\`        VARCHAR(255)  NOT NULL DEFAULT 'Untitled',
    \`content\`      TEXT          NULL,
    \`is_private\`   BOOLEAN       NOT NULL DEFAULT FALSE,
    \`created_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`fk_notes_campaign\` FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`fk_notes_user\`     FOREIGN KEY (\`user_id\`)     REFERENCES \`users\`(\`id\`)     ON DELETE CASCADE,
    CONSTRAINT \`fk_notes_char\`     FOREIGN KEY (\`character_id\`) REFERENCES \`characters\`(\`id\`) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

export async function initDb(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    for (const sql of SCHEMA) {
      await conn.execute(sql);
    }
    console.log('✓ Database schema initialized');
  } finally {
    conn.release();
  }
}
