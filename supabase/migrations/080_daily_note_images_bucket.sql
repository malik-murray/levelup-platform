-- Storage bucket + policies for daily note images (upload, paste)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'daily-note-images',
    'daily-note-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload daily note images to their folder'
  ) THEN
    CREATE POLICY "Users can upload daily note images to their folder"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'daily-note-images' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update their own daily note images'
  ) THEN
    CREATE POLICY "Users can update their own daily note images"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'daily-note-images' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete their own daily note images'
  ) THEN
    CREATE POLICY "Users can delete their own daily note images"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'daily-note-images' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;
END;
$$;
