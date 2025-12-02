# Children Feature Setup Guide

## Overview
Children/minors are stored in the **profiles** table (same as regular patients) with a `guardian_id` field to link them to their guardians. This approach is simpler and more consistent with the existing patient system.

## Issue
If you're seeing errors when trying to add children, it means the `guardian_id` column hasn't been added to the profiles table yet.

## Solution

### Step 1: Run the SQL Script

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Open the file `add_guardian_id_to_profiles.sql` from your project
5. Copy the entire contents
6. Paste it into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)

### Step 2: Verify the Column Was Added

After running the script, verify the column exists:

1. Go to **Table Editor** in Supabase Dashboard
2. Click on the **profiles** table
3. You should see a new column `guardian_id` (UUID)
4. This column references the `profiles` table itself (self-referential foreign key)

### Step 3: Verify Appointments Table

The script should also add a `guardian_id` column to the `appointments` table:
- `guardian_id` (UUID, references profiles)

This tracks which guardian booked the appointment when booking for a child.

Verify this column exists in the `appointments` table.

### Step 4: RLS Policies

The existing RLS policies on the `profiles` table should work for children as well. Children are just profiles with `guardian_id` set. Make sure your profiles table RLS policies allow:
- Users to view their own profile
- Guardians to view profiles where `guardian_id` matches their user ID (if needed)

### Step 5: Test the Feature

1. Refresh your application
2. Go to **My Profile** page
3. Scroll to **My Children** section
4. Click **Add Child**
5. Fill in the form and save
6. The child should appear in the list

## Troubleshooting

### Still Getting Errors?

1. **Check if the column exists:**
   - Go to Table Editor in Supabase
   - Open the `profiles` table
   - Look for `guardian_id` column
   - If it doesn't exist, run the SQL script again

2. **Check RLS Policies:**
   - Make sure RLS is enabled on the profiles table
   - Verify the policies allow your user role to insert/select
   - Guardians should be able to insert profiles with their ID as guardian_id

3. **Check Console:**
   - Open browser DevTools (F12)
   - Check the Console tab for detailed error messages
   - Look for specific error codes (42703 = column doesn't exist)

4. **Verify User Authentication:**
   - Make sure you're logged in as a patient user
   - Check that your user ID matches the guardian_id when saving children

### Permission Denied Errors?

If you get permission errors:
1. Check that RLS policies are correctly set up
2. Verify your user role in the `profiles` table
3. Make sure the policies allow your role to access the table

## What the SQL Script Does

1. Adds `guardian_id` column to `profiles` table (self-referential foreign key)
2. Creates index on `guardian_id` for faster queries
3. Adds `guardian_id` column to `appointments` table to track who booked for a child
4. Creates index on appointments `guardian_id` for faster queries
5. Grants necessary permissions

**Note:** Children are stored as regular profiles with `role='patient'` and `guardian_id` set to their guardian's profile ID.

## After Setup

Once the table is created, you can:
- Add children in the "My Profile" page
- Book appointments for your children
- Edit and delete children information
- All operations are atomic and secure

