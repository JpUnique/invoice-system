-- Base schema: extension setup only. Real tables (users, clients, invoices,
-- transmittals, ...) are added in later migrations once each module is built.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
