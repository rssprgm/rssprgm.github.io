alter table public.join_submissions
  add column if not exists student_number text,
  add column if not exists personal_email text;

alter table public.join_submissions
  alter column grade drop not null,
  alter column email drop not null;

alter table public.join_submissions
  drop constraint if exists join_submissions_student_number_length,
  drop constraint if exists join_submissions_personal_email_length,
  drop constraint if exists join_submissions_student_number_format,
  drop constraint if exists join_submissions_personal_email_format,
  drop constraint if exists join_submissions_personal_email_not_bc_ca;

alter table public.join_submissions
  add constraint join_submissions_student_number_length
    check (student_number is null or char_length(student_number) between 1 and 20),
  add constraint join_submissions_personal_email_length
    check (personal_email is null or char_length(personal_email) between 3 and 254),
  add constraint join_submissions_student_number_format
    check (student_number is null or student_number ~ '^[0-9A-Za-z-]+$'),
  add constraint join_submissions_personal_email_format
    check (
      personal_email is null
      or personal_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  add constraint join_submissions_personal_email_not_bc_ca
    check (
      personal_email is null
      or lower(split_part(personal_email, '@', 2)) !~ '(^|\.)bc\.ca$'
    );

create index if not exists join_submissions_student_number_created_at_idx
  on public.join_submissions (student_number, created_at desc)
  where student_number is not null;

create index if not exists join_submissions_personal_email_created_at_idx
  on public.join_submissions (lower(personal_email), created_at desc)
  where personal_email is not null;
