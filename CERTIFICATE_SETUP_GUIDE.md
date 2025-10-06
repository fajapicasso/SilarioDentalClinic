# Certificate Upload Setup Guide

## Overview
This guide provides step-by-step instructions to set up certificate upload functionality for all user types (patient, staff, doctor, admin) with proper Row Level Security (RLS) policies.

## Prerequisites
- Supabase project with authentication enabled
- Storage bucket creation permissions
- SQL editor access

## Step 1: Database Setup

### 1.1 Add Certificate URL Column
Run this SQL in your Supabase SQL Editor:

```sql
-- Add certificate_url column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS certificate_url TEXT DEFAULT NULL;
```

### 1.2 Enable RLS
```sql
-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

## Step 2: Storage Bucket Setup

### 2.1 Create Certificates Bucket
1. Go to your Supabase Dashboard
2. Navigate to Storage > Create bucket
3. Set bucket name: `certificates`
4. Enable "Public bucket" option
5. Click "Create bucket"

### 2.2 Set Bucket Permissions
The bucket should be public for viewing certificates, but only authenticated users can upload/delete.

## Step 3: RLS Policies

### 3.1 Run Complete Policy Setup
Execute the complete SQL from `certificate_policies_complete.sql` in your Supabase SQL Editor.

This includes:
- Profile table policies for viewing, updating, and creating profiles
- Storage policies for certificate upload, view, update, and delete
- Helper functions for certificate management
- Automatic timestamp updates

## Step 4: Frontend Implementation

### 4.1 Certificate Upload Features
All user types now have:
- ✅ File selection (image files only)
- ✅ File validation (max 10MB)
- ✅ Preview functionality
- ✅ Upload button with loading states
- ✅ Remove certificate functionality
- ✅ Error handling and user feedback

### 4.2 User Types Supported
- **Patient Profile** (`src/pages/patient/Profile.jsx`)
- **Staff Settings** (`src/pages/staff/Settings.jsx`)
- **Doctor Settings** (`src/pages/doctor/Settings.jsx`)
- **Admin Settings** (`src/pages/admin/Settings.jsx`)

## Step 5: Testing

### 5.1 Test Certificate Upload
1. Log in as any user type
2. Navigate to profile/settings
3. Select an image file for certificate
4. Click "Upload Certificate"
5. Verify the certificate appears in the preview

### 5.2 Test Certificate Removal
1. With an existing certificate uploaded
2. Click "Remove Certificate"
3. Verify the certificate is removed from both storage and database

### 5.3 Test Error Handling
1. Try uploading a non-image file (should show error)
2. Try uploading a file larger than 10MB (should show error)
3. Try uploading without selecting a file (should show error)

## Troubleshooting

### Common Issues

#### 1. "Failed to upload certificate: new row violates row-level security policy"
**Solution:** Run the complete RLS policies from `certificate_policies_complete.sql`

#### 2. "Could not initialize certificates storage"
**Solution:** 
- Ensure the `certificates` bucket exists in Supabase Storage
- Check that the bucket is public
- Verify storage policies are in place

#### 3. Certificate not displaying after upload
**Solution:**
- Check that the certificate_url is being saved to the database
- Verify the public URL is being generated correctly
- Check browser console for any errors

#### 4. Remove certificate not working
**Solution:**
- Ensure the remove function is properly implemented
- Check that the file deletion from storage is working
- Verify the database update is successful

### Debug Steps

1. **Check RLS Policies:**
```sql
SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;
```

2. **Check Storage Policies:**
```sql
SELECT * FROM storage.policies WHERE bucket_id = 'certificates';
```

3. **Check Certificate URL Column:**
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'certificate_url';
```

## Security Considerations

### 1. File Validation
- Only image files are accepted
- Maximum file size: 10MB
- File type validation on both frontend and backend

### 2. Access Control
- Users can only upload/remove their own certificates
- Public access for viewing certificates
- Admin users can manage all certificates

### 3. Storage Security
- Certificates stored in dedicated bucket
- Unique filenames prevent conflicts
- Automatic cleanup on removal

## File Structure

```
src/
├── pages/
│   ├── patient/Profile.jsx          ✅ Certificate upload
│   ├── staff/Settings.jsx           ✅ Certificate upload
│   ├── doctor/Settings.jsx          ✅ Certificate upload
│   └── admin/Settings.jsx           ✅ Certificate upload
├── config/
│   └── supabaseClient.js            ✅ Supabase configuration
└── components/
    └── common/
        └── LoadingSpinner.jsx       ✅ Loading states

SQL Files:
├── certificate_policies_complete.sql ✅ Complete RLS setup
└── certificate_policies.sql         ✅ Basic policies
```

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify all SQL policies are in place
3. Check browser console for errors
4. Ensure Supabase storage is properly configured

## Notes

- Certificates are stored with unique filenames: `{user_id}_certificate_{timestamp}.{ext}`
- All certificate operations include proper error handling
- Users receive feedback via toast notifications
- Certificate removal also deletes the file from storage
- Automatic timestamp updates on profile changes 