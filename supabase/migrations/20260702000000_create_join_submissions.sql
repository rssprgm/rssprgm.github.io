create extension if not exists pgcrypto;

create table if not exists public.join_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  grade text not null,
  email text not null,
  interest text,
  source text,
  user_agent text,
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'rejected')),
  constraint join_submissions_name_length check (char_length(name) between 1 and 80),
  constraint join_submissions_grade_length check (char_length(grade) between 1 and 20),
  constraint join_submissions_email_length check (char_length(email) between 3 and 254),
  constraint join_submissions_interest_length check (interest is null or char_length(interest) <= 500),
  constraint join_submissions_source_length check (source is null or char_length(source) <= 80)
);

alter table public.join_submissions enable row level security;

revoke all on table public.join_submissions from anon, authenticated;
grant select, insert, update on table public.join_submissions to service_role;

create index if not exists join_submissions_created_at_idx
  on public.join_submissions (created_at desc);

create index if not exists join_submissions_email_created_at_idx
  on public.join_submissions (lower(email), created_at desc);

create index if not exists join_submissions_ip_hash_created_at_idx
  on public.join_submissions (ip_hash, created_at desc)
  where ip_hash is not null;
