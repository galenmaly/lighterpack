create table bucket(
    hour_of_day integer,
    day_of_week integer,
    bucket_date date,
    bucket_month date,
    page_name text,
    impressions integer,
    unique_visitors integer,
    unique_registered_users integer,
    unique_list_views integer,
    p50 decimal,
    p90 decimal,
    p95 decimal,
    p99 decimal,
    status_200 decimal,
    status_400 decimal,
    status_500 decimal,
    status_other decimal
);

grant all privileges on schema public to logs;
grant all privileges on all tables in schema public to logs;
grant all privileges on all sequences in schema public to logs;