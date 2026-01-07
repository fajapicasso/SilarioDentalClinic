-- Fix double-booking by enforcing ONE active appointment per branch/date/time.
-- Run this in Supabase SQL Editor.
--
-- IMPORTANT:
-- If you already have duplicates, the CREATE INDEX will fail.
-- First run the "CHECK DUPLICATES" query below, and resolve duplicates (cancel/reject extras)
-- before creating the index.

-- CHECK DUPLICATES (active appointments only)
select
  branch,
  appointment_date,
  appointment_time,
  count(*) as active_count
from public.appointments
where status in ('pending', 'confirmed')
group by 1,2,3
having count(*) > 1
order by appointment_date, appointment_time, branch;

-- ENFORCE UNIQUE SLOT (active only)
-- This makes double-booking impossible even if multiple patients click at the exact same time.
create unique index if not exists appointments_unique_active_branch_date_time
on public.appointments (branch, appointment_date, appointment_time)
where status in ('pending', 'confirmed');


