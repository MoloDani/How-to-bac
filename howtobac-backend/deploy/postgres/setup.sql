-- Creates the How to Bac login role and its databases on an existing Postgres.
-- Plain SQL: paste it into Adminer's "SQL command" page (or run it with psql).
--
-- 1. Log in as the Postgres superuser (any database, e.g. `postgres`).
-- 2. Replace CHANGE_ME with a long random password, using only letters and
--    digits (other characters need escaping in DATABASE_URL). Do it in the SQL
--    box, not in this file, so the password never gets committed.
-- 3. Run it once. If some of these already exist, remove those lines first.
--
-- howtobac         the app's data
-- howtobac_test    wiped on every `pnpm test:e2e` run
-- howtobac_shadow  scratch space Prisma needs when creating new migrations
-- Separate databases (not extra schemas) so a test reset can never reach app
-- data. Prisma creates the `howtobac` schema inside each one on first use.

-- Login role for the app: not a superuser, can't create databases or roles.
CREATE ROLE howtobac LOGIN PASSWORD 'CHANGE_ME';

CREATE DATABASE howtobac OWNER howtobac;
CREATE DATABASE howtobac_test OWNER howtobac;
CREATE DATABASE howtobac_shadow OWNER howtobac;

-- Only howtobac (and superusers) can connect to them.
REVOKE ALL ON DATABASE howtobac, howtobac_test, howtobac_shadow FROM PUBLIC;

-- The app's tables live in schema `howtobac` in each of these databases.
ALTER ROLE howtobac SET search_path = howtobac;
