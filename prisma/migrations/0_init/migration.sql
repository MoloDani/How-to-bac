Loaded Prisma config from "/Users/danielmolodet/Documents/Projects/How-to-bac/prisma.config.ts".
-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` BIGINT NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `lesson_id` BIGINT NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `block_type` ENUM('text', 'formula', 'image', 'audio', 'video', 'worked_example', 'interactive', 'scripture', 'question') NOT NULL,
    `payload` JSON NOT NULL,
    `audio_url` VARCHAR(500) NULL,
    `alt_text` VARCHAR(500) NULL,
    `source_ref` VARCHAR(300) NULL,

    INDEX `idx_lesson_order`(`lesson_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `user_id` BIGINT NOT NULL,
    `track_id` INTEGER NOT NULL,
    `started_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `target_date` DATE NULL,

    PRIMARY KEY (`user_id`, `track_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `friendships` (
    `user_low` BIGINT NOT NULL,
    `user_high` BIGINT NOT NULL,
    `requested_by` BIGINT NOT NULL,
    `status` ENUM('pending', 'accepted', 'blocked') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`user_low`, `user_high`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_options` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `item_id` BIGINT NOT NULL,
    `sort_order` TINYINT NOT NULL,
    `body` TEXT NOT NULL,
    `is_correct` BOOLEAN NOT NULL DEFAULT false,

    INDEX `item_id`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `lesson_id` BIGINT NOT NULL,
    `item_type` ENUM('mcq', 'numeric', 'short_text', 'order_steps') NOT NULL,
    `stem` TEXT NOT NULL,
    `answer_key` JSON NOT NULL,
    `explanation` TEXT NULL,
    `difficulty` TINYINT NOT NULL DEFAULT 3,
    `status` ENUM('draft', 'shadow', 'published', 'flagged', 'retired') NOT NULL DEFAULT 'draft',
    `source` ENUM('human', 'ai_draft', 'ai_variant') NOT NULL DEFAULT 'human',
    `verification` ENUM('human', 'cas', 'both') NULL,
    `verified_by` BIGINT NULL,
    `verified_at` TIMESTAMP(0) NULL,
    `n_responses` INTEGER NOT NULL DEFAULT 0,
    `p_value` DECIMAL(4, 3) NULL,
    `point_biserial` DECIMAL(4, 3) NULL,

    INDEX `idx_lesson`(`lesson_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_prerequisites` (
    `lesson_id` BIGINT NOT NULL,
    `requires_id` BIGINT NOT NULL,
    `note` VARCHAR(240) NULL,

    INDEX `requires_id`(`requires_id`),
    PRIMARY KEY (`lesson_id`, `requires_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lesson_progress` (
    `user_id` BIGINT NOT NULL,
    `lesson_id` BIGINT NOT NULL,
    `state` ENUM('locked', 'available', 'in_progress', 'completed', 'mastered') NOT NULL DEFAULT 'available',
    `completed_at` TIMESTAMP(0) NULL,
    `next_review_at` DATE NULL,
    `ease` DECIMAL(4, 2) NOT NULL DEFAULT 2.50,

    INDEX `idx_due`(`user_id`, `next_review_at`),
    PRIMARY KEY (`user_id`, `lesson_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lessons` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `module_id` BIGINT NOT NULL,
    `slug` VARCHAR(96) NOT NULL,
    `display_name` VARCHAR(240) NOT NULL,
    `summary` VARCHAR(500) NULL,
    `est_minutes` TINYINT NOT NULL DEFAULT 10,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `programa_ref` VARCHAR(160) NULL,
    `status` ENUM('draft', 'in_review', 'published', 'retired') NOT NULL DEFAULT 'draft',
    `source` ENUM('human', 'ai_draft', 'ai_variant') NOT NULL DEFAULT 'human',
    `verified_by` BIGINT NULL,
    `verified_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_status`(`status`),
    UNIQUE INDEX `uq_lesson`(`module_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `track_id` INTEGER NOT NULL,
    `slug` VARCHAR(96) NOT NULL,
    `display_name` VARCHAR(200) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `uq_module`(`track_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `responses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `item_id` BIGINT NOT NULL,
    `given` JSON NOT NULL,
    `is_correct` BOOLEAN NOT NULL,
    `ms_taken` INTEGER NULL,
    `local_date` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_item`(`item_id`),
    INDEX `idx_user_date`(`user_id`, `local_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scripture_editions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `display_name` VARCHAR(160) NOT NULL,
    `canon` ENUM('protestant', 'orthodox', 'catholic') NOT NULL,
    `license` VARCHAR(240) NOT NULL,

    UNIQUE INDEX `code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scripture_verses` (
    `edition_id` INTEGER NOT NULL,
    `book` VARCHAR(16) NOT NULL,
    `chapter` SMALLINT NOT NULL,
    `verse` SMALLINT NOT NULL,
    `body` TEXT NOT NULL,

    PRIMARY KEY (`edition_id`, `book`, `chapter`, `verse`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensitive_consents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `purpose` VARCHAR(64) NOT NULL,
    `granted_at` TIMESTAMP(0) NOT NULL,
    `revoked_at` TIMESTAMP(0) NULL,
    `policy_version` VARCHAR(16) NOT NULL,

    INDEX `idx_user`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tracks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(64) NOT NULL,
    `kind` ENUM('exam_subject', 'devotional') NOT NULL,
    `display_name` VARCHAR(160) NOT NULL,
    `subject_id` INTEGER NULL,
    `is_sensitive` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `slug`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_streaks` (
    `user_id` BIGINT NOT NULL,
    `current_len` INTEGER NOT NULL DEFAULT 0,
    `longest_len` INTEGER NOT NULL DEFAULT 0,
    `last_active_date` DATE NOT NULL,
    `freezes_available` TINYINT NOT NULL DEFAULT 0,
    `weekly_goal_days` TINYINT NOT NULL DEFAULT 5,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NULL,
    `handle` VARCHAR(32) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `display_name` VARCHAR(96) NULL,
    `birth_year` SMALLINT NULL,
    `parental_consent_at` TIMESTAMP(0) NULL,
    `specialization_id` INTEGER NULL,
    `grade_level` TINYINT NULL,
    `bac_year` SMALLINT NULL,
    `timezone` VARCHAR(48) NOT NULL DEFAULT 'Europe/Bucharest',
    `referral_code` VARCHAR(12) NULL,
    `referred_by` BIGINT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    UNIQUE INDEX `handle`(`handle`),
    UNIQUE INDEX `referral_code`(`referral_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `xp_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `amount` INTEGER NOT NULL,
    `reason` ENUM('lesson_complete', 'review_on_time', 'duel_win', 'bonus') NOT NULL,
    `lesson_id` BIGINT NULL,
    `local_date` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_user_date`(`user_id`, `local_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `item_options` ADD CONSTRAINT `item_options_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_prerequisites` ADD CONSTRAINT `lesson_prerequisites_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lesson_prerequisites` ADD CONSTRAINT `lesson_prerequisites_ibfk_2` FOREIGN KEY (`requires_id`) REFERENCES `lessons`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `modules` ADD CONSTRAINT `modules_ibfk_1` FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `scripture_verses` ADD CONSTRAINT `scripture_verses_ibfk_1` FOREIGN KEY (`edition_id`) REFERENCES `scripture_editions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sensitive_consents` ADD CONSTRAINT `sensitive_consents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

