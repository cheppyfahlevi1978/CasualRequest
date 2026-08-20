-- ===========================================================================
-- CASUAL REQUEST — 01. Extensions, schemas and enum types
-- PRD §69 step 1-2
-- ===========================================================================

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext" with schema extensions;

-- Private schema for helper functions that must never be exposed via Data API.
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('user_status',        array['pending','active','inactive','suspended']),
      ('hotel_status',       array['active','inactive']),
      ('gender_type',        array['male','female']),
      ('request_type',       array['operational','event']),
      ('request_status',     array['draft','submitted','hod_approval','hr_review',
                                   'finance_verification','gm_approval','approved','assigned',
                                   'in_progress','completed','closed','rejected','cancelled','returned']),
      ('approval_step',      array['hod','hr','finance','gm']),
      ('approval_decision',  array['pending','approved','rejected','returned','skipped']),
      ('assignment_status',  array['assigned','confirmed','present','absent','completed','cancelled']),
      ('attendance_status',  array['scheduled','present','late','absent','no_show','sick','permission']),
      ('payment_status',     array['pending','verified','approved','paid']),
      ('casual_status',      array['active','inactive','blacklisted']),
      ('talent_class',       array['new','available','recommended','on_review','do_not_assign']),
      ('rate_type',          array['daily','hourly']),
      ('document_type',      array['ktp','cv','certificate','agreement','warning_letter',
                                   'photo','attendance_evidence','request_attachment','other']),
      ('location_check',     array['not_required','valid','invalid','unavailable'])
    ) as v(name, labels)
  loop
    if not exists (select 1 from pg_type where typname = t.name and typnamespace = 'public'::regnamespace) then
      execute format('create type public.%I as enum (%s)',
        t.name,
        (select string_agg(quote_literal(l), ',') from unnest(t.labels) as l));
    end if;
  end loop;
end $$;
