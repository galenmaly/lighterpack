CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table users(
    user_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    username text UNIQUE NOT NULL,
    email text UNIQUE NOT NULL,
    token text NOT NULL,
    password text NOT NULL,
    library JSON NOT NULL,
    sync_token integer NOT NULL DEFAULT 0,
    registered timestamp NOT NULL,
    last_seen timestamp NOT NULL
);

create table list(
    list_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    external_id text UNIQUE NOT NULL,
    user_id UUID NOT NULL references users(user_id)
);

grant all privileges on schema public to lp;
grant all privileges on all tables in schema public to lp;
grant all privileges on all sequences in schema public to lp;