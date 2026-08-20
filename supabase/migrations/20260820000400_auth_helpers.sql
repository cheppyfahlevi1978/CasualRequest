-- ===========================================================================
-- CASUAL REQUEST — 04. Authorization helper functions
-- PRD §63, §65. Every helper is SECURITY DEFINER so it can read RBAC tables
-- without recursing into the very policies that call it.
-- ===========================================================================

-- Is the caller a signed-in user whose profile is active and not soft-deleted?
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and r.code = 'super_admin'
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

-- Hotels the caller may see at all. Super admin sees every active hotel.
create or replace function public.accessible_hotel_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select h.id
  from public.hotels h
  where h.deleted_at is null
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.user_hotels uh
        where uh.hotel_id = h.id and uh.user_id = auth.uid()
      )
    );
$$;

create or replace function public.has_hotel_access(p_hotel uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_hotel is not null
     and public.is_active_user()
     and (
       public.is_super_admin()
       or exists (
         select 1 from public.user_hotels uh
         where uh.user_id = auth.uid() and uh.hotel_id = p_hotel
       )
     );
$$;

-- Permission check. A role granted with hotel_id IS NULL applies globally.
create or replace function public.has_permission(p_code text, p_hotel uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
     and (
       public.is_super_admin()
       or exists (
         select 1
         from public.user_roles ur
         join public.role_permissions rp on rp.role_id = ur.role_id
         join public.permissions perm on perm.id = rp.permission_id
         where ur.user_id = auth.uid()
           and perm.code = p_code
           and (
             ur.hotel_id is null
             or p_hotel is null
             or ur.hotel_id = p_hotel
           )
           and (p_hotel is null or public.has_hotel_access(p_hotel))
       )
     );
$$;

create or replace function public.has_role(p_role text, p_hotel uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
     and exists (
       select 1
       from public.user_roles ur
       join public.roles r on r.id = ur.role_id
       where ur.user_id = auth.uid()
         and r.code = p_role
         and (ur.hotel_id is null or p_hotel is null or ur.hotel_id = p_hotel)
     );
$$;

create or replace function public.current_role_codes(p_hotel uuid default null)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct r.code order by r.code), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
    and (ur.hotel_id is null or p_hotel is null or ur.hotel_id = p_hotel);
$$;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.department_id from public.profiles p where p.id = auth.uid();
$$;

-- Row is visible when the user may read every request in the hotel, or when the
-- row belongs to their own department, or when they raised it themselves.
create or replace function public.can_read_department_scope(p_hotel uuid, p_department uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('request.read_all', p_hotel)
      or (
        public.has_hotel_access(p_hotel)
        and p_department is not null
        and p_department = public.current_department_id()
      );
$$;

-- The casual worker portal: a casual row linked to the caller's auth user.
create or replace function public.current_casual_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.casual_workers c
  where c.auth_user_id = auth.uid() and c.deleted_at is null
  limit 1;
$$;

-- Do the caller and the given user share at least one hotel? Used by the
-- profiles read policy so approvers can see requester names without being
-- granted the full user-directory permission.
create or replace function public.shares_hotel_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
     and exists (
       select 1
       from public.user_hotels mine
       join public.user_hotels theirs on theirs.hotel_id = mine.hotel_id
       where mine.user_id = auth.uid()
         and theirs.user_id = p_user
     );
$$;

grant execute on function
  public.is_active_user(),
  public.is_super_admin(),
  public.accessible_hotel_ids(),
  public.has_hotel_access(uuid),
  public.has_permission(text, uuid),
  public.has_role(text, uuid),
  public.current_role_codes(uuid),
  public.current_department_id(),
  public.can_read_department_scope(uuid, uuid),
  public.current_casual_id(),
  public.shares_hotel_with(uuid)
to authenticated;
