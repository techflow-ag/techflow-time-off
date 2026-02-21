import type { Tables } from '@/integrations/supabase/types';

/**
 * Compute the dynamic leave balance for an employee:
 * balance = (months_since_hire * monthly_accrual) - approved_paid_leave_days
 */
export function computeLeaveBalance(
  profile: Pick<Tables<'profiles'>, 'hire_date' | 'monthly_accrual'>,
  approvedPaidLeaveDays: number
): number {
  if (!profile.hire_date) return 0;

  const hireDate = new Date(profile.hire_date);
  const now = new Date();

  // Calculate full months elapsed (count current month if we're past the hire day)
  let months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
  
  // If hire day is after today's day-of-month, don't count current month
  if (now.getDate() < hireDate.getDate()) {
    months = Math.max(0, months - 1);
  }
  
  // Always count at least the current month if hired this month or earlier
  months = Math.max(0, months) + 1;

  const accrual = Number(profile.monthly_accrual) || 2.08;
  const totalAccrued = months * accrual;
  return Math.max(0, totalAccrued - approvedPaidLeaveDays);
}
