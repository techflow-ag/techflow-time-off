import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

export default function LeaveHistory() {
  const { user, role } = useAuth();
  const { t, language } = useLanguage();
  const [requests, setRequests] = useState<(Tables<'leave_requests'> & { profiles?: Tables<'profiles'> | null })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!user) return;
    const query = isAdmin
      ? supabase.from('leave_requests').select('*, profiles!leave_requests_employee_id_fkey(*)')
      : supabase.from('leave_requests').select('*').eq('employee_id', user.id);

    query.order('created_at', { ascending: false }).then(({ data }) => setRequests(data || []));
  }, [user, isAdmin]);

  const filtered = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          {isAdmin ? t('leaveRequests') : t('myLeave')}
        </h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="approved">{t('approved')}</SelectItem>
            <SelectItem value="rejected">{t('rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t('noRequests')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {isAdmin && <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('employee')}</th>}
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('requestDate')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('leaveDates')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('days')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('type')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('adminComment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      {isAdmin && (
                        <td className="px-4 py-3 text-foreground font-medium">
                          {(r as any).profiles?.first_name} {(r as any).profiles?.last_name}
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at, language)}</td>
                      <td className="px-4 py-3 text-foreground">
                        {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{r.number_of_days}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(r.type === 'paid_leave' ? 'paidLeave' : r.type === 'sick_leave' ? 'sickLeave' : r.type === 'unpaid_leave' ? 'unpaidLeave' : 'other')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'warning'}>
                          {t(r.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.admin_comment || '—'}</td>
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
