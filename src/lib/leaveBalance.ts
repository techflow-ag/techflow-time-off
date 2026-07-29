import type { Tables } from '@/integrations/supabase/types';

type AccrualProfile = Pick<Tables<'profiles'>, 'hire_date' | 'departure_date'>;

/**
 * Compute the dynamic paid leave balance for an employee:
 * balance = (months_accrued * monthly_accrual) - approved_paid_leave_days
 * Accrual stops at departure_date when set (counters are frozen at that date).
 */
export function computeLeaveBalance(
  profile: AccrualProfile & Pick<Tables<'profiles'>, 'monthly_accrual'>,
  approvedPaidLeaveDays: number
): number {
  if (!profile.hire_date) return 0;

  const months = getAccruedMonths(profile.hire_date, profile.departure_date);
  const accrual = Number(profile.monthly_accrual) || 1.5;
  const totalAccrued = months * accrual;
  return totalAccrued - approvedPaidLeaveDays;
}

/**
 * Compute the dynamic public holiday balance for an employee:
 * balance = (months_accrued * monthly_holiday_accrual) - approved_public_holiday_days
 * Accrual stops at departure_date when set (counters are frozen at that date).
 */
export function computeHolidayBalance(
  profile: AccrualProfile & Pick<Tables<'profiles'>, 'monthly_holiday_accrual'>,
  approvedHolidayDays: number
): number {
  if (!profile.hire_date) return 0;

  const months = getAccruedMonths(profile.hire_date, profile.departure_date);
  const accrual = Number(profile.monthly_holiday_accrual) || 1.08;
  const totalAccrued = months * accrual;
  return totalAccrued - approvedHolidayDays;
}

/** Total paid leave days accrued since hire (frozen at departure_date). */
export function computeAccruedPaid(
  profile: AccrualProfile & Pick<Tables<'profiles'>, 'monthly_accrual'>
): number {
  if (!profile.hire_date) return 0;
  return getAccruedMonths(profile.hire_date, profile.departure_date) * (Number(profile.monthly_accrual) || 1.5);
}

/** Total public holiday days accrued since hire (frozen at departure_date). */
export function computeAccruedHoliday(
  profile: AccrualProfile & Pick<Tables<'profiles'>, 'monthly_holiday_accrual'>
): number {
  if (!profile.hire_date) return 0;
  return getAccruedMonths(profile.hire_date, profile.departure_date) * (Number(profile.monthly_holiday_accrual) || 1.08);
}

export function getAccruedMonths(hireDate: string, departureDate?: string | null): number {
  const hire = new Date(hireDate);
  const now = new Date();
  const departure = departureDate ? new Date(departureDate) : null;

  // Accrual window ends at the departure date once it is in the past
  const end = departure && departure < now ? departure : now;

  if (end < hire) return 0;

  let months = (end.getFullYear() - hire.getFullYear()) * 12 + (end.getMonth() - hire.getMonth());

  if (end.getDate() < hire.getDate()) {
    months = Math.max(0, months - 1);
  }

  // Always count at least the current month if hired this month or earlier
  months = Math.max(0, months) + 1;

  return months;
}
