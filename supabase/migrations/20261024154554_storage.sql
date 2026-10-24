-- Migration 4 of 4 (DEVELOPMENT.md 9.13): the item-images bucket and its
-- storage policies (DEVELOPMENT.md 11.1, D-09).
--
-- The bucket is private: images are shown only through short-lived signed
-- URLs, which the server can create only for files the viewer may read under
-- the policies below. Supabase already has RLS on storage.objects.
--
-- There is no UPDATE policy, so files can't be overwritten or moved. Uploads
-- must use upsert: false (the default); every upload has a new random name.
--
-- A file a report points to can't be deleted, and nothing can be uploaded to
-- a path a report points to. Otherwise an owner could swap the image on a
-- resolved, closed or hidden report (delete, then upload again under the same
-- name), or remove a flagged image before an admin reviews it. To change or
-- remove an image, the app first updates image_path (to the new file or to
-- null), then deletes the old file.


-- Bucket ----------------------------------------------------------------------

-- The Storage service enforces the size and type limits on upload, from the
-- content type the browser declares. They match IMAGE_MAX_BYTES and
-- IMAGE_ALLOWED_TYPES in src/lib/constants.ts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);


-- Lookups from image to report ------------------------------------------------

-- The policies below find the report for an image by image_path on every
-- read, upload and delete.
create index item_reports_image_path_idx
  on public.item_reports (image_path)
  where image_path is not null;


-- Policies on storage.objects -------------------------------------------------

-- Only <your user_id>/<uuid>.<jpg|png|webp>: the same format the
-- validate_item_report trigger accepts for image_path, so every upload can be
-- attached to a report. No subfolders or uploaded file names.
--
-- Not to a path a report already points to: image_path isn't checked against
-- Storage, so a report can name a file that doesn't exist (never uploaded, or
-- deleted before it was attached). Uploading it later would put a new image
-- on that report, even one that has ended or is hidden. The app always
-- uploads before it saves image_path, so this never blocks it. The report
-- check sees all the caller's reports (any status), and a path in their own
-- folder can only belong to their reports, so none is missed.
create policy item_images_insert_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and name ~ (
      '^' || (select auth.uid())::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
    and not exists (
      select 1 from public.item_reports r where r.image_path = objects.name
    )
  );

-- An image can be read when a report the caller can see points to it. The
-- subquery runs under item_reports' own policies, so this follows them
-- exactly: visitors see images of active reports only, and admins see all.
create policy item_images_select_visible_report
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'item-images'
    and exists (
      select 1 from public.item_reports r where r.image_path = objects.name
    )
  );

-- Your own files, including ones not yet attached to a report: for a preview
-- right after upload, and because Storage's remove needs SELECT as well as
-- DELETE.
create policy item_images_select_own_folder
  on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Only your own files, and only ones no report points to. Since only active
-- reports can change image_path, images on ended or hidden reports stay as
-- they are. As with uploads, the report check sees every report that can
-- point into the caller's folder. Admins remove an image from view by hiding
-- the report.
create policy item_images_delete_own_unattached
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.item_reports r where r.image_path = objects.name
    )
  );
