-- Daily Money Tracker schema
-- NOTE: This script recreates tables for a clean setup.

create extension if not exists "pgcrypto";

drop table if exists public.alerts cascade;
drop table if exists public.staff_invites cascade;
drop table if exists public.saving_goals cascade;
drop table if exists public.transactions cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null default 'expense' check (type in ('income', 'expense', 'both')),
  color text not null default '#64748b',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid not null references public.categories(id) on delete restrict,
  added_by text check (added_by in ('YASSAR', 'ALEX')),
  payment_method text not null check (payment_method in ('cash', 'card', 'bank', 'online', 'other')),
  note text not null default '',
  transaction_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saving_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_amount numeric(12, 2) not null check (target_amount >= 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  alert_at_amount numeric(12, 2) check (alert_at_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  saving_goal_id uuid not null references public.saving_goals(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('owner', 'manager', 'staff')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'owner'
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'manager')
$$;

create or replace function public.can_add_transactions()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'manager', 'staff')
$$;

create or replace function public.dashboard_totals()
returns table (
  today_income numeric(12,2),
  today_expenses numeric(12,2),
  today_balance numeric(12,2),
  month_income numeric(12,2),
  month_expenses numeric(12,2),
  month_balance numeric(12,2)
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_add_transactions() then
    raise exception 'Not authorized to view dashboard totals';
  end if;

  if public.current_user_role() = 'staff' then
    return query
    with today_range as (
      select date_trunc('day', now()) as start_at, now() as end_at
    )
    select
      coalesce(sum(case when t.type = 'income' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)::numeric(12,2) as today_income,
      coalesce(sum(case when t.type = 'expense' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)::numeric(12,2) as today_expenses,
      (
        coalesce(sum(case when t.type = 'income' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)
        -
        coalesce(sum(case when t.type = 'expense' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)
      )::numeric(12,2) as today_balance,
      0::numeric(12,2) as month_income,
      0::numeric(12,2) as month_expenses,
      0::numeric(12,2) as month_balance
    from public.transactions t
    cross join today_range tr;
    return;
  end if;

  return query
  with today_range as (
    select date_trunc('day', now()) as start_at, now() as end_at
  ),
  month_range as (
    select date_trunc('month', now()) as start_at, now() as end_at
  )
  select
    coalesce(sum(case when t.type = 'income' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)::numeric(12,2) as today_income,
    coalesce(sum(case when t.type = 'expense' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)::numeric(12,2) as today_expenses,
    (
      coalesce(sum(case when t.type = 'income' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)
      -
      coalesce(sum(case when t.type = 'expense' and t.transaction_at between tr.start_at and tr.end_at then t.amount else 0 end), 0)
    )::numeric(12,2) as today_balance,
    coalesce(sum(case when t.type = 'income' and t.transaction_at between mr.start_at and mr.end_at then t.amount else 0 end), 0)::numeric(12,2) as month_income,
    coalesce(sum(case when t.type = 'expense' and t.transaction_at between mr.start_at and mr.end_at then t.amount else 0 end), 0)::numeric(12,2) as month_expenses,
    (
      coalesce(sum(case when t.type = 'income' and t.transaction_at between mr.start_at and mr.end_at then t.amount else 0 end), 0)
      -
      coalesce(sum(case when t.type = 'expense' and t.transaction_at between mr.start_at and mr.end_at then t.amount else 0 end), 0)
    )::numeric(12,2) as month_balance
  from public.transactions t
  cross join today_range tr
  cross join month_range mr;
end;
$$;

grant execute on function public.dashboard_totals() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.saving_goals enable row level security;
alter table public.alerts enable row level security;
alter table public.staff_invites enable row level security;

-- Profiles
create policy "profiles_select_owner_manager_all"
on public.profiles
for select
to authenticated
using (public.is_manager_or_owner());

create policy "profiles_select_staff_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_self_first_time"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() and role = 'staff');

create policy "profiles_insert_by_owner_manager"
on public.profiles
for insert
to authenticated
with check (public.is_manager_or_owner());

create policy "profiles_update_by_owner_manager"
on public.profiles
for update
to authenticated
using (
  public.is_owner()
  or (
    public.current_user_role() = 'manager'
    and role <> 'owner'
  )
)
with check (
  case
    when public.is_owner() then true
    else role in ('manager', 'staff')
  end
);

create policy "profiles_update_staff_self_name"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = 'staff');

create policy "profiles_delete_owner_only"
on public.profiles
for delete
to authenticated
using (public.is_owner());

-- Staff invites (owner only)
create policy "staff_invites_owner_select"
on public.staff_invites
for select
to authenticated
using (public.is_owner());

create policy "staff_invites_owner_insert"
on public.staff_invites
for insert
to authenticated
with check (public.is_owner());

create policy "staff_invites_owner_update"
on public.staff_invites
for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

create policy "staff_invites_owner_delete"
on public.staff_invites
for delete
to authenticated
using (public.is_owner());

-- Categories
create policy "categories_select_all_active_users"
on public.categories
for select
to authenticated
using (public.can_add_transactions());

create policy "categories_manage_owner_manager"
on public.categories
for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

-- Transactions
create policy "transactions_insert_staff_manager_owner"
on public.transactions
for insert
to authenticated
with check (public.can_add_transactions() and created_by = auth.uid());

create policy "transactions_select_owner_manager_only"
on public.transactions
for select
to authenticated
using (public.is_manager_or_owner());

create policy "transactions_update_owner_manager_only"
on public.transactions
for update
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

create policy "transactions_delete_owner_manager_only"
on public.transactions
for delete
to authenticated
using (public.is_manager_or_owner());

-- Saving goals (owner/manager only)
create policy "saving_goals_manage_owner_manager"
on public.saving_goals
for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

-- Alerts (owner/manager only)
create policy "alerts_manage_owner_manager"
on public.alerts
for all
to authenticated
using (public.is_manager_or_owner())
with check (public.is_manager_or_owner());

insert into public.categories (name, type, color, is_default)
values
  ('House Rent', 'income', '#64748b', true),
  ('Salary', 'income', '#64748b', true),
  ('Shop', 'income', '#64748b', true),
  ('Extra', 'income', '#64748b', true),
  ('Beverage', 'expense', '#64748b', true),
  ('Shop Rent', 'expense', '#64748b', true),
  ('Home Rent', 'expense', '#64748b', true),
  ('Talabat', 'expense', '#64748b', true),
  ('Taxi', 'expense', '#64748b', true),
  ('Salik', 'expense', '#64748b', true),
  ('Shop Supply', 'expense', '#64748b', true),
  ('School', 'expense', '#64748b', true),
  ('Alex', 'expense', '#64748b', true),
  ('Yassar', 'expense', '#64748b', true),
  ('Barber', 'expense', '#64748b', true),
  ('VAT', 'expense', '#64748b', true),
  ('Cloth', 'expense', '#64748b', true),
  ('Kids Gifts', 'expense', '#64748b', true),
  ('DEWA', 'expense', '#64748b', true),
  ('DU', 'expense', '#64748b', true),
  ('Etisalat Shop', 'expense', '#64748b', true),
  ('Etisalat Yassar', 'expense', '#64748b', true),
  ('Internet Home', 'expense', '#64748b', true),
  ('EMPOWER', 'expense', '#64748b', true),
  ('Overtime', 'expense', '#64748b', true),
  ('Gov Fees', 'expense', '#64748b', true),
  ('Food', 'expense', '#64748b', true),
  ('Going Out', 'expense', '#64748b', true),
  ('Doctor', 'expense', '#64748b', true),
  ('Fuel Alex', 'expense', '#64748b', true),
  ('Fuel Yassar', 'expense', '#64748b', true),
  ('Car Repair', 'expense', '#64748b', true),
  ('Car Loan', 'expense', '#64748b', true),
  ('TSB Loan', 'expense', '#64748b', true)
on conflict (name) do nothing;
