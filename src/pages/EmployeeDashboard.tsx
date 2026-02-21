import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, TrendingUp, Landmark, Briefcase } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { computeLeaveBalance, computeHolidayBalance } from '@/lib/leaveBalance';
import type { Tables } from '@/integrations/supabase/types';

export default function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<Tables<'leave_requests'>[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRequests(data || []));
  }, [user]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const upcomingLeave = requests.find(
    (r) => r.status === 'approved' && new Date(r.start_date) >= new Date()
  );

  const approvedPaidDays = requests
    .filter((r) => r.status === 'approved' && r.type === 'paid_leave')
    .reduce((sum, r) => sum + Number(r.number_of_days), 0);

  const approvedHolidayDays = requests
    .filter((r) => r.status === 'approved' && r.type === 'public_holiday')
    .reduce((sum, r) => sum + Number(r.number_of_days), 0);

  const paidBalance = profile ? computeLeaveBalance(profile, approvedPaidDays) : 0;
  const holidayBalance = profile ? computeHolidayBalance(profile, approvedHolidayDays) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('dashboard')}
        </h1>
        <p className="text-muted-foreground">
          {profile?.first_name
            ? `${language === 'fr' ? 'Bonjour' : 'Hello'}, ${profile.first_name}!`
            : ''}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Paid leave balance */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('paidLeave')}
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{paidBalance.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">{t('daysRemaining')}</p>
            {profile?.monthly_accrual && (
              <p className="mt-2 text-xs text-muted-foreground">
                +{Number(profile.monthly_accrual).toFixed(2)} {t('daysPerMonth')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Public holiday balance */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('publicHoliday')}
            </CardTitle>
            <Landmark className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{holidayBalance.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">{t('daysRemaining')}</p>
            {profile?.monthly_holiday_accrual && (
              <p className="mt-2 text-xs text-muted-foreground">
                +{Number(profile.monthly_holiday_accrual).toFixed(2)} {t('daysPerMonth')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Start date */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('hireDate')}
            </CardTitle>
            <Briefcase className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-foreground">
              {profile?.hire_date ? formatDate(profile.hire_date, language) : '—'}
            </div>
          </CardContent>
        </Card>

        {/* Pending requests */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pendingRequests')}
            </CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">{t('awaitingApproval')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming leave */}
      {upcomingLeave && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('upcomingLeave')}
            </CardTitle>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-foreground">
              {formatDate(upcomingLeave.start_date, language)} → {formatDate(upcomingLeave.end_date, language)}
            </div>
            <p className="text-sm text-muted-foreground">
              {upcomingLeave.number_of_days} {t('days')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent requests */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('leaveHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('noRequests')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t('leaveDates')}</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t('days')}</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t('type')}</th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3 text-foreground">
                        {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)}
                      </td>
                      <td className="px-3 py-3 text-foreground">{r.number_of_days}</td>
                      <td className="px-3 py-3">
                        <span className="text-muted-foreground capitalize">
                          {t(r.type === 'paid_leave' ? 'paidLeave' : r.type === 'public_holiday' ? 'publicHoliday' : r.type === 'sick_leave' ? 'sickLeave' : r.type === 'unpaid_leave' ? 'unpaidLeave' : 'other')}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'warning'}>
                          {t(r.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
