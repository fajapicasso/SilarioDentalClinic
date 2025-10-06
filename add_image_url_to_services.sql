-- Add image_url column to services table
-- Run this in your Supabase SQL editor

-- Add image_url column if it doesn't exist
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a comment to describe the column
COMMENT ON COLUMN services.image_url IS 'URL to the service image stored in Supabase storage';

-- You can also add an index for better performance if you plan to query by image_url
-- CREATE INDEX IF NOT EXISTS idx_services_image_url ON services(image_url) WHERE image_url IS NOT NULL;

