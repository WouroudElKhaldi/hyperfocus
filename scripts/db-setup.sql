-- Creates Hyperfocus's database user and databases on the PostgreSQL installed on this computer (P4-01, no Docker).
-- Safe to run again: anything that already exists is left alone. Run it with `pnpm db:setup`.
SELECT 'CREATE ROLE hyperfocus LOGIN PASSWORD ''hyperfocus-local'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hyperfocus')\gexec
SELECT 'CREATE DATABASE hyperfocus OWNER hyperfocus'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hyperfocus')\gexec
-- the tests' own database, so they never touch your data
SELECT 'CREATE DATABASE hyperfocus_test OWNER hyperfocus'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hyperfocus_test')\gexec
