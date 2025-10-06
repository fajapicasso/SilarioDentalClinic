-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(6) NOT NULL, -- 6-digit numeric token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    used_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active token per user
    CONSTRAINT unique_active_token UNIQUE (user_id, token)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only allow service role to manage tokens (no user access)
CREATE POLICY "Service role can manage password reset tokens" ON password_reset_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$;

-- Function to generate a password reset token
CREATE OR REPLACE FUNCTION generate_password_reset_token(user_email text)
RETURNS TABLE(token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    new_token TEXT;
    token_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if user exists and is not disabled
    SELECT id, email, disabled INTO user_record
    FROM profiles 
    WHERE email = user_email;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    IF user_record.disabled = true THEN
        RAISE EXCEPTION 'Account is disabled';
    END IF;
    
    -- Clean up any existing tokens for this user
    DELETE FROM password_reset_tokens 
    WHERE user_id = user_record.id;
    
    -- Generate 6-digit token
    new_token := LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    token_expires := NOW() + INTERVAL '15 minutes';
    
    -- Insert new token
    INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
    VALUES (user_record.id, user_record.email, new_token, token_expires);
    
    -- Return token and expiry
    RETURN QUERY SELECT new_token, token_expires;
END;
$$;

-- Function to validate and use a password reset token
CREATE OR REPLACE FUNCTION validate_password_reset_token(user_email text, reset_token text)
RETURNS TABLE(user_id uuid, is_valid boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token_record RECORD;
BEGIN
    -- Find the token
    SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at, p.disabled
    INTO token_record
    FROM password_reset_tokens prt
    JOIN profiles p ON p.id = prt.user_id
    WHERE prt.email = user_email AND prt.token = reset_token;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::uuid, false, 'Invalid token';
        RETURN;
    END IF;
    
    -- Check if user is disabled
    IF token_record.disabled = true THEN
        RETURN QUERY SELECT NULL::uuid, false, 'Account is disabled';
        RETURN;
    END IF;
    
    -- Check if token is already used
    IF token_record.used_at IS NOT NULL THEN
        RETURN QUERY SELECT NULL::uuid, false, 'Token has already been used';
        RETURN;
    END IF;
    
    -- Check if token is expired
    IF token_record.expires_at < NOW() THEN
        RETURN QUERY SELECT NULL::uuid, false, 'Token has expired';
        RETURN;
    END IF;
    
    -- Mark token as used
    UPDATE password_reset_tokens 
    SET used_at = NOW() 
    WHERE id = token_record.id;
    
    -- Return success
    RETURN QUERY SELECT token_record.user_id, true, 'Token is valid';
END;
$$;

-- Create a scheduled job to clean up expired tokens (runs every hour)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-expired-reset-tokens', '0 * * * *', 'SELECT cleanup_expired_reset_tokens();');
