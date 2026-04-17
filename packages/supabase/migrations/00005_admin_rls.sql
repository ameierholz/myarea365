-- Staff/Admin-Lesezugriff auf bestehende Tabellen

drop policy if exists users_staff_select on public.users;
create policy users_staff_select on public.users
  for select using (public.is_staff());

drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists groups_staff_select on public.groups;
create policy groups_staff_select on public.groups
  for select using (public.is_staff());

drop policy if exists groups_admin_write on public.groups;
create policy groups_admin_write on public.groups
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists groups_admin_delete on public.groups;
create policy groups_admin_delete on public.groups
  for delete using (public.is_admin());

drop policy if exists group_members_staff_select on public.group_members;
create policy group_members_staff_select on public.group_members
  for select using (public.is_staff());

drop policy if exists group_members_admin_delete on public.group_members;
create policy group_members_admin_delete on public.group_members
  for delete using (public.is_admin());

drop policy if exists businesses_staff_all on public.local_businesses;
create policy businesses_staff_all on public.local_businesses
  for all using (public.is_staff()) with check (public.is_staff());
