CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table users(
    user_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    username text UNIQUE NOT NULL,
    -- Deliberately NOT unique. Mongo never enforced this, and the 2026-07-25
    -- export has 5,213 email addresses shared by two or more accounts (5,716
    -- accounts in total). A UNIQUE constraint here does not clean that up, it
    -- just makes the import fail for the second account onwards and silently
    -- drops those users. Uniqueness is already enforced in code where it can
    -- be applied safely -- registration and change-of-email both reject a
    -- conflict (server/endpoints.js) -- and nothing reads email expecting a
    -- single row: signin matches on username, and forgot-username already
    -- takes users[0].
    email text NOT NULL,
    token text NOT NULL,
    password text NOT NULL,
    library JSON NOT NULL,
    sync_token integer NOT NULL DEFAULT 0,
    registered timestamp NOT NULL,
    last_seen timestamp NOT NULL,
    reset_token_hash text,
    reset_token_expires timestamp
);

create table list(
    list_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    external_id text UNIQUE NOT NULL,
    user_id UUID NOT NULL references users(user_id)
);

-- Session cookies are looked up by token on every authenticated request
-- (server/auth.js). Without this it is a sequential scan of the whole users
-- table per request. username/user_id/external_id are already indexed by
-- their UNIQUE constraints.
create index users_token_idx on users(token);

-- Email lost its UNIQUE constraint above, and with it the implicit index that
-- registration and change-of-email lean on for their conflict checks.
create index users_email_idx on users(email);

-- Forgot-username matches case-insensitively (whereRaw lower(email) = ?), and
-- a plain index on email cannot serve that.
create index users_email_lower_idx on users(lower(email));

-- Postgres does not index the referencing side of a foreign key. Account
-- deletion deletes a user's lists by user_id.
create index list_user_id_idx on list(user_id);

grant all privileges on schema public to lp;
grant all privileges on all tables in schema public to lp;
grant all privileges on all sequences in schema public to lp;