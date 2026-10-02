-- Run after schema.sql. Only the server may write billing state.
create table if not exists public.billing_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id text not null,
  store_id text not null,
  variant_id text not null,
  status text not null,
  access_until timestamptz,
  test_mode boolean not null,
  provider_updated_at timestamptz not null,
  revoked boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists billing_subscriptions_user_idx on public.billing_subscriptions(user_id, test_mode);
alter table public.billing_subscriptions enable row level security;
revoke all on public.billing_subscriptions from anon;
revoke all on public.billing_subscriptions from authenticated;
grant select on public.billing_subscriptions to authenticated;
grant all on public.billing_subscriptions to service_role;
create policy "read own subscriptions" on public.billing_subscriptions for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.apply_billing_subscription(event_key text, snapshot jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Retried deliveries and entitlement updates commit in the same transaction.
  insert into public.webhook_events(provider,event_name,event_id,payload)
  values ('lemonsqueezy','subscription_sync',event_key,snapshot)
  on conflict (event_id) do nothing;
  if not found then return; end if;
  if exists (select 1 from public.billing_subscriptions where subscription_id=snapshot->>'subscription_id' and user_id<>(snapshot->>'user_id')::uuid) then
    raise exception 'Subscription account mismatch';
  end if;
  insert into public.billing_subscriptions(subscription_id,user_id,customer_id,store_id,variant_id,status,access_until,test_mode,provider_updated_at,revoked)
  values(snapshot->>'subscription_id',(snapshot->>'user_id')::uuid,snapshot->>'customer_id',snapshot->>'store_id',snapshot->>'variant_id',snapshot->>'status',(snapshot->>'access_until')::timestamptz,(snapshot->>'test_mode')::boolean,(snapshot->>'provider_updated_at')::timestamptz,(snapshot->>'revoked')::boolean)
  on conflict(subscription_id) do update set
    status=excluded.status,access_until=excluded.access_until,
    provider_updated_at=excluded.provider_updated_at,
    revoked=excluded.revoked,updated_at=now()
  where excluded.provider_updated_at>=public.billing_subscriptions.provider_updated_at;
end;
$$;
revoke all on function public.apply_billing_subscription(text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_billing_subscription(text,jsonb) to service_role;
