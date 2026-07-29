-- Departure date: freezes leave accrual at this date and is required
-- before an employee can be deactivated.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS departure_date DATE;
