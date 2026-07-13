-- Remove legacy spaces that were imported without an authenticated owner.
-- Associated invite rows are removed automatically by the foreign-key cascade.
delete from public.spaces
where owner_id is null;
