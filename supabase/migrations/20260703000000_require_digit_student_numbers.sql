alter table public.join_submissions
  drop constraint if exists join_submissions_student_number_format;

alter table public.join_submissions
  add constraint join_submissions_student_number_format
    check (student_number is null or student_number ~ '^[0-9]+$');
