-- Friend codes become user tags: one unique, public handle per account.
--
-- Existing rows need a tag before the column can be required, so: add it as
-- nullable, derive one from each display name, then make it NOT NULL. The
-- derivation mirrors suggestTag() in src/users/user-tag.ts.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tag" VARCHAR(32);

WITH slugs AS (
    SELECT
        u."id",
        -- Fold diacritics, turn everything else into "_", trim the ends, and
        -- leave room (28 of 32 characters) for a de-duplicating suffix.
        regexp_replace(
            left(
                regexp_replace(
                    regexp_replace(
                        translate(
                            lower(u."user_name"),
                            'ăâîșşțţàáäèéëìíïòóöùúü',
                            'aaissttaaaeeeiiiooouuu'
                        ),
                        '[^a-z0-9]+', '_', 'g'
                    ),
                    '^_|_$', '', 'g'
                ),
                28
            ),
            '_$', ''
        ) AS base
    FROM "users" u
),
sized AS (
    SELECT
        "id",
        CASE
            WHEN length(base) >= 3 THEN base
            WHEN length(base) = 0 THEN 'user'
            ELSE rpad(base, 3, '0')
        END AS base
    FROM slugs
),
guarded AS (
    -- Nobody inherits a name that would let them pass for the site itself.
    SELECT
        "id",
        CASE
            WHEN base IN ('admin', 'administrator', 'root', 'system', 'support',
                          'help', 'staff', 'moderator', 'mod', 'official',
                          'howtobac', 'bac', 'me')
            THEN base || '_1'
            ELSE base
        END AS base
    FROM sized
),
numbered AS (
    SELECT "id", base, row_number() OVER (PARTITION BY base ORDER BY "id") AS rn
    FROM guarded
)
UPDATE "users" u
SET "tag" = n.base || CASE WHEN n.rn = 1 THEN '' ELSE n.rn::text END
FROM numbered n
WHERE n."id" = u."id";

-- Two different bases can still meet ("ana" numbered 2 vs. someone already
-- called "ana2"), so settle the leftovers before the unique index goes on.
DO $$
DECLARE
    duplicate_id UUID;
BEGIN
    LOOP
        SELECT d."id" INTO duplicate_id
        FROM (
            SELECT "id", row_number() OVER (PARTITION BY "tag" ORDER BY "id") AS rn
            FROM "users"
        ) d
        WHERE d.rn > 1
        LIMIT 1;

        EXIT WHEN duplicate_id IS NULL;

        UPDATE "users"
        SET "tag" = left("tag", 27) || floor(random() * 10000)::int::text
        WHERE "id" = duplicate_id;

        duplicate_id := NULL;
    END LOOP;
END $$;

ALTER TABLE "users" ALTER COLUMN "tag" SET NOT NULL;

-- DropColumn (its unique index goes with it)
ALTER TABLE "users" DROP COLUMN "friend_code";

-- CreateIndex
CREATE UNIQUE INDEX "users_tag_key" ON "users"("tag");
