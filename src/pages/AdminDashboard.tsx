import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Users, Clock, CalendarDays, TrendingUp } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type RequestWithProfile = Tables<'leave_requests'> & {
  profiles: Tables<'profiles'> | null;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Tables<'profiles'>[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = async () => {
    const [reqRes, profRes] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('*, profiles!leave_requests_employee_id_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    setRequests((reqRes.data as RequestWithProfile[]) || []);
    setProfiles(profRes.data || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const onLeaveToday = profiles.filter((p) =>
    requests.some(
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t('dashboard')}</h1>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="text-3xl font-bold text-foreground">{requests.length}</div>
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

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('leaveBalance')}</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {profiles.reduce((sum, p) => sum + (p.leave_balance || 0), 0).toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground">{t('daysRemaining')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending requests */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('pendingRequests')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">{t('noRequests')}</p>
          ) : (
            requests.map((r) => (
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
                      {t(r.type === 'paid_leave' ? 'paidLeave' : r.type === 'sick_leave' ? 'sickLeave' : r.type === 'unpaid_leave' ? 'unpaidLeave' : 'other')}
                    </Badge>
                    {r.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('currentBalance')}: {r.profiles?.leave_balance} {t('daysRemaining')}
                    </p>
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
