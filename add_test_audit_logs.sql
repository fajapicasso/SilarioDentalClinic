-- Add Test Audit Logs
-- This file adds sample audit logs so you can see them immediately in the interface

-- First, let's add some test audit logs manually
INSERT INTO audit_logs (
    user_id, user_name, user_role, action, module, section,
    resource_type, resource_id, resource_name,
    old_values, new_values, success, metadata, timestamp, created_at
) VALUES 
-- Recent user activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'user_login',
    'security',
    'authentication',
    'user',
    auth.uid(),
    'Admin User',
    NULL,
    '{"login_time": "2024-01-15T10:00:00Z", "ip_address": "192.168.1.100"}',
    true,
    '{"loginMethod": "password", "userAgent": "Mozilla/5.0..."}',
    NOW() - INTERVAL '5 minutes',
    NOW() - INTERVAL '5 minutes'
),
-- Appointment activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'appointment_create',
    'appointments',
    'scheduling',
    'appointment',
    gen_random_uuid(),
    'Appointment for Juan Dela Cruz',
    NULL,
    '{"patient_name": "Juan Dela Cruz", "appointment_date": "2024-01-15", "appointment_time": "10:00", "service": "Dental Cleaning", "branch": "Cabugao"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174000", "doctorId": "123e4567-e89b-12d3-a456-426614174001", "branch": "Cabugao"}',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes'
),
(
    auth.uid(),
    'Admin User',
    'admin',
    'appointment_confirm',
    'appointments',
    'scheduling',
    'appointment',
    gen_random_uuid(),
    'Appointment for Ana Garcia',
    '{"status": "pending"}',
    '{"status": "confirmed", "confirmed_at": "2024-01-15T10:30:00Z"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174002", "doctorId": "123e4567-e89b-12d3-a456-426614174001", "branch": "San Juan"}',
    NOW() - INTERVAL '15 minutes',
    NOW() - INTERVAL '15 minutes'
),
-- Payment activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'payment_create',
    'payments',
    'billing',
    'payment',
    gen_random_uuid(),
    'Payment of ₱1,500',
    NULL,
    '{"amount": 1500, "payment_method": "cash", "status": "pending", "patient_name": "Juan Dela Cruz"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174000", "invoiceId": "123e4567-e89b-12d3-a456-426614174003", "paymentMethod": "cash"}',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
),
(
    auth.uid(),
    'Admin User',
    'admin',
    'payment_approve',
    'payments',
    'billing',
    'payment',
    gen_random_uuid(),
    'Payment of ₱2,000',
    '{"approval_status": "pending"}',
    '{"approval_status": "approved", "approved_at": "2024-01-15T11:00:00Z"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174002", "invoiceId": "123e4567-e89b-12d3-a456-426614174004", "amount": 2000}',
    NOW() - INTERVAL '25 minutes',
    NOW() - INTERVAL '25 minutes'
),
-- Treatment activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'treatment_add',
    'medical_records',
    'treatments',
    'treatment',
    gen_random_uuid(),
    'Treatment: Dental Cleaning',
    NULL,
    '{"treatment_name": "Dental Cleaning", "description": "Professional dental cleaning and scaling", "date": "2024-01-15", "notes": "Patient had moderate plaque buildup"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174000", "doctorId": "123e4567-e89b-12d3-a456-426614174001", "appointmentId": "123e4567-e89b-12d3-a456-426614174005"}',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
),
-- Queue activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'queue_add',
    'queue',
    'management',
    'queue',
    gen_random_uuid(),
    'Queue entry for Pedro Santos',
    NULL,
    '{"patient_name": "Pedro Santos", "queue_number": "Q-001", "status": "waiting", "branch": "Cabugao"}',
    true,
    '{"patientId": "123e4567-e89b-12d3-a456-426614174006", "doctorId": "123e4567-e89b-12d3-a456-426614174001", "branch": "Cabugao"}',
    NOW() - INTERVAL '35 minutes',
    NOW() - INTERVAL '35 minutes'
),
-- Service activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'service_create',
    'services',
    'management',
    'service',
    gen_random_uuid(),
    'Teeth Whitening',
    NULL,
    '{"name": "Teeth Whitening", "description": "Professional teeth whitening treatment", "price": 3000, "category": "cosmetic"}',
    true,
    '{"category": "cosmetic", "price": 3000}',
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '40 minutes'
),
-- User management activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'user_create',
    'user_management',
    'users',
    'user',
    gen_random_uuid(),
    'Dr. Maria Santos',
    NULL,
    '{"full_name": "Dr. Maria Santos", "email": "maria.santos@silario.com", "role": "doctor", "phone": "+63 912 345 6789"}',
    true,
    '{"userRole": "doctor", "email": "maria.santos@silario.com"}',
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '45 minutes'
),
-- System activities
(
    auth.uid(),
    'Admin User',
    'admin',
    'system_backup',
    'system',
    'maintenance',
    'backup',
    gen_random_uuid(),
    'Backup 2024-01-15',
    NULL,
    '{"backup_name": "Backup 2024-01-15", "backup_type": "full", "size": "2.5GB", "status": "completed"}',
    true,
    '{"backupSize": "2.5GB", "backupType": "full"}',
    NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '50 minutes'
);

-- Check if the logs were inserted successfully
SELECT 
    'Test Audit Logs Inserted' as status,
    COUNT(*) as total_logs
FROM audit_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Show the inserted logs
SELECT 
    user_name,
    action,
    module,
    resource_name,
    timestamp,
    success
FROM audit_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
