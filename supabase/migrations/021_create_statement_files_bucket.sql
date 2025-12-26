-- Migration: Create storage bucket for statement files
-- This creates a private bucket for securely storing uploaded statement files

-- Note: Storage buckets are created via Supabase Storage API or dashboard
-- This SQL script provides the bucket configuration that should be applied

-- To create the bucket, use one of these methods:
-- 
-- Method 1: Via Supabase Dashboard
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: statement-files
-- 4. Public: No (private)
-- 5. File size limit: 10MB (or as needed)
-- 6. Allowed MIME types: application/pdf, text/csv
--
-- Method 2: Via Supabase Management API (if you have access)
-- POST https://<project-ref>.supabase.co/storage/v1/bucket
-- Headers: { "Authorization": "Bearer <service-role-key>", "apikey": "<service-role-key>" }
-- Body: { "name": "statement-files", "public": false, "file_size_limit": 10485760, "allowed_mime_types": ["application/pdf", "text/csv"] }

-- Storage policies (RLS for storage)
-- These policies ensure users can only access their own statement files
-- Using DO block for idempotent policy creation

DO $$
BEGIN
  -- Insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload to their own folder'
  ) THEN
    CREATE POLICY "Users can upload to their own folder"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'statement-files' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  -- Select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can view their own files'
  ) THEN
    CREATE POLICY "Users can view their own files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'statement-files' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  -- Delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete their own files'
  ) THEN
    CREATE POLICY "Users can delete their own files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'statement-files' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

  -- Update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update their own files'
  ) THEN
    CREATE POLICY "Users can update their own files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'statement-files' AND
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
      );
  END IF;

END;
$$;

-- Note: The bucket itself must be created via the Supabase dashboard or API
-- This migration only sets up the RLS policies for the bucket

