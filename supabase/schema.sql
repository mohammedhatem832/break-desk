-- BreakDesk uses its own lightweight login, so these tables are accessed with
-- the Supabase publishable key and must not contain service-role credentials.
create table if not exists public.employees (
  id text primary key,
  name text not null,
  password_hash text not null,
  role text not null default 'employee' check (role in ('employee', 'supervisor', 'admin')),
  created_at bigint not null
);

create table if not exists public.break_requests (
  id text primary key,
  employee_id text not null,
  employee_name text not null,
  requested_minutes integer not null,
  request_time bigint not null,
  status text not null check (status in ('waiting', 'approved', 'rejected', 'completed')),
  approved_by text,
  approval_time bigint,
  break_start_time bigint,
  break_end_time bigint,
  actual_duration integer,
  overtime_duration integer,
  acknowledged boolean not null default false
);

alter table public.employees enable row level security;
alter table public.break_requests enable row level security;

drop policy if exists "BreakDesk employees are readable" on public.employees;
create policy "BreakDesk employees are readable"
  on public.employees for select to anon, authenticated using (true);

drop policy if exists "BreakDesk employees are writable" on public.employees;
create policy "BreakDesk employees are writable"
  on public.employees for all to anon, authenticated using (true) with check (true);

drop policy if exists "BreakDesk requests are readable" on public.break_requests;
create policy "BreakDesk requests are readable"
  on public.break_requests for select to anon, authenticated using (true);

drop policy if exists "BreakDesk requests are writable" on public.break_requests;
create policy "BreakDesk requests are writable"
  on public.break_requests for all to anon, authenticated using (true) with check (true);
