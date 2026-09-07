create table if not exists public.mp_sales (
  external_reference text primary key,
  local_sale_id text,
  amount numeric not null default 0,
  status text not null default 'pending',
  payment_id text,
  preference_id text,
  order_id text,
  payment_method_type text,
  items jsonb not null default '[]'::jsonb,
  business_date text,
  shift_type text,
  approved_at timestamptz,
  raw_payment jsonb,
  raw_order jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mp_sales add column if not exists order_id text;
alter table public.mp_sales add column if not exists payment_method_type text;
alter table public.mp_sales add column if not exists raw_order jsonb;

alter table public.mp_sales enable row level security;

drop policy if exists "mp_sales_read_anon" on public.mp_sales;
create policy "mp_sales_read_anon"
on public.mp_sales for select
to anon
using (true);
