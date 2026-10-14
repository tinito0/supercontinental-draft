-- Supabase Storage for the PES workspace: shared sources (pesdb, EDIT, kit-server) and kit textures/fonts.
-- Run in the Supabase SQL editor after:
--   1. Authentication → Third-Party Auth → Add Firebase (your Firebase project id).
--   2. Running scripts/sync-pes-claims.mjs --apply, so PES users carry role/pes_role claims.
-- Safe to run again: every policy is dropped and recreated.
-- Replace the two placeholders before running (supabase/storage-policies.ready.sql has them filled in):
--   supercont-d62df   your Firebase project id (same as VITE_FIREBASE_PROJECT_ID)
--   Supercontinental-storage                the bucket name (same as VITE_SUPABASE_TEXTURE_BUCKET)

-- Bucket: private, binary only, 32 MB per file (EDIT00000000 is ~11 MB; a 4096x4096 DXT5 FTEX ~22 MB).
update storage.buckets
   set public = false,
       file_size_limit = 33554432,
       allowed_mime_types = array['application/octet-stream']
 where id = 'Supercontinental-storage';

-- Only Firebase ID tokens issued for this Firebase project are accepted (Supabase docs:
-- third-party auth / Firebase, "restrictive" policy on issuer and audience).
create or replace function public.is_scl_firebase_jwt()
returns boolean
language sql
stable
as $$
  select (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/supercont-d62df'
     and (auth.jwt() ->> 'aud') = 'supercont-d62df'
$$;

drop policy if exists "pes textures: firebase project only" on storage.objects;
create policy "pes textures: firebase project only"
  on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'Supercontinental-storage' or public.is_scl_firebase_jwt())
  with check (bucket_id <> 'Supercontinental-storage' or public.is_scl_firebase_jwt());

-- Read: any PES role (pes_role claim set by scripts/sync-pes-claims.mjs).
drop policy if exists "pes textures: read" on storage.objects;
create policy "pes textures: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'Supercontinental-storage'
    and (auth.jwt() ->> 'pes_role') in ('super_admin', 'draft_admin', 'kit_manager')
  );

-- Upload of textures: Super Admin and Kit Managers, only content-addressed paths
-- <firestoreWorkspaceId>/<sha256>.ftex|.dds (the app verifies the hash on download).
drop policy if exists "pes textures: upload" on storage.objects;
create policy "pes textures: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'Supercontinental-storage'
    and (auth.jwt() ->> 'pes_role') in ('super_admin', 'kit_manager')
    and name ~ '^[A-Za-z0-9]{1,64}/[0-9a-f]{64}\.(ftex|dds)$'
  );

-- Upload of the shared sources (pesdb, EDIT, kit-server): Super Admin only,
-- <firestoreWorkspaceId>/sources/<sha256>.pesdb|edit|kits (verified by content hash on download).
drop policy if exists "pes sources: upload" on storage.objects;
create policy "pes sources: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'Supercontinental-storage'
    and (auth.jwt() ->> 'pes_role') = 'super_admin'
    and name ~ '^[A-Za-z0-9]{1,64}/sources/[0-9a-f]{64}\.(pesdb|edit|kits)$'
  );

-- Delete: Super Admin only (cleanup). There is deliberately no UPDATE policy:
-- files are immutable, a change is always a new file with a new hash.
drop policy if exists "pes textures: delete" on storage.objects;
create policy "pes textures: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'Supercontinental-storage'
    and (auth.jwt() ->> 'pes_role') = 'super_admin'
  );
