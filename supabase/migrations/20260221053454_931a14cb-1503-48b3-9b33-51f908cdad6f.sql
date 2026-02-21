-- Change default leave_balance from 25 to 0 for new employees
ALTER TABLE public.profiles ALTER COLUMN leave_balance SET DEFAULT 0;