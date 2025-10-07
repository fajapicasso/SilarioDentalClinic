-- Fix Queue Duplication - Final Solution
-- This script cleans up existing duplicate queue entries and prevents future duplicates

-- Step 1: Clean up existing duplicate queue entries
-- Keep only the first (oldest) entry for each patient per day
WITH duplicate_entries AS (
  SELECT 
    id,
    patient_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id, DATE(created_at) 
      ORDER BY created_at ASC
    ) as rn
  FROM queue
  WHERE status IN ('waiting', 'serving')
    AND created_at >= CURRENT_DATE - INTERVAL '7 days' -- Only clean up recent entries
)
DELETE FROM queue 
WHERE id IN (
  SELECT id 
  FROM duplicate_entries 
  WHERE rn > 1
);

-- Step 2: Reset queue numbers to be sequential for today
-- This ensures all current queue entries have proper sequential numbers
WITH today_queue AS (
  SELECT 
    id,
    patient_id,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_queue_number
  FROM queue
  WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('waiting', 'serving')
)
UPDATE queue 
SET queue_number = tq.new_queue_number
FROM today_queue tq
WHERE queue.id = tq.id;

-- Step 3: Add unique constraint to prevent future duplicates
-- This will prevent the same patient from being added to queue multiple times on the same day
ALTER TABLE queue 
ADD CONSTRAINT unique_patient_per_day 
UNIQUE (patient_id, DATE(created_at));

-- Step 4: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_queue_patient_date 
ON queue (patient_id, DATE(created_at));

-- Step 5: Add a function to safely get the next queue number
-- This prevents race conditions when multiple users add patients simultaneously
CREATE OR REPLACE FUNCTION get_next_queue_number()
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get the next queue number atomically
  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO next_number
  FROM queue
  WHERE created_at >= CURRENT_DATE 
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a function to safely add patients to queue
-- This prevents duplicates and race conditions
CREATE OR REPLACE FUNCTION add_patient_to_queue_safe(
  p_patient_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_branch TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  queue_entry_id UUID;
  queue_number INTEGER;
  result JSON;
BEGIN
  -- Check if patient is already in today's queue
  IF EXISTS (
    SELECT 1 FROM queue 
    WHERE patient_id = p_patient_id 
      AND created_at >= CURRENT_DATE 
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
      AND status IN ('waiting', 'serving')
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Patient is already in today''s queue'
    );
  END IF;
  
  -- Get the next queue number
  queue_number := get_next_queue_number();
  
  -- Insert the queue entry
  INSERT INTO queue (
    patient_id,
    appointment_id,
    queue_number,
    status,
    branch,
    notes,
    estimated_wait_time,
    created_at,
    updated_at
  ) VALUES (
    p_patient_id,
    p_appointment_id,
    queue_number,
    'waiting',
    p_branch,
    p_notes,
    15,
    NOW(),
    NOW()
  ) RETURNING id INTO queue_entry_id;
  
  RETURN json_build_object(
    'success', true,
    'queue_number', queue_number,
    'queue_entry_id', queue_entry_id
  );
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create a function to clean up duplicates for a specific patient
CREATE OR REPLACE FUNCTION cleanup_patient_duplicates(p_patient_id UUID)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete all but the first (oldest) queue entry for this patient today
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
    FROM queue
    WHERE patient_id = p_patient_id
      AND created_at >= CURRENT_DATE 
      AND created_at < CURRENT_DATE + INTERVAL '1 day'
      AND status IN ('waiting', 'serving')
  )
  DELETE FROM queue 
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create a view for monitoring queue status
CREATE OR REPLACE VIEW queue_status AS
SELECT 
  DATE(created_at) as queue_date,
  COUNT(*) as total_patients,
  COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_patients,
  COUNT(CASE WHEN status = 'serving' THEN 1 END) as serving_patients,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_patients,
  MIN(queue_number) as first_queue_number,
  MAX(queue_number) as last_queue_number
FROM queue
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY queue_date DESC;

-- Verification queries (run these to check the results)
-- SELECT * FROM queue_status;
-- SELECT patient_id, COUNT(*) as duplicate_count FROM queue WHERE created_at >= CURRENT_DATE GROUP BY patient_id HAVING COUNT(*) > 1;
