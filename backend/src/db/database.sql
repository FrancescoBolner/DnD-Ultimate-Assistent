-- Active: 1762968267846@@127.0.0.1@3306@dnd_db
-- =============================================================
--  DnD Ultimate Assistant – MySQL Schema  (v3 – consolidated)
--  Generated: 2026-03-09
--
--  TABLES
--  ──────
--  Core  : users, campaigns, campaign_players
--  Plugin: characters, creatures, effects, abilities,
--          ability_effects, items
--  Meta  : campaign_plugins
--
--  KEY DESIGN DECISIONS
--  ────────────────────
--  1. No global `role` on users.  A user is a DM when they own a
--     campaign (campaigns.dm_id), a player when they appear in
--     campaign_players.  Same person can DM one game and play another.
--
--  2. user_settings and campaign_settings have been merged into
--     users and campaigns respectively (dark_mode, layout, preferences
--     / layout, permissions columns).
--
--  3. Effects are TEMPLATES (campaign_id NULL = system-wide, non-NULL
--     = DM custom)
--
--  4. Abilities belong to exactly ONE owner (character XOR creature)
--     via a CHECK constraint.  ability_effects links an ability to the
--     effect templates it triggers on use.
--
--  5. Plugin system is code-driven: plugin definitions live in
--     backend/src/modules/plugins/plugin-registry.ts;
--     campaign_plugins stores per-campaign activation by slug.
--
--  6. Addon plugins (combat, map, screen, notes) are not yet
--     implemented; their tables will be added when needed.
-- =============================================================

-- -------------------------------------------------------------
-- DROP  (reverse dependency order)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `map_range_marks`;
DROP TABLE IF EXISTS `map_entities`;
DROP TABLE IF EXISTS `screen_presets`;
DROP TABLE IF EXISTS `screen`;
DROP TABLE IF EXISTS `combat_participants`;
DROP TABLE IF EXISTS `ability_effects`;
DROP TABLE IF EXISTS `abilities`;
DROP TABLE IF EXISTS `effects`;
DROP TABLE IF EXISTS `items`;
DROP TABLE IF EXISTS `characters`;
DROP TABLE IF EXISTS `creatures`;
DROP TABLE IF EXISTS `campaign_players`;
DROP TABLE IF EXISTS `campaign_plugins`;
DROP TABLE IF EXISTS `combat`;
DROP TABLE IF EXISTS `campaigns`;
DROP TABLE IF EXISTS `users`;


-- =============================================================
-- CORE TABLES
-- =============================================================

-- -------------------------------------------------------------
-- users
-- -------------------------------------------------------------
CREATE TABLE `users` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `email`         VARCHAR(255)    NOT NULL,
    `username`      VARCHAR(100)    NOT NULL,
    `password_hash` VARCHAR(255)    NOT NULL,
    `avatar`        VARCHAR(500)    NULL,
    `is_admin`      BOOLEAN         NOT NULL DEFAULT FALSE,
    `is_active`     BOOLEAN         NOT NULL DEFAULT TRUE,
    `last_login`    DATETIME        NULL,
    `dark_mode`     BOOLEAN         NOT NULL DEFAULT TRUE,
    `layout`        JSON            NULL,
    `preferences`   JSON            NULL,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email`    (`email`),
    UNIQUE KEY `uq_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- campaigns
-- -------------------------------------------------------------
CREATE TABLE `campaigns` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(200)  NOT NULL,
    `description` TEXT          NULL,
    `dm_id`       INT UNSIGNED  NOT NULL,
    `invite_code` VARCHAR(20)   NULL,
    `status`      ENUM('active','paused','completed','archived') NOT NULL DEFAULT 'active',
    `image`       VARCHAR(500)  NULL,
    `layout`      JSON          NULL,
    `permissions` JSON          NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_invite_code` (`invite_code`),
    CONSTRAINT `fk_campaigns_dm` FOREIGN KEY (`dm_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- campaign_players  (N:M  users <-> campaigns)
-- -------------------------------------------------------------
CREATE TABLE `campaign_players` (
    `campaign_id` INT UNSIGNED NOT NULL,
    `user_id`     INT UNSIGNED NOT NULL,
    `status`      ENUM('invited','active','left','kicked','banned') NOT NULL DEFAULT 'invited',
    `joined_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`campaign_id`, `user_id`),
    CONSTRAINT `fk_cp_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- characters  (PCs – owned by a player in a campaign)
-- -------------------------------------------------------------
CREATE TABLE `characters` (
    `id`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    `player_id`   INT UNSIGNED      NULL,
    `campaign_id` INT UNSIGNED      NOT NULL,
    `name`        VARCHAR(150)      NOT NULL,
    `race`        VARCHAR(100)      NULL,
    `class`       VARCHAR(100)      NULL,
    `level`       TINYINT UNSIGNED  NOT NULL DEFAULT 1,
    `stats`       JSON              NULL,
    `hp_max`      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `hp_current`  SMALLINT          NOT NULL DEFAULT 1,
    `hp_temp`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `ac`          TINYINT UNSIGNED  NOT NULL DEFAULT 10,
    `speed`       SMALLINT UNSIGNED NOT NULL DEFAULT 6,
    `image`       VARCHAR(500)      NULL,
    `backstory`   TEXT              NULL,
    `is_active`   BOOLEAN           NOT NULL DEFAULT TRUE,
    `created_at`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_char_player`   FOREIGN KEY (`player_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_char_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- creatures  (NPCs, enemies)
-- -------------------------------------------------------------
CREATE TABLE `creatures` (
    `id`          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    `campaign_id` INT UNSIGNED      NOT NULL,
    `name`        VARCHAR(150)      NOT NULL,
    `type`        ENUM('npc','enemy','ally','beast') NOT NULL DEFAULT 'enemy',
    `cr`          VARCHAR(10)       NULL,
    `size`        ENUM('Tiny','Small','Medium','Large','Huge','Gargantuan') NOT NULL DEFAULT 'Medium',
    `stats`       JSON              NULL,
    `hp_max`      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `hp_current`  SMALLINT          NOT NULL DEFAULT 1,
    `hp_temp`     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `ac`          TINYINT UNSIGNED  NOT NULL DEFAULT 10,
    `speed`       SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    `image`       VARCHAR(500)      NULL,
    `sheet_image` VARCHAR(500)      NULL,
    `notes`       TEXT              NULL,
    `tags`        JSON              NULL,
    `race`        VARCHAR(100)      NULL,
    `religion`    VARCHAR(100)      NULL,
    `is_active`   BOOLEAN           NOT NULL DEFAULT TRUE,
    `created_at`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_creatures_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- ABILITIES & EFFECTS
-- =============================================================

-- -------------------------------------------------------------
-- effects
-- -------------------------------------------------------------
CREATE TABLE `effects` (
    `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id`      INT UNSIGNED  NULL,
    `name`             VARCHAR(150)  NOT NULL,
    `description`      TEXT          NULL,
    `duration`         VARCHAR(100)  NULL,
    `trigger_moment`   VARCHAR(100)  NULL,
    `damage`           VARCHAR(50)   NULL,
    `damage_type`      VARCHAR(50)   NULL,
    `save_type`        VARCHAR(20)   NULL,
    `save_dc`          TINYINT UNSIGNED NULL,
    `apply_on_save`    ENUM('half','negate','none') NOT NULL DEFAULT 'none',
    `conditions`       JSON          NULL,
    `stat_modifiers`   JSON          NULL,
    `is_concentration` BOOLEAN       NOT NULL DEFAULT FALSE,
    `notes`            TEXT          NULL,
    `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_effects_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- abilities  (what a character or creature CAN DO)
-- -------------------------------------------------------------
CREATE TABLE `abilities` (
    `id`                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id`       INT UNSIGNED  NOT NULL,
    `owner_char_id`     INT UNSIGNED  NULL,
    `owner_creature_id` INT UNSIGNED  NULL,
    `name`              VARCHAR(150)  NOT NULL,
    `description`       TEXT          NULL,
    `action_type`       ENUM('action','bonus','reaction','passive','legendary','free') NOT NULL DEFAULT 'action',
    `damage`            VARCHAR(50)   NULL,
    `damage_type`       VARCHAR(50)   NULL,
    `hit_bonus`         TINYINT       NULL,
    `range`             VARCHAR(50)   NULL,
    `cooldown`          VARCHAR(100)  NULL,
    `uses_max`          TINYINT UNSIGNED NULL,
    `uses_current`      TINYINT UNSIGNED NULL,
    `notes`             TEXT          NULL,
    `created_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_abil_campaign`  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_abil_char`      FOREIGN KEY (`owner_char_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_abil_creature`  FOREIGN KEY (`owner_creature_id`) REFERENCES `creatures`(`id`) ON DELETE CASCADE,
    CONSTRAINT `chk_abil_owner`    CHECK ((`owner_char_id` IS NOT NULL) != (`owner_creature_id` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- ability_effects (if an ability applies one or more effects)
-- -------------------------------------------------------------
CREATE TABLE `ability_effects` (
    `ability_id`   INT UNSIGNED     NOT NULL,
    `effect_id`    INT UNSIGNED     NOT NULL,
    `apply_order`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `notes`        VARCHAR(255)     NULL,
    PRIMARY KEY (`ability_id`, `effect_id`),
    CONSTRAINT `fk_ae_ability` FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ae_effect`  FOREIGN KEY (`effect_id`) REFERENCES `effects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- OTHER CORE TABLES
-- =============================================================

-- -------------------------------------------------------------
-- items  (inventory – owned by character, creature, or unowned)
-- -------------------------------------------------------------
CREATE TABLE `items` (
    `id`                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `campaign_id`       INT UNSIGNED     NOT NULL,
    `owner_char_id`     INT UNSIGNED     NULL,
    `owner_creature_id` INT UNSIGNED     NULL,
    `name`              VARCHAR(200)     NOT NULL,
    `description`       TEXT             NULL,
    `type`              ENUM('weapon','armor','shield','potion','scroll', 'wondrous','gear','treasure','other') NOT NULL DEFAULT 'other',
    `rarity`            ENUM('common','uncommon','rare','very_rare', 'legendary','artifact') NULL,
    `quantity`          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `weight`            DECIMAL(8,2)     NULL,
    `value`             VARCHAR(50)      NULL,
    `properties`        JSON             NULL,
    `is_equipped`       BOOLEAN          NOT NULL DEFAULT FALSE,
    `is_attuned`        BOOLEAN          NOT NULL DEFAULT FALSE,
    `notes`             TEXT             NULL,
    `created_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_items_campaign`  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_items_char`      FOREIGN KEY (`owner_char_id`) REFERENCES `characters`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_items_creature`  FOREIGN KEY (`owner_creature_id`) REFERENCES `creatures`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- CAMPAIGN PLUGINS
-- =============================================================

CREATE TABLE `campaign_plugins` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id` INT UNSIGNED  NOT NULL,
    `slug`        VARCHAR(50)   NOT NULL,
    `is_enabled`  BOOLEAN       NOT NULL DEFAULT TRUE,
    `config`      JSON          NULL,
    `enabled_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_campaign_plugin_slug` (`campaign_id`, `slug`),
    CONSTRAINT `fk_cplugins_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- COMBAT
-- =============================================================

CREATE TABLE `combat` (
    `id`                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id`            INT UNSIGNED  NOT NULL,
    `name`                   VARCHAR(150)  NULL,
    `round`                  SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `status`                 ENUM('pending','active','paused','completed') NOT NULL DEFAULT 'pending',
    `current_participant_id` INT UNSIGNED  NULL,
    `started_at`             DATETIME      NULL,
    `ended_at`               DATETIME      NULL,
    `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_combat_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `combat_participants` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `combat_id`   INT UNSIGNED  NOT NULL,
    `char_id`     INT UNSIGNED  NULL,
    `creature_id` INT UNSIGNED  NULL,
    `initiative`  SMALLINT      NOT NULL DEFAULT 0,
    `hp_current`  SMALLINT      NOT NULL DEFAULT 1,
    `is_active`   BOOLEAN       NOT NULL DEFAULT TRUE,
    `notes`       TEXT          NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_cprt_combat`   FOREIGN KEY (`combat_id`)   REFERENCES `combat`(`id`)       ON DELETE CASCADE,
    CONSTRAINT `fk_cprt_char`     FOREIGN KEY (`char_id`)     REFERENCES `characters`(`id`)    ON DELETE SET NULL,
    CONSTRAINT `fk_cprt_creature` FOREIGN KEY (`creature_id`) REFERENCES `creatures`(`id`)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------
-- screen
-- -------------------------------------------------------------
CREATE TABLE `screen` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id`  INT UNSIGNED  NOT NULL,
    `name`         VARCHAR(200)  NOT NULL DEFAULT 'Main Screen',
    `target`       ENUM('dm','player') NOT NULL DEFAULT 'player',
    `layout`       JSON          NULL,
    `is_active`    BOOLEAN       NOT NULL DEFAULT FALSE,
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_screen_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- screen_presets  (saved DM screen configurations)
-- -------------------------------------------------------------
CREATE TABLE `screen_presets` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id` INT UNSIGNED  NOT NULL,
    `name`        VARCHAR(200)  NOT NULL DEFAULT 'New Screen',
    `layout`      JSON          NOT NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_sp_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================
-- MAP
-- =============================================================

CREATE TABLE `map` (
    `id`           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `campaign_id`  INT UNSIGNED  NOT NULL,
    `name`         VARCHAR(200)  NOT NULL DEFAULT 'Map',
    `image`        VARCHAR(500)  NULL,
    `data`         LONGTEXT      NULL,
    `grid_size`    INT UNSIGNED  NOT NULL DEFAULT 50,
    `is_visible`   BOOLEAN       NOT NULL DEFAULT FALSE,
    `view_state`   JSON          NULL     COMMENT '{"originX":0,"originY":0,"scale":1}',
    `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_map_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `map_entities` (
    `id`            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    `map_id`        INT UNSIGNED      NOT NULL,
    `entity_type`   ENUM('character','creature','custom_npc','custom_enemy') NOT NULL,
    `entity_id`     INT UNSIGNED      NOT NULL,
    `x`             DOUBLE            NOT NULL DEFAULT 0,
    `y`             DOUBLE            NOT NULL DEFAULT 0,
    `scale`         DOUBLE            NOT NULL DEFAULT 1,
    `parent_path`   VARCHAR(255)      NULL     COMMENT 'Path in config tree e.g. "0,2,1"',
    `label`         VARCHAR(200)      NULL,
    `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_me_map` FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `map_range_marks` (
    `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `map_id`      INT UNSIGNED  NOT NULL,
    `shape`       VARCHAR(20)   NOT NULL DEFAULT 'circle',
    `x`           DOUBLE        NOT NULL DEFAULT 0,
    `y`           DOUBLE        NOT NULL DEFAULT 0,
    `x2`          DOUBLE        NULL,
    `y2`          DOUBLE        NULL,
    `x3`          DOUBLE        NULL,
    `y3`          DOUBLE        NULL,
    `radius`      DOUBLE        NOT NULL DEFAULT 1,
    `color`       VARCHAR(20)   NOT NULL DEFAULT '#ff5252',
    `parent_path` VARCHAR(255)  NULL,
    `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_rm_map` FOREIGN KEY (`map_id`) REFERENCES `map`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*
-- =============================================================

INSERT INTO `users` (`id`, `email`, `username`, `password_hash`, `avatar`) VALUES
(1, 'dm@dnd.local',             'Francesco',     '$2b$12$YrtDUbl.Ev3q7H246BeGruIlsHykAvCbzpyaFwlLk/bJoW.x45bOq', 'https://lh3.googleusercontent.com/a/ACg8ocJ2NIz2TP5PnU2cZVLeJ0kmpNf_3ni_4b4PASnlCGug9izjFWaI=s360-c-no'),
(2, 'niccolo@dnd.local',        'Niccolò',       '$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', ''),
(3, 'pasta@dnd.local',          'Pasta al Pesto','$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', ''),
(4, 'luca@dnd.local',           'Luca',          '$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', ''),
(5, 'gianduia@dnd.local',       'Gianduia',      '$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', ''),
(6, 'toni@dnd.local',           'Toni',          '$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', ''),
(7, 'gigi@dnd.local',           'Gigi',          '$2b$12$9i7OhfKZR3zTnksDQfkX9urRXoxJiEEH6FGTgMOYDpRyRArI8813K', '');

INSERT INTO `campaigns` (`id`, `name`, `description`, `dm_id`, `invite_code`, `status`) VALUES
(1, 'Cronache dei Tre Regni', 'Le cronache dei tre regni', 1, 'CFA2XQ-FXJCIU', 'active');

INSERT INTO `campaign_players` (`campaign_id`, `user_id`, `status`) VALUES
(1, 2, 'active'),
(1, 3, 'active'),
(1, 4, 'active'),
(1, 5, 'active'),
(1, 6, 'active'),
(1, 7, 'active');

INSERT INTO `characters` (`player_id`, `campaign_id`, `name`, `race`, `class`, `level`, `stats`, `hp_max`, `hp_current`, `ac`, `speed`, `backstory`) VALUES
(2, 1, 'Toto',       'Elfo della Luna', 'Fighter',    2, '{"str":18,"dex":20,"con":17,"int":10,"wis":16,"cha":3}',  29, 29, 15, 11, "Nacque a Trapanium, una località marittima in provincia di Neversummer, situata nel Regno Wei, durante le vacanze dei suoi genitori. Pochi giorni dopo la nascita, venne riportato nella Zona Iper Magica a Neverwinter, città natale dei genitori e principalmente abitata da elfi della luna. La sua famiglia era di alta borghesia, quindi visse una gioventù molto agiata fino ai 200 anni.
La sua vita stava per cambiare. Quell'anno, sotto il comando del drago antico bianco Jarvis, i suoi draghi sottomessi riuscirono a penetrare, per cause misteriose, le barriere magiche innalzate dagli elfi della luna. La città venne rasa al suolo e la maggior parte degli abitanti morì, compresi i suoi genitori. Da qui nacque il suo odio profondo verso i draghi e la sua folle passione per le armi, giurando di ucciderlo.
Dopo l'accaduto, decise di tornare nella città di Trapanium e, dopo 100 anni, si sposò lì con un'umana, che però morì di vecchiaia circa 50 anni dopo. Ancora oggi porta un ciondolo con un dipinto di sua moglie al collo. Successivamente lavorò per 40 anni come marinaio in una ciurma di pirati.
All'età di 390 anni, decise di abbandonare la ciurma e partire per un viaggio nella speranza di trovare altri elfi della luna con cui condividere il suo tempo."),
(4, 1, 'Lumay+',     'Tortle',          'Monk',       2, '{"str":20,"dex":8,"con":18,"int":20,"wis":8,"cha":12}',   16, 16, 14,  5, "Nacque e visse a Foggia, una città in provincia di Neversummer, situata nel Regno Wei, per tutta la gioventù. Non si conosce con precisione il suo stato sociale, ma di certo non era molto agiato, essendo figlio di proletari. Inoltre, non era ben inserito nella società, anche perché era una fottutissima tartaruga che faceva gambling.
Per molti anni visse a casa, mantenuto dai suoi genitori, scommettendo di tanto in tanto, e pian piano cadde nella pigrizia, vedendo tutto come uno sfizio. All'età di 32 anni, la maledizione della non morte fece effetto e smise di invecchiare.
Successivamente, durante una crisi di mezza età intorno ai quarant'anni, scommise tutto quello che aveva sul rosso… e vinse. Ma poi, a causa della sua dedizione al gioco d'azzardo, fece all-in sul nero e perse tutto, compresa l'intera famiglia, che finì in schiavitù.
Dopo l'accaduto, vagò per anni senza meta, scommettendo tutto quello che poteva trovare e vivendo alla giornata. All'età di 54 anni si imbatté in alcuni avventurieri e decise di joinare il party."),
(5, 1, 'Paaruna',    'Human',           'Fighter',    1, '{"str":18,"dex":10,"con":17,"int":16,"wis":4,"cha":14}',  20, 20, 15,  6, "Paaruna era un rinomato guerriero della terra di Kuzrykel, un feudo isolano dell’est. In una terra nella quale vigeva il matriarcato, i figli delle grandi case dovevano mostrarsi forti protettori per essere scelti come partiti. Egli era noto come il “Cacciatore Crudele”, da cui il suo nome nella lingua antica del suo popolo, il Kuzrykano, soprannome datogli dopo il suo ritorno da vincitore dopo aver sedato una rivolta su Avelgard. Giunto il Morschlag, il giorno degli antenati, dove si venerano i defunti e si uniscono le nuove coppie coniugali, mentre Paaruna saliva i 10000 gradini per la città sacra, così da arrivare dalla principessa di Kurzrykel, Ifelia, Amudin, figlio della famiglia regnante di Avelgard, aprì un portale dei demoni e fece invadere le isole da un’orda di creature infernali, che provocarono morte e distruzione su larghissima scala. Durante lo scontro i più prodi guerrieri delle isole morirono per chiudere detto portale e Paaruna perse un braccio per colpa delle fiamme. Con la morte delle principesse ereditarie, il feudo di Kuzrykel, già quasi sconosciuto, scomparve dalle mappe. Giunto sul continente, Paaruna trovò degli alleati, ma perse conoscenza e si risvegliò su una spiaggia; da lì si mosse alla ricerca dei suoi sodali, solo per scoprirli partiti."),
(6, 1, 'Frieren',    'Elfo del Sole',   'Wizard',     3, '{"str":11,"dex":17,"con":10,"int":18,"wis":15,"cha":16}', 15, 15, 10,  9, "È nata nella città di Murvel, situata nel Regno Wu. Non ha una vita facile fin dall'inizio: è il frutto di una gravidanza indesiderata, e ciò si riflette chiaramente nel comportamento dei suoi genitori, che la maltrattano (non sessualmente) fino ad abbandonarla all'età di 20 anni. Da quel momento, è costretta a mantenersi da sola, vivendo come senzatetto per 10 anni.
Per sopravvivere, svolge ogni tipo di lavoro, compresa la prostituzione, e sviluppa un profondo disprezzo per il prossimo. Tuttavia, un giorno incontra un uomo che la prende sotto la sua ala. Vivono insieme per 28 anni, finché lui, cogliendola di sorpresa, la ferisce con la Freccia d'Oro, donandole il potere degli Stand. Lei non conosce il motivo del gesto e, sentendosi tradita, fugge da lui.
Ora è sola, vaga senza una meta e senza la piena consapevolezza del potere che possiede. Odia il prossimo, ma ciò di cui ha davvero bisogno è un mentore, qualcuno che la apprezzi e la sostenga. Per ora, però, rifiuta questa possibilità."),
(3, 1, 'Ariel',       'Human',           'Cleric',    2, '{"str":7,"dex":16,"con":5,"int":20,"wis":12,"cha":20}',   14, 14, 14,  9, "Un tempo era un prete comune della città di Alberka, di scarso successo (aveva tentato di provarci con una quattordicenne, ma lei gli aveva risposto: 'Ew, no'). Una notte, all'età di 20 anni, mentre scontava una piccola pena in carcere per quell'episodio, gli si rivelò la grande waifu, Speedwagon, che gli rivelò la verità sugli dèi. Convertire le persone alle waifu divenne la sua missione, ma ben presto venne dichiarato eretico ed espulso dal circolo dei preti.
Da lì a poco iniziò a vestirsi da donna, fino a diventare un autentico femboy, e viaggiò di città in città principalmente nel Regno Wu senza una reale dimora. Tuttavia, dopo la sua espulsione, la situazione della religione peggiorò, e le persone abbandonarono questo culto. Tutt'oggi non ha seguaci.
Attualmente si limita a girare per le locande, cercando un gruppo con cui viaggiare nella speranza di trovare persone disposte a convertirsi."),
(7, 1, 'Abbondanzio', 'Dragonide',       'Sourcered', 2, '{"str":22,"dex":13,"con":17,"int":8,"wis":9,"cha":14}',   19, 19, 13, 7, "Sua madre è Silvia Rea, la principessa decaduta del Granducato di Gyoza, situato nel Regno Shu. Una notte, mentre dormiva, fu posseduta da un drago sputa-acido e, dopo quell'evento, partorì un uovo. Lui nacque proprio da quell'uovo, come dragonide.
In seguito, vennero allontanati dal castello e si stabilirono nei bassifondi di Gyoza, dove sua madre morì, abbandonandolo all'età di 4 anni.
Durante la giovinezza riuscì a sopravvivere agli atti di bullismo causati dal suo aspetto… leccando gli altri bambini. Così scoprì la sua curiosa passione per il leccare e far corrodere le cose.
All'età di 20 anni fu imprigionato con l'accusa di aver leccato e corroso molti bambini.
Dopo un anno, durante la notte, la città di Gyoza venne attaccata da Gola e, nel trambusto, riuscì a fuggire dalla prigione e a scappare dalla città. La mattina seguente, Gyoza sparì da tutte le cartine geografiche e nessuno seppe più che fine avesse fatto.
Iniziò così il suo viaggio, deciso a investigare sulla sparizione della città e a trovare alleati per riconquistare il trono che ritiene gli sia stato ingiustamente sottratto. All'età di 23 anni si unì a un party di avventurieri.");

INSERT INTO `creatures`
  (`campaign_id`, `name`, `type`, `cr`, `size`, `stats`, `hp_max`, `hp_current`, `hp_temp`, `ac`, `speed`, `image`, `tags`, `race`, `religion`, `is_active`)
VALUES
  (1, 'D''Arby',                              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/D%27Arby.png',                                                  '["Regno Wu","Monzun"]',       'Foggiano',          'Culto Waifu',     1),
  (1, 'Don Gennaro il Violaceo',              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   43,   43, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Don%20Gennaro%20il%20Violaceo.png',                             '["Regno Wu","Monzun"]',       'Umano',             'Culto Waifu',     1),
  (1, 'Enrico Donadio',                       'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Enrico%20Donadio.png',                                          '["Regno Wu","Monzun"]',       'Umano',             'Culto Waifu',     1),
  (1, 'Escandoro',                            'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   30,   30, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Escandoro.png',                                                 '["Regno Wu","Monzun"]',       'Umano',             'Culto Waifu',     1),
  (1, 'Gabriella la Soleggiante',             'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    5,    5, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Gabriella%20la%20Soleggiante.png',                              '["Regno Wu","Monzun"]',       'Elfo del Sole',     'Culto Waifu',     1),
  (1, 'Germano dell''Ale Amara',              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Germano%20dell%27Ale%20Amara.png',                              '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'Giovanna Arcoletto',                   'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Giovanna%20Arcoletto.png',                                      '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'Golden Eagle',                         'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    0,    0, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Golden%20Eagle.png',                                            '["Regno Wu","Monzun"]',       NULL,                NULL,              1),
  (1, 'Gustavo Piumaletto',                   'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Gustavo%20Piumaletto.png',                                      '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'I mitici sium',                        'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    0,    0, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/I%20mitici%20sium.png',                                         '["Regno Wu","Monzun"]',       NULL,                'Culto Waifu',     1),
  (1, 'Katheryne Genpact',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}', 9999, 9999, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Katheryne%20Genpact.png',                                       '["Regno Wu","Monzun"]',       NULL,                'La Fede',         1),
  (1, 'Luke Greatsword',                      'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   40,   40, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Luke%20Greatsword.png',                                         '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'Marella la Speziata',                  'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Marella%20la%20Speziata.png',                                   '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'Marina e Sibilla Arcoletto',           'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Marina%20e%20Sibilla%20Arcoletto.png',                          '["Regno Wu","Monzun"]',       'Umano',             'La Fede',         1),
  (1, 'Mario Bronzofiero',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   45,   45, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Mario%20Bronzofiero.png',                                       '["Regno Wu","Monzun"]',       'Nano',              'Culto Waifu',     1),
  (1, 'Maurizio Valcroce',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Maurizio%20Valcroce.png',                                       '["Regno Wu","Monzun"]',       'Umano',             'Culto Waifu',     1),
  (1, 'Morbus Squat',                         'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    0,    0, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Morbus%20Squat.png',                                            '["Regno Wu","Monzun"]',       NULL,                NULL,              1),
  (1, 'Silver e Melus i Violacei',            'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   20,   20, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Silver%20e%20Melus%20i%20Violacei.png',                         '["Regno Wu","Monzun"]',       'Umano',             NULL,              1),
  (1, 'Ugo il Violaceo',                      'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    1,    1, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Monzun/Ugo%20il%20Violaceo.png',                                       '["Regno Wu","Monzun"]',       'Foggiano',          'Culto Waifu',     1),
  (1, 'Fantozzi',                             'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',   45,   45, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Smogol/Fantozzi.png',                                                  '["Regno Wu","Smogol"]',       'Nonmorto',          'Culto Waifu',     1),
  (1, 'Giordano Malverus',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Giordano%20Malverus.png',                                      '["Regno Re Demone"]',         'Demone',            'Il Caos',         1),
  (1, 'Max Verstappen',                       'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Max%20Verstappen.png',                                         '["Regno Wu","Alberka"]',      'Uma',               NULL,              1),
  (1, 'Nelliel Uma',                          'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Nelliel%20Uma.png',                                            '["Regno Wu","Alberka"]',      'Uma',               NULL,              1),
  (1, 'Ragyō Kiryūin',                        'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Ragi%C5%8D%20Kiry%C5%ABin.png',                                '["Regno Wu","Alberka"]',      'Microbionte',       NULL,              1),
  (1, 'Ryuko Matoi',                          'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Ryuko%20Matoi.png',                                            '["Regno Wu","Alberka"]',      'Microbionte',       'La Fede',         1),
  (1, 'Urara Uma',                            'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Alberka/Urara%20Uma.png',                                              '["Regno Wu","Alberka"]',      'Uma',               NULL,              1),
  (1, 'Leonard',                              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Feyrest/Leonard.png',                                                  '["Regno Wu","Feyrest"]',      'Elfo delle Stelle', 'Il Grande Fungo', 1),
  (1, 'Manshy',                               'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Feyrest/Manshy.png',                                                   '["Regno Wu","Feyrest"]',      'Elfo delle Stelle', 'Il Grande Fungo', 1),
  (1, 'Don Gennaro Purple Max',               'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Azuma/Don%20Gennaro%20Purple%20Max.png',                               '["Regno Wei","Azuma"]',        'Umano',             NULL,              1),
  (1, 'Kasane Teto',                          'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Azuma/Kasane%20Teto.png',                                              '["Regno Wei","Azuma"]',        'Cyborg',            NULL,              1),
  (1, 'Domsten The Soul Hunter',              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Spinoff/Domsten%20The%20Soul%20Hunter.png',                            NULL,                          NULL,                NULL,              1),
  (1, 'Zaric Stormstrike',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Spinoff/Zaric%20Stormstrike.png',                                      '["Spinoff"]',                 'Chuck norris',      NULL,              1),
  (1, 'Nyxara Shadowveil',                    'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Spinoff/Nyxara%20Shadowveil.png',                                      '["Spinoff"]',                 'Umano',             NULL,              1),
  (1, 'Gabriella la Soleggiante Maid Outfit', 'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Spinoff/Gabriella%20la%20Soleggiante%20Maid%20Outfit.png',             '["Spinoff"]',                 'Elfo del Sole',     NULL,              1),
  (1, 'Luca Nostro Chitarrista',              'npc', NULL, 'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',    4,    4, 4, 10, 6, 'https://fbdev.altervista.org/DnD/assets/npc/Spinoff/Luca%20Nostro%20Chitarrista.png',                              '["Spinoff"]',                 'Elfo di Natale',    NULL,              1);

INSERT INTO `creatures`
  (`campaign_id`, `name`, `type`, `cr`, `size`, `stats`, `hp_max`, `hp_current`, `hp_temp`, `ac`, `speed`, `image`, `tags`, `race`, `religion`, `is_active`)
VALUES
  (1, 'Zombie',                      'enemy', '1/4',  'Medium', '{"str":13,"dex":6,"con":16,"int":3,"wis":6,"cha":5}',    15,  15, 0,  8, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Zombie.png',                                     '["Normal"]',                   'Nonmorto',       NULL,      1),
  (1, 'Scheletro',                   'enemy', '1/4',  'Medium', '{"str":10,"dex":16,"con":15,"int":6,"wis":8,"cha":5}',   13,  13, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Scheletro.png',                                  '["Normal"]',                   'Nonmorto',       NULL,      1),
  (1, 'Minotauro Scheletro',         'enemy', '2',    'Large',  '{"str":18,"dex":11,"con":15,"int":6,"wis":8,"cha":5}',   45,  45, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Minotauro%20Scheletro.png',                      '["Boss"]',                     'Nonmorto',       NULL,      1),
  (1, 'Cercaluce',                   'enemy', '1/4',  'Medium', '{"str":11,"dex":18,"con":19,"int":5,"wis":9,"cha":6}',   10,  10, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Cercaluce.png',                                  '["Normal"]',                   'Nonmorto',       NULL,      1),
  (1, 'The Obelisco',                'enemy', '8',    'Huge',   '{"str":25,"dex":10,"con":23,"int":16,"wis":15,"cha":19}', 500, 500, 0, 18, 6, 'https://fbdev.altervista.org/DnD/assets/boss/The%20Obelisco.png',                           '["Boss"]',                     'Animale',        NULL,      1),
  (1, 'Mostro di Mon''s Lake',       'enemy', '5',    'Huge',   '{"str":18,"dex":12,"con":16,"int":5,"wis":14,"cha":8}',  240, 240, 0, 14, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mostro%20di%20Mon%27s%20Lake.png',              '["Boss"]',                     'Animale',        NULL,      1),
  (1, 'Rana Gigante',                'enemy', '1/4',  'Large',  '{"str":12,"dex":14,"con":12,"int":23,"wis":10,"cha":3}',  26,  26, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Rana%20Gigante.png',                            '["Normal"]',                   'Animale',        NULL,      1),
  (1, 'Farfalfuoco',                 'enemy', NULL,   'Small',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Farfalfuoco.png',                               '["Normal"]',                   'Animale',        NULL,      1),
  (1, 'Clamidocertola Femmina',      'enemy', '1/4',  'Large',  '{"str":14,"dex":10,"con":10,"int":4,"wis":12,"cha":8}',   22,  22, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Clamidocertola%20Femmina.png',                  '["Small"]',                    'Animale',        NULL,      1),
  (1, 'Clamidocertola Maschio',      'enemy', '1/8',  'Medium', '{"str":8,"dex":12,"con":8,"int":4,"wis":10,"cha":4}',     12,  12, 0,  6, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Clamidocertola%20Maschio.png',                  '["Small"]',                    'Animale',        NULL,      1),
  (1, 'Batuffolo Sofficioso',        'enemy', '0',    'Small',  '{"str":10,"dex":10,"con":23,"int":8,"wis":16,"cha":14}',   4,   4, 0,  2, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Batuffolo%20Sofficioso.png',                    '["Small"]',                    'Animale',        NULL,      1),
  (1, 'Re Demone',                   'enemy', '100',  'Huge',   '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Re%20Demone.png',                               '["Re Demone"]',                'Demone',         'Il Caos', 1),
  (1, 'Accidia',                     'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Accidia.png',                                   '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Avarizia',                    'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Avarizia.png',                                  '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Gola',                        'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Gola.png',                                      '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Invidia',                     'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Invidia.png',                                   '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Ira',                         'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Ira.png',                                       '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Lussuria',                    'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Lussuria.png',                                  '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Superbia',                    'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Superbia.png',                                  '["7 Peccati Capitali"]',       'Demone',         'Il Caos', 1),
  (1, 'Drunglon',                    'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Drunglon.png',                                  '["Subordinates"]',             'Demone',         'Il Caos', 1),
  (1, 'Humerus',                     'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Humerus.png',                                   '["Subordinates"]',             'Demone',         'Il Caos', 1),
  (1, 'Hammarn',                     'enemy', '4',    'Large',  '{"str":9,"dex":14,"con":9,"int":12,"wis":17,"cha":12}',   60,  60, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Hammarn.png',                                   '["Subordinates"]',             'Demone',         'Il Caos', 1),
  (1, 'Guardia Imperiale Generale',  'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Guardia%20Imperiale%20Generale.png',            '["Imperial"]',                 'Umano',          'La Fede', 1),
  (1, 'Guardia Imperiale Mago',      'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Guardia%20Imperiale%20Mago.png',                '["Imperial"]',                 'Umano',          'La Fede', 1),
  (1, 'Guardia Imperiale Soldato',   'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Guardia%20Imperiale%20Soldato.png',             '["Imperial"]',                 'Umano',          'La Fede', 1),
  (1, 'Guardia Imperiale Tank',      'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Guardia%20Imperiale%20Tank.png',                '["Imperial"]',                 'Umano',          'La Fede', 1),
  (1, 'Greg l''Incantatore',         'enemy', '21',   'Medium', '{"str":7,"dex":14,"con":12,"int":18,"wis":16,"cha":14}',  55,  55, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Greg%20l%20Incantatore.png',                    '["Sabba"]',                    'Umano',          'Il Caos', 1),
  (1, 'Adepta dei Demoni',           'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Adepta%20dei%20Demoni.png',                     '["Sabba"]',                    'Umano',          'Il Caos', 1),
  (1, 'Cultista dei Demoni',         'enemy', '1',    'Medium', '{"str":10,"dex":14,"con":10,"int":12,"wis":18,"cha":12}', 18,  18, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Cultista%20dei%20Demoni.png',                   '["Sabba"]',                    'Umano',          'Il Caos', 1),
  (1, 'Pételgeuse Romanée-Conti',    'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/P%C3%A9telgeuse%20Roman%C3%A9e-Conti.png',      '["Sabba"]',                    'Umano',          'Il Caos', 1),
  (1, 'Spada del Paradiso',          'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Spada%20del%20Paradiso.png',                    '["Sabba"]',                    'Umano',          'Il Caos', 1),
  (1, 'Amudin',                      'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Amudin.png',                                    '["Sabba"]',                    'Kuzrykeliano',   'Il Caos', 1),
  (1, 'Delinquente Base',            'enemy', '1/8',  'Medium', '{"str":15,"dex":11,"con":14,"int":10,"wis":10,"cha":11}', 26,  26, 0, 11, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Delinquente%20Base.png',                        '["Thief"]',                    'Umano',           NULL,     1),
  (1, 'Kinglork',                    'enemy', NULL,   'Huge',   '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Kinglork.png',                                  '["Boss"]',                     'Lork',            NULL,     1),
  (1, 'Borlork',                     'enemy', '1',    'Large',  '{"str":18,"dex":8,"con":20,"int":8,"wis":10,"cha":12}',   42,  42, 0, 16, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Borlork.png',                                   '["Normal"]',                   'Lork',            NULL,     1),
  (1, 'Goblin',                      'enemy', NULL,   'Small',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Goblin.png',                                    '["Normal"]',                   'Lork',            NULL,     1),
  (1, 'Marlork',                     'enemy', '1/2',  'Large',  '{"str":16,"dex":8,"con":14,"int":10,"wis":12,"cha":8}',   26,  26, 0, 11, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Marlork.png',                                   '["Normal"]',                   'Lork',            NULL,     1),
  (1, 'Mirlork',                     'enemy', '1/4',  'Small',  '{"str":8,"dex":16,"con":8,"int":10,"wis":6,"cha":8}',      7,   7, 0,  8, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mirlork.png',                                   '["Support"]',                  'Lork',            NULL,     1),
  (1, 'Giordano Mutato',             'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Giordano%20Mutato.png',                         '["Boss"]',                     'Mutaforma',       NULL,     1),
  (1, 'Mimutato Superiore',          'enemy', '2',    'Large',  '{"str":18,"dex":12,"con":10,"int":14,"wis":4,"cha":6}',   45,  45, 0, 11, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mimutato%20Superiore.png',                      '["Boss"]',                     'Mutaforma',       NULL,     1),
  (1, 'Armatura Vivente',            'enemy', '2',    'Large',  '{"str":14,"dex":11,"con":13,"int":1,"wis":3,"cha":1}',    22,  22, 0, 17, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Armatura%20Vivente.png',                        '["Normal"]',                   'Mutaforma',       NULL,     1),
  (1, 'Mimic',                       'enemy', '2',    'Medium', '{"str":17,"dex":12,"con":15,"int":5,"wis":13,"cha":8}',   26,  26, 0, 12, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mimic.png',                                     '["Normal"]',                   'Mutaforma',       NULL,     1),
  (1, 'Mimutato',                    'enemy', '1/4',  'Medium', '{"str":10,"dex":14,"con":8,"int":12,"wis":4,"cha":6}',    17,  17, 0,  9, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mimutato.png',                                  '["Normal"]',                   'Mutaforma',       NULL,     1),
  (1, 'Rockky',                      'enemy', '0',    'Small',  '{"str":16,"dex":1,"con":18,"int":1,"wis":3,"cha":1}',     15,  15, 0, 17, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Rockky.png',                                    '["Support"]',                  'Mutaforma',       NULL,     1),
  (1, 'Thalor the Dark Death',       'enemy', NULL,   'Large',  '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Thalor%20the%20Dark%20Death.png',               '["Spinoff"]',                  NULL,              NULL,     1),
  (1, 'Adolf su un dinosauro',       'enemy', NULL,   'Huge',   '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Adolf%20su%20un%20dinosauro.png',               '["Spinoff"]',                  NULL,              NULL,     1),
  (1, 'Una Magia (Ciro Esposito)',   'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Una%20Magia%20%28Ciro%20Esposito%29.png',       '["Spinoff"]',                  NULL,              NULL,     1),
  (1, 'Mariah Carey',                'enemy', NULL,   'Medium', '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',  4,   4, 0, 10, 6, 'https://fbdev.altervista.org/DnD/assets/boss/Mariah%20Carey.png',                            '["Spinoff"]',                  NULL,              NULL,     1);

INSERT INTO `campaign_plugins` (`campaign_id`, `slug`, `is_enabled`, `config`) VALUES
(1, 'creatures',  TRUE, '{"fullscreen":true,"widget":true,"popup":false}'),
(1, 'characters', TRUE, '{"fullscreen":true,"widget":true,"popup":false}'),
(1, 'abilities',  TRUE, '{"fullscreen":true,"widget":true,"popup":false}'),
(1, 'effects',    TRUE, '{"fullscreen":true,"widget":true,"popup":false}'),
(1, 'items',      TRUE, '{"fullscreen":true,"widget":true,"popup":false}');

INSERT INTO `effects` (`id`, `campaign_id`, `name`, `description`, `duration`, `trigger_moment`, `damage`, `damage_type`, `save_type`, `save_dc`, `apply_on_save`, `conditions`, `stat_modifiers`, `is_concentration`) VALUES
( 1, NULL, 'Avvelenato',      'Svantaggio ai tiri per colpire e alle prove di caratteristica.',
  'Until cured',      NULL,            NULL,   NULL,       NULL,  NULL, 'none',   '["poisoned"]',                         NULL,                  FALSE),
( 2, NULL, 'Stordito',        'Non può compiere azioni, svantaggiato sulle prove di FOR e DES, i tiri per colpire contro di lui hanno vantaggio.',
  '1 round',          NULL,            NULL,   NULL,       'CON', 15,   'negate', '["stunned","incapacitated"]',           NULL,                  FALSE),
( 3, NULL, 'Prono',           'I tiri per colpire corpo a corpo contro di lui hanno vantaggio, i suoi attacchi hanno svantaggio.',
  'Until stood up',   NULL,            NULL,   NULL,       NULL,  NULL, 'none',   '["prone"]',                            NULL,                  FALSE),
( 4, NULL, 'Accecato',        'Non può vedere, svantaggio ai tiri per colpire, i nemici hanno vantaggio contro di lui.',
  'Until cured',      NULL,            NULL,   NULL,       NULL,  NULL, 'none',   '["blinded"]',                          NULL,                  FALSE),
( 5, NULL, 'Spaventato',      'Svantaggio ai tiri per colpire mentre la fonte è visibile; non può avvicinarsi volontariamente alla fonte.',
  'Until source out of sight', NULL,   NULL,   NULL,       'WIS', 13,   'negate', '["frightened"]',                       NULL,                  FALSE),
( 6, NULL, 'Trattenuto',      'Velocità 0, svantaggio ai tiri per colpire e alle prove di DES.',
  'Until escaped',    NULL,            NULL,   NULL,       'STR', 13,   'negate', '["restrained"]',                       NULL,                  FALSE),
( 7, NULL, 'Paralizzato',     'Non può muoversi né parlare, fallisce automaticamente prove di FOR e DES.',
  '1 minute',         NULL,            NULL,   NULL,       'CON', 14,   'negate', '["paralyzed","incapacitated"]',         NULL,                  FALSE),
( 8, NULL, 'Rigenerazione',   'Il bersaglio riacquista PF all''inizio di ogni suo turno.',
  '1 minute',         'start of turn', '1d4',  'healing',  NULL,  NULL, 'none',   NULL,                                   NULL,                  TRUE),
( 9, NULL, 'Danno da Veleno', 'Subisce danni da veleno all''inizio di ogni suo turno.',
  '1 minute',         'start of turn', '1d6',  'poison',   'CON', 12,   'negate', NULL,                                   NULL,                  FALSE),
(10, NULL, 'Danno da Fuoco',  'In fiamme; subisce danni da fuoco all''inizio di ogni suo turno.',
  '1 minute',         'start of turn', '1d6',  'fire',     'DEX', 13,   'negate', NULL,                                   NULL,                  FALSE);

INSERT INTO `effects` (`id`, `campaign_id`, `name`, `description`, `duration`, `trigger_moment`, `damage`, `damage_type`, `save_type`, `save_dc`, `apply_on_save`, `conditions`, `stat_modifiers`, `is_concentration`) VALUES
(11, 1, 'Corrosione Acida',         'Acido corrosivo che mangia la carne; 1d4 danni acido all''inizio del turno.',
  '1 minute',         'start of turn', '1d4',  'acid',     'CON', 12,   'negate', NULL,                                   NULL,                  FALSE),
(12, 1, 'Maledizione dei Tre Regni','Maledizione ancestrale che penalizza ogni tiro salvezza del bersaglio.',
  'Until dispelled',  NULL,            NULL,   NULL,       NULL,  NULL, 'none',   NULL,                                   '{"save_bonus":-2}',   FALSE),
(13, 1, 'Benedizione di Speedwagon','La grande waifu sorride sul bersaglio: +1d4 ai tiri per colpire e ai tiri salvezza. Concentrazione.',
  '1 minute',         NULL,            NULL,   NULL,       NULL,  NULL, 'none',   NULL,                                   '{"attack_bonus":"1d4","save_bonus":"1d4"}', TRUE);

INSERT INTO `abilities` (`id`, `campaign_id`, `owner_char_id`, `owner_creature_id`, `name`, `description`, `action_type`, `damage`, `damage_type`, `hit_bonus`, `range`, `cooldown`, `uses_max`, `uses_current`) VALUES
( 1, 1, 1, NULL, 'Attacco con Spada Lunga',  'Fendente con la Spada Lunga +1.',                                                             'action',   '1d8+5',   'slashing',    7, '5 ft',       NULL,          NULL, NULL),
( 2, 1, 1, NULL, 'Secondo Respiro',           'Richiama forza interiore: recupera 1d10+2 PF come azione bonus.',                              'bonus',    '1d10+2',  'healing',  NULL, 'self',        'Short rest',  1,    1),
( 3, 1, 2, NULL, 'Attacco Disarmato',         'Colpo a mani nude potenziato dalla disciplina del monaco.',                                    'action',   '1d6+5',   'bludgeoning', 7, '5 ft',       NULL,          NULL, NULL),
( 4, 1, 2, NULL, 'Tempesta di Colpi',         'Spende 1 punto ki per sferrare due colpi aggiuntivi come azione bonus.',                       'bonus',    '1d4+5',   'bludgeoning', 7, '5 ft',       NULL,          NULL, NULL),
( 5, 1, 2, NULL, 'Deviare Proiettili',        'Come reazione riduce i danni di un attacco a distanza; se li azzera può rispedire il proiettile.', 'reaction', NULL,  NULL,       NULL, 'self',        NULL,          NULL, NULL),
( 6, 1, 3, NULL, 'Scure da Guerra',           'Attacco con la scure da guerra a una mano.',                                                   'action',   '1d8+4',   'slashing',    6, '5 ft',       NULL,          NULL, NULL),
( 7, 1, 3, NULL, 'Secondo Respiro',           'Richiama forza interiore: recupera 1d10+1 PF come azione bonus.',                              'bonus',    '1d10+1',  'healing',  NULL, 'self',        'Short rest',  1,    1),
( 8, 1, 4, NULL, 'Dardo Incantato',           'Tre dardi di forza che colpiscono automaticamente, 1d4+1 ciascuno.',                           'action',   '3x1d4+1', 'force',    NULL, '120 ft',      NULL,          NULL, NULL),
( 9, 1, 4, NULL, 'Palla di Fuoco',            'Sfera esplosiva, 20 ft di raggio, 8d6 danni da fuoco. TS DES CD 15 per dimezzare.',            'action',   '8d6',     'fire',     NULL, '150 ft',      NULL,          NULL, NULL),
(10, 1, 4, NULL, 'Individuare Magie',         'Rivela la presenza di magie entro 30 piedi per 10 minuti. Concentrazione.',                    'action',   NULL,      NULL,       NULL, '30 ft',       NULL,          NULL, NULL),
(11, 1, 5, NULL, 'Parola Sacra',              'Parola infusa di potere divino: 2d8+5 danni radiosi.',                                         'action',   '2d8+5',   'radiant',     7, '30 ft',       NULL,          NULL, NULL),
(12, 1, 5, NULL, 'Cura le Ferite',            'Tocco guaritore: il bersaglio recupera 1d8+3 PF.',                                             'action',   '1d8+3',   'healing',  NULL, 'touch',        NULL,          NULL, NULL),
(13, 1, 5, NULL, 'Benedizione',               'Benedice fino a 3 creature: +1d4 ai tiri per colpire e ai tiri salvezza. Concentrazione, 1 min.', 'action', NULL,     NULL,       NULL, '30 ft',       NULL,          NULL, NULL),
(14, 1, 6, NULL, 'Soffio Acido',              'Linea di 15 piedi di acido: 2d4 danni acido. TS DES CD 12 per dimezzare.',                     'action',   '2d4',     'acid',     NULL, '15 ft line',  NULL,          NULL, NULL),
(15, 1, 6, NULL, 'Dardo Incantato',           'Due dardi di forza che colpiscono automaticamente, 1d4+1 ciascuno.',                           'action',   '2x1d4+1', 'force',    NULL, '120 ft',      NULL,          NULL, NULL);

INSERT INTO `abilities` (`id`, `campaign_id`, `owner_char_id`, `owner_creature_id`, `name`, `description`, `action_type`, `damage`, `damage_type`, `hit_bonus`, `range`, `cooldown`, `uses_max`, `uses_current`) VALUES
(16, 1, NULL, 36, 'Pugno Marcescente',        'Colpo di un morto vivente: il fetore della morte avvelena chi viene colpito.',                  'action',   '1d6+1', 'bludgeoning', 3, '5 ft',       NULL,          NULL, NULL),
(17, 1, NULL, 37, 'Scimitarra',               'Colpo sibilante con la scimitarra arrugginita.',                                                'action',   '1d6+2', 'slashing',    4, '5 ft',       NULL,          NULL, NULL),
(18, 1, NULL, 37, 'Arco Corto',               'Scocca una freccia con il suo arco scheggiato.',                                               'action',   '1d6+2', 'piercing',    4, '80 ft',      NULL,          NULL, NULL),
(19, 1, NULL, 57, 'Colpo Demoniaco',          'Un attacco pesante che incute terrore nel bersaglio.',                                          'action',   '2d8+3', 'slashing',    5, '5 ft',       NULL,          NULL, NULL),
(20, 1, NULL, 57, 'Urlo del Caos',            'Urlo sovrannaturale che frantuma la mente: 3d6 danni psichici, TS SAG CD 14. 1/giorno.',        'action',   '3d6',   'psychic',  NULL, '30 ft cone', '1/day',       1,    1),
(21, 1, NULL, 64, 'Stiletto Maledetto',       'Pugnale intriso di magia nera; porta la Maledizione dei Tre Regni.',                           'action',   '1d4+2', 'piercing',    4, '5 ft',       NULL,          NULL, NULL),
(22, 1, NULL, 64, 'Invocazione del Caos',     'Frammenti di energia caotica: 2d6 danni necrotici, TS COS CD 14. 1/giorno.',                    'action',   '2d6',   'necrotic', NULL, '60 ft',      '1/day',       1,    1),
(23, 1, NULL, 70, 'Mausolata Lork',           'Colpo devastante con entrambe le mani armate.',                                                 'action',   '2d6+4', 'bludgeoning', 6, '5 ft',       NULL,          NULL, NULL),
(24, 1, NULL, 70, 'Carica Lork',              'Carica e tenta di spingere il nemico a terra (prono, TS FOR CD 14).',                           'bonus',    '1d4',   'bludgeoning', 6, '10 ft',      NULL,          NULL, NULL),
(25, 1, NULL, 71, 'Scimitarra Lork',          'Colpo fendente con la scimitarra corta del goblin.',                                            'action',   '1d6+2', 'slashing',    4, '5 ft',       NULL,          NULL, NULL),
(26, 1, NULL, 71, 'Arco Corto Lork',          'Freccia scoccata con velocità sorprendente.',                                                   'action',   '1d6+2', 'piercing',    4, '80 ft',      NULL,          NULL, NULL),
(27, 1, NULL, 71, 'Fuga Agile',               'Come azione bonus: disingaggio o nascondersi senza sprecare l''azione principale.',              'bonus',    NULL,    NULL,       NULL, 'self',        NULL,          NULL, NULL);

INSERT INTO `ability_effects` (`ability_id`, `effect_id`, `apply_order`, `notes`) VALUES
(16, 1,  1, 'On hit: TS CON CD 10 o avvelenato per 1 turno'),
(14, 11, 1, 'On failed save: corrosione acida per 1 minuto'),
(21, 12, 1, 'On hit: applica Maledizione dei Tre Regni'),
(20, 5,  1, 'On failed save: spaventato per 1 minuto'),
(13, 13, 1, 'On cast: benedizione activa per concentrazione');

INSERT INTO `items` (`campaign_id`, `owner_char_id`, `owner_creature_id`, `name`, `description`, `type`, `rarity`, `quantity`, `weight`, `value`, `properties`, `is_equipped`, `is_attuned`, `notes`) VALUES
(1, 1, NULL, 'Spada Lunga +1',             'Una spada lunga finemente bilanciata con un lieve incantesimo di potenziamento.',  'weapon',  'uncommon', 1,  1.5, '150 mo', '{"damage":"1d8","damage_type":"slashing","attack_bonus":1,"damage_bonus":1}',  TRUE,  TRUE,  NULL),
(1, 1, NULL, 'Cotta di Maglia',            'Cotta di maglia standard in acciaio trattato.',                                    'armor',   'common',   1, 20.0, '75 mo',  '{"ac":16}',                                                                  TRUE,  FALSE, NULL),
(1, 1, NULL, 'Ciondolo d''Argento',        'Ciondolo in argento con un dipinto in miniatura di sua moglie. Toto non se ne separa mai.',  'wondrous','common', 1, 0.1, NULL, '{"description":"Ritratto della moglie defunta"}',                            TRUE,  FALSE, 'Oggetto personale non vendibile'),
(1, 2, NULL, 'Guanti del Pugile',          'Guanti magici che amplificano la forza dei pugni a mani nude.',                    'wondrous','uncommon', 1,  0.5, '500 mo', '{"damage_bonus":1,"attunement":true}',                                       TRUE,  TRUE,  NULL),
(1, 2, NULL, 'Abito del Monaco',           'Veste monastica robusta ma leggera, favorisce i movimenti acrobatici.',            'gear',    'common',   1,  1.0, NULL,     NULL,                                                                         TRUE,  FALSE, NULL),
(1, 3, NULL, 'Scure da Guerra',            'Scure da guerra a una mano, lama in acciaio pesante.',                             'weapon',  'common',   1,  2.0, '15 mo',  '{"damage":"1d8","damage_type":"slashing"}',                                   TRUE,  FALSE, NULL),
(1, 3, NULL, 'Armatura a Scaglie',         'Armatura a piastre di metallo sovrapposto come scaglie.',                          'armor',   'common',   1, 22.5, '50 mo',  '{"ac":14}',                                                                  TRUE,  FALSE, NULL),
(1, 3, NULL, 'Braccio Protesico',          'Braccio meccanico in legno e ferro che rimpiazza il braccio perso a Kuzrykel.',    'gear',    'common',   1,  2.5, NULL,     '{"description":"Protesi artigianale, +2 forza di presa sinistra"}',          TRUE,  FALSE, 'Costruito da un artigiano locale'),
(1, 4, NULL, 'Libro degli Incantesimi',    'Tomo rilegato in pelle con incantesimi vergati in inchiostro magico.',             'gear',    'uncommon', 1,  1.5, NULL,     '{"spells":["magic_missile","fireball","detect_magic","mage_hand"]}',          TRUE,  TRUE,  NULL),
(1, 4, NULL, 'Bacchetta del Magio',        'Bacchetta in olivastro con un nucleo di pelo di unicorno. 7 cariche.',             'wondrous','rare',     1,  0.5, NULL,     '{"charges":7,"charges_max":7,"recharge":"1d6+1 at dawn"}',                   TRUE,  TRUE,  NULL),
(1, 4, NULL, 'Veste dell''Arciamago',      'Veste magica che aumenta la concentrazione degli incantesimi.',                    'wondrous','uncommon', 1,  0.8, '250 mo', '{"concentration_bonus":true}',                                               TRUE,  FALSE, NULL),
(1, 5, NULL, 'Simbolo Sacro di Speedwagon','Simbolo sacro a forma di cappello a cilindro, emblema della grande waifu.',        'gear',    'common',   1,  0.3, NULL,     '{"description":"Focus arcano / divino"}',                                    TRUE,  FALSE, NULL),
(1, 5, NULL, 'Scudo di Legno',             'Scudo circolare in legno rinforzato con bordi di ferro.',                          'shield',  'common',   1,  3.0, '10 mo',  '{"ac_bonus":2}',                                                             TRUE,  FALSE, NULL),
(1, 5, NULL, 'Abiti da Chierico Femboy',   'Veste clericale che sfida ogni convenzione di genere. Funzionale e stilosa.',      'gear',    'common',   1,  1.2, NULL,     NULL,                                                                         TRUE,  FALSE, NULL),
(1, 6, NULL, 'Amuleto di Resistenza all''Acido', 'Amuleto che conferisce resistenza ai danni acido al portatore.',            'wondrous','uncommon', 1,  0.2, '250 mo', '{"resistance":"acid"}',                                                      TRUE,  TRUE,  'Probabilmente eredità draconica'),
(1, 6, NULL, 'Veste del Sorcerer',         'Veste magica che incanalizza il potere dragonico del portatore.',                  'gear',    'common',   1,  1.0, NULL,     '{"charisma_bonus":1}',                                                       TRUE,  FALSE, NULL),
(1, NULL, NULL, 'Pozione di Guarigione',   'Liquido rosso brillante dall''aroma dolciastro. Recupera 2d4+2 PF.',               'potion',  'common',   3,  0.5, '50 mo',  '{"heal":"2d4+2"}',                                                          FALSE, FALSE, 'Scorta del party'),
(1, NULL, NULL, 'Pergamena di Dardo Incantato', 'Pergamena di primo livello con l''incantesimo Dardo Incantato.',             'scroll',  'common',   2,  0.1, '25 mo',  '{"spell":"magic_missile","level":1}',                                        FALSE, FALSE, 'Scorta del party'),
(1, NULL, NULL, 'Monete del Bottino',      'Monete d''oro, d''argento e rami accumulati nelle ultime avventure.',              'treasure','common',   1,  2.0, '420 mo', '{"gp":420,"sp":35,"cp":17}',                                                 FALSE, FALSE, 'Bottino da dividere');
*/
