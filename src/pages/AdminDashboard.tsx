import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Clock, CalendarDays } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { computeLeaveBalance, computeHolidayBalance } from '@/lib/leaveBalance';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type RequestWithProfile = Tables<'leave_requests'> & {
  profiles: Tables<'profiles'> | null;
};

function leaveTypeLabel(type: string, t: (k: string) => string) {
  switch (type) {
    case 'paid_leave': return t('paidLeave');
    case 'public_holiday': return t('publicHoliday');
    case 'sick_leave': return t('sickLeave');
    case 'unpaid_leave': return t('unpaidLeave');
    default: return t('other');
  }
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [pendingRequests, setPendingRequests] = useState<RequestWithProfile[]>([]);
  const [allRequests, setAllRequests] = useState<RequestWithProfile[]>([]);
  const [approvedLeave, setApprovedLeave] = useState<Tables<'leave_requests'>[]>([]);
  const [profiles, setProfiles] = useState<Tables<'profiles'>[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchData = async () => {
    const [pendingRes, allReqRes, approvedRes, profRes] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_employee_id_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_employee_id_fkey(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved'),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    setPendingRequests((pendingRes.data as RequestWithProfile[]) || []);
    setAllRequests((allReqRes.data as RequestWithProfile[]) || []);
    setApprovedLeave(approvedRes.data || []);
    setProfiles(profRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const onLeaveToday = profiles.filter((p) =>
    allRequests.some(
      (r) =>
        r.employee_id === p.id &&
        r.status === 'approved' &&
        r.start_date <= today &&
        r.end_date >= today
    )
  ).length;

  const handleDecision = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessing(requestId);
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        admin_comment: comments[requestId] || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: status === 'approved' ? t('approved') : t('rejected'),
        description: language === 'fr' ? 'Demande traitée avec succès' : 'Request processed successfully',
      });
      fetchData();
    }
    setProcessing(null);
  };

  const filteredAll = statusFilter === 'all' ? allRequests : allRequests.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalEmployees')}</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{profiles.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('pendingRequests')}</CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingRequests.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('onLeaveToday')}</CardTitle>
            <CalendarDays className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{onLeaveToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t('pendingRequests')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {r.profiles?.first_name} {r.profiles?.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)} · {r.number_of_days} {t('days')}
                    </p>
                    <Badge variant="warning" className="mt-1">
                      {leaveTypeLabel(r.type, t)}
                    </Badge>
                    {r.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      size="sm"
                      disabled={processing === r.id}
                      onClick={() => handleDecision(r.id, 'approved')}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={processing === r.id}
                      onClick={() => handleDecision(r.id, 'rejected')}
                    >
                      {t('reject')}
                    </Button>
                  </div>
                </div>
                <Textarea
                  placeholder={t('commentPlaceholder')}
                  value={comments[r.id] || ''}
                  onChange={(e) => setComments((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="text-sm"
                  rows={2}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All requests (merged Leave Requests tab) */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>{t('leaveHistory')}</CardTitle>
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
        </CardHeader>
        <CardContent className="p-0">
          {filteredAll.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t('noRequests')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('employee')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('requestDate')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('leaveDates')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('days')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('type')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('adminComment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-foreground font-medium">
                        {r.profiles?.first_name} {r.profiles?.last_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at, language)}</td>
                      <td className="px-4 py-3 text-foreground">
                        {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{r.number_of_days}</td>
                      <td className="px-4 py-3 text-muted-foreground">{leaveTypeLabel(r.type, t)}</td>
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
