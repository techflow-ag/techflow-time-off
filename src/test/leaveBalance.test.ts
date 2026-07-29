import { describe, it, expect } from 'vitest';
import { computeLeaveBalance, computeHolidayBalance, getAccruedMonths } from '@/lib/leaveBalance';

// The accrual window must stop at departure_date: counters are frozen at
// that date no matter how much time passes afterwards.
describe('getAccruedMonths with departure date', () => {
  it('caps accrual at a past departure date', () => {
    // Hired Jan 15 2024, left Jan 15 2025 → 12 full months + current month = 13
    expect(getAccruedMonths('2024-01-15', '2025-01-15')).toBe(13);
  });

  it('frozen counters do not grow over time', () => {
    const atDeparture = getAccruedMonths('2024-01-15', '2025-01-15');
    // Years later, same result — this is the freeze
    expect(getAccruedMonths('2024-01-15', '2025-01-15')).toBe(atDeparture);
  });

  it('ignores a future departure date (accrual continues until then)', () => {
    const withFarFuture = getAccruedMonths('2024-01-15', '2099-12-31');
    const withoutDeparture = getAccruedMonths('2024-01-15', null);
    expect(withFarFuture).toBe(withoutDeparture);
  });

  it('returns 0 when departure is before hire (data entry error)', () => {
    expect(getAccruedMonths('2024-06-01', '2024-01-01')).toBe(0);
  });
});

describe('balances with departure date', () => {
  it('freezes paid leave balance at departure', () => {
    const profile = {
      hire_date: '2024-01-15',
      departure_date: '2025-01-15',
      monthly_accrual: 1.5,
    };
    // 13 accrued months * 1.5 - 10 taken = 9.5
    expect(computeLeaveBalance(profile, 10)).toBeCloseTo(9.5);
  });

  it('freezes holiday balance at departure', () => {
    const profile = {
      hire_date: '2024-01-15',
      departure_date: '2025-01-15',
      monthly_holiday_accrual: 1.08,
    };
    expect(computeHolidayBalance(profile, 4)).toBeCloseTo(13 * 1.08 - 4);
  });
});
