-- Oxford Project Reporting: allow site diary photos (JPEG, PNG, WebP) in the private "files" bucket alongside PDFs.
-- Access rules are unchanged: only people on the team can upload, view or delete files.
update storage.buckets set allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'] where id = 'files';
