UPDATE users
SET email = 'admin@petrodata.net',
    password_hash = crypt('ChangeMe123!', gen_salt('bf'))
WHERE email = 'system.admin@petrodata.net';
