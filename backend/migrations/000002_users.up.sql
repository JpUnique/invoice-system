CREATE TYPE user_role AS ENUM ('admin', 'gm', 'preparer');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'preparer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bootstrap admin account. Change this password on first login.
-- pgcrypto's crypt()/gen_salt('bf') produces standard bcrypt hashes,
-- verifiable in Go with golang.org/x/crypto/bcrypt.
INSERT INTO users (name, email, password_hash, role)
VALUES (
    'Administrator',
    'admin@petrodata.net',
    crypt('ChangeMe123!', gen_salt('bf')),
    'admin'
);
