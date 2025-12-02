-- Create patient_children table for storing children information
-- This allows guardians to book appointments for their children (minors)

CREATE TABLE IF NOT EXISTS patient_children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    nickname TEXT,
    birthday DATE NOT NULL,
    age INTEGER,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    nationality TEXT,
    street TEXT,
    barangay TEXT,
    city TEXT,
    province TEXT,
    address TEXT, -- Computed full address
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_patient_children_guardian_id ON patient_children(guardian_id);
CREATE INDEX IF NOT EXISTS idx_patient_children_active ON patient_children(guardian_id, is_active) WHERE is_active = TRUE;

-- Create function to automatically calculate age from birthday
CREATE OR REPLACE FUNCTION calculate_child_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to automatically update age when birthday changes
CREATE OR REPLACE FUNCTION update_child_age()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.birthday IS NOT NULL THEN
        NEW.age := calculate_child_age(NEW.birthday);
    END IF;
    
    -- Auto-compute full address
    IF NEW.street IS NOT NULL OR NEW.barangay IS NOT NULL OR NEW.city IS NOT NULL OR NEW.province IS NOT NULL THEN
        NEW.address := TRIM(
            CONCAT_WS(', ',
                NULLIF(TRIM(NEW.street), ''),
                NULLIF(TRIM(NEW.barangay), ''),
                NULLIF(TRIM(NEW.city), ''),
                NULLIF(TRIM(NEW.province), '')
            )
        );
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update age and address
CREATE TRIGGER trigger_update_child_age_and_address
    BEFORE INSERT OR UPDATE ON patient_children
    FOR EACH ROW
    EXECUTE FUNCTION update_child_age();

-- Add RLS (Row Level Security) policies
ALTER TABLE patient_children ENABLE ROW LEVEL SECURITY;

-- Policy: Guardians can view their own children
CREATE POLICY "Guardians can view their own children"
    ON patient_children
    FOR SELECT
    USING (auth.uid() = guardian_id);

-- Policy: Guardians can insert their own children
CREATE POLICY "Guardians can insert their own children"
    ON patient_children
    FOR INSERT
    WITH CHECK (auth.uid() = guardian_id);

-- Policy: Guardians can update their own children
CREATE POLICY "Guardians can update their own children"
    ON patient_children
    FOR UPDATE
    USING (auth.uid() = guardian_id)
    WITH CHECK (auth.uid() = guardian_id);

-- Policy: Guardians can delete their own children
CREATE POLICY "Guardians can delete their own children"
    ON patient_children
    FOR DELETE
    USING (auth.uid() = guardian_id);

-- Policy: Staff, doctors, and admins can view all children (for appointment management)
CREATE POLICY "Staff can view all children"
    ON patient_children
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'doctor', 'staff')
        )
    );

-- Add guardian_id column to appointments table if it doesn't exist
-- This allows tracking which guardian booked the appointment for a child
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'guardian_id'
    ) THEN
        ALTER TABLE appointments 
        ADD COLUMN guardian_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_appointments_guardian_id ON appointments(guardian_id);
    END IF;
END $$;

-- Add child_id column to appointments table if it doesn't exist
-- This links the appointment to a child (if booking for a child)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'child_id'
    ) THEN
        ALTER TABLE appointments 
        ADD COLUMN child_id UUID REFERENCES patient_children(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_appointments_child_id ON appointments(child_id);
        
        -- Add constraint: if child_id is set, guardian_id must also be set
        ALTER TABLE appointments
        ADD CONSTRAINT check_child_guardian 
        CHECK ((child_id IS NULL) OR (guardian_id IS NOT NULL));
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_children TO authenticated;
GRANT USAGE ON SEQUENCE patient_children_id_seq TO authenticated;

