import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Clock, CalendarDays, XCircle } from 'lucide-react';
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

function getAvatarUrl(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return undefined;
  return avatarUrl;
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
  const [cancelTarget, setCancelTarget] = useState<RequestWithProfile | null>(null);

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

  // Compute balance for an employee shown in a request
  const getEmployeeBalance = (employeeId: string, type: string) => {
    const profile = profiles.find(p => p.id === employeeId);
    if (!profile) return null;
    const approved = approvedLeave.filter(r => r.employee_id === employeeId && r.type === type);
    const days = approved.reduce((sum, r) => sum + Number(r.number_of_days), 0);
    if (type === 'paid_leave') return computeLeaveBalance(profile, days);
    if (type === 'public_holiday') return computeHolidayBalance(profile, days);
    return null;
  };

  const handleDecision = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessing(requestId);
    const request = pendingRequests.find((r) => r.id === requestId);
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
      // Notify the employee (fire-and-forget)
      if (request?.profiles) {
        supabase.functions.invoke('notify-leave-decision', {
          body: {
            employeeId: request.employee_id,
            employeeName: `${request.profiles.first_name} ${request.profiles.last_name}`.trim(),
            employeeEmail: request.profiles.email,
            status,
            startDate: request.start_date,
            endDate: request.end_date,
            numberOfDays: request.number_of_days,
            leaveType: request.type,
            adminComment: comments[requestId] || null,
          },
        }).catch(console.error);
      }

      toast({
        title: status === 'approved' ? t('approved') : t('rejected'),
        description: language === 'fr' ? 'Demande traitée avec succès' : 'Request processed successfully',
      });
      fetchData();
    }
    setProcessing(null);
  };

  const handleCancelApproved = async () => {
    if (!cancelTarget) return;
    setProcessing(cancelTarget.id);
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled' as any,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', cancelTarget.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: language === 'fr' ? 'Congé annulé' : 'Leave cancelled',
        description: language === 'fr' ? 'Le solde de l\'employé a été recrédité' : 'Employee balance has been credited back',
      });
      fetchData();
    }
    setProcessing(null);
    setCancelTarget(null);
  };

  const filteredAll = statusFilter === 'all' ? allRequests : allRequests.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>

      {/* Cancel approved leave dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'fr' ? 'Annuler ce congé approuvé ?' : 'Cancel this approved leave?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? `Le congé de ${cancelTarget?.profiles?.first_name} ${cancelTarget?.profiles?.last_name} (${cancelTarget?.number_of_days} jours) sera annulé et son solde sera recrédité.`
                : `The leave for ${cancelTarget?.profiles?.first_name} ${cancelTarget?.profiles?.last_name} (${cancelTarget?.number_of_days} days) will be cancelled and their balance will be credited back.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelApproved} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'fr' ? 'Confirmer l\'annulation' : 'Confirm cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            {pendingRequests.map((r) => {
              const balance = getEmployeeBalance(r.employee_id, r.type);
              const balanceAfter = balance !== null ? balance - Number(r.number_of_days) : null;
              return (
                <div key={r.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(r.profiles?.avatar_url)} />
                        <AvatarFallback className="text-xs">
                          {r.profiles?.first_name?.[0]}{r.profiles?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {r.profiles?.first_name} {r.profiles?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)} · {r.number_of_days} {t('days')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="warning">
                            {leaveTypeLabel(r.type, t)}
                          </Badge>
                          {balanceAfter !== null && balanceAfter < 0 && (
                            <span className="text-xs font-medium text-destructive">
                              {language === 'fr' ? 'Solde après' : 'Balance after'}: {balanceAfter.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {r.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                        )}
                      </div>
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
              );
            })}
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
                <SelectItem value="cancelled">{language === 'fr' ? 'Annulé' : 'Cancelled'}</SelectItem>
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((r) => {
                    const balance = getEmployeeBalance(r.employee_id, r.type);
                    return (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={getAvatarUrl(r.profiles?.avatar_url)} />
                              <AvatarFallback className="text-[10px]">
                                {r.profiles?.first_name?.[0]}{r.profiles?.last_name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {r.profiles?.first_name} {r.profiles?.last_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at, language)}</td>
                        <td className="px-4 py-3 text-foreground">
                          {formatDate(r.start_date, language)} → {formatDate(r.end_date, language)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{r.number_of_days}</td>
                        <td className="px-4 py-3 text-muted-foreground">{leaveTypeLabel(r.type, t)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : (r.status as string) === 'cancelled' ? 'secondary' : 'warning'}>
                            {(r.status as string) === 'cancelled' ? (language === 'fr' ? 'Annulé' : 'Cancelled') : t(r.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.admin_comment || '—'}</td>
                        <td className="px-4 py-3">
                          {r.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground border-muted-foreground/30 hover:bg-muted"
                              onClick={() => setCancelTarget(r)}
                            >
                              {t('cancel')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
