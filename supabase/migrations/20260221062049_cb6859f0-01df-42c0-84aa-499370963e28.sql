
-- Add 'public_holiday' to leave_type enum
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'public_holiday';

-- Add monthly_holiday_accrual column to profiles (13 days/year = 1.08/month)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_holiday_accrual numeric NOT NULL DEFAULT 1.08;

-- Update default monthly_accrual from 2.08 to 1.5
ALTER TABLE public.profiles ALTER COLUMN monthly_accrual SET DEFAULT 1.5;

-- Update existing employees: set monthly_accrual to 1.5 where it was 2.08
UPDATE public.profiles SET monthly_accrual = 1.5 WHERE monthly_accrual = 2.08;
