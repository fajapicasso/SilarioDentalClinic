-- Secure RPC to let admins upsert/update another user's profile
-- Run in Supabase SQL editor

CREATE OR REPLACE FUNCTION public.admin_upsert_profile(
  p_profile_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_street text,
  p_barangay text,
  p_city text,
  p_province text,
  p_address text,
  p_phone text,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Only allow admins to call this
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  -- Ensure a profile row exists (trigger should have created it)
  INSERT INTO public.profiles (id)
  VALUES (p_profile_id)
  ON CONFLICT (id) DO NOTHING;

  -- Update profile details
  UPDATE public.profiles SET
    first_name = p_first_name,
    middle_name = p_middle_name,
    last_name = p_last_name,
    full_name = trim(coalesce(p_first_name,'') || ' ' || coalesce(p_middle_name,'') || ' ' || coalesce(p_last_name,'')),
    street = p_street,
    barangay = p_barangay,
    city = p_city,
    province = p_province,
    address = p_address,
    phone = p_phone,
    role = p_role,
    updated_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- Grant execute to authenticated users (RLS enforced inside)
GRANT EXECUTE ON FUNCTION public.admin_upsert_profile(
  uuid, text, text, text, text, text, text, text, text, text, text
) TO authenticated;
