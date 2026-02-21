import type { Tables } from '@/integrations/supabase/types';

/**
 * Compute the dynamic paid leave balance for an employee:
 * balance = (months_since_hire * monthly_accrual) - approved_paid_leave_days
 */
export function computeLeaveBalance(
  profile: Pick<Tables<'profiles'>, 'hire_date' | 'monthly_accrual'>,
  approvedPaidLeaveDays: number
): number {
  if (!profile.hire_date) return 0;

  const months = getMonthsSinceHire(profile.hire_date);
  const accrual = Number(profile.monthly_accrual) || 1.5;
  const totalAccrued = months * accrual;
  return Math.max(0, totalAccrued - approvedPaidLeaveDays);
}

/**
 * Compute the dynamic public holiday balance for an employee:
 * balance = (months_since_hire * monthly_holiday_accrual) - approved_public_holiday_days
 */
export function computeHolidayBalance(
  profile: Pick<Tables<'profiles'>, 'hire_date' | 'monthly_holiday_accrual'>,
  approvedHolidayDays: number
): number {
  if (!profile.hire_date) return 0;

  const months = getMonthsSinceHire(profile.hire_date);
  const accrual = Number(profile.monthly_holiday_accrual) || 1.08;
  const totalAccrued = months * accrual;
  return Math.max(0, totalAccrued - approvedHolidayDays);
}

function getMonthsSinceHire(hireDate: string): number {
  const hire = new Date(hireDate);
  const now = new Date();

  let months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());

  if (now.getDate() < hire.getDate()) {
    months = Math.max(0, months - 1);
  }

  // Always count at least the current month if hired this month or earlier
  months = Math.max(0, months) + 1;

  return months;
}
