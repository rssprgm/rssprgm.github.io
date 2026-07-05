alter table public.join_submissions
  drop constraint if exists join_submissions_student_number_required,
  drop constraint if exists join_submissions_grade_allowed,
  drop constraint if exists join_submissions_student_number_format;

alter table public.join_submissions
  add constraint join_submissions_student_number_required
    check (student_number is not null) not valid,
  add constraint join_submissions_student_number_format
    check (student_number ~ '^[0-9]+$') not valid,
  add constraint join_submissions_grade_allowed
    check (grade is not null and grade in ('8', '9', '10', '11', '12', 'Other')) not valid;

drop function if exists public.create_join_submission(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer,
  integer
);

create or replace function public.create_join_submission(
  p_name text,
  p_student_number text,
  p_grade text,
  p_personal_email text,
  p_interest text,
  p_source text,
  p_user_agent text,
  p_ip_hash text,
  p_rate_window_start timestamptz,
  p_recent_ip_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_count integer;
begin
  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended('join-ip:' || p_ip_hash, 0));
  end if;

  if p_ip_hash is not null then
    select count(*)
      into v_ip_count
      from public.join_submissions
      where ip_hash = p_ip_hash
        and created_at >= p_rate_window_start;

    if v_ip_count >= p_recent_ip_limit then
      return jsonb_build_object('ok', false, 'code', 'ip_rate_limited');
    end if;
  end if;

  insert into public.join_submissions (
    name,
    student_number,
    grade,
    personal_email,
    interest,
    source,
    user_agent,
    ip_hash
  )
  values (
    p_name,
    p_student_number,
    p_grade,
    p_personal_email,
    p_interest,
    p_source,
    p_user_agent,
    p_ip_hash
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.create_join_submission(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer
) from public, anon, authenticated;

grant execute on function public.create_join_submission(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  integer
) to service_role;
