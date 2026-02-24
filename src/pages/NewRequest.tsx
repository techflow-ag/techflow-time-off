import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { calculateBusinessDays, cn, formatDate, toLocalDateString } from '@/lib/utils';
import { computeLeaveBalance, computeHolidayBalance } from '@/lib/leaveBalance';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type LeaveType = Database['public']['Enums']['leave_type'];

export default function NewRequest() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [leaveType, setLeaveType] = useState<LeaveType>('paid_leave');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvedPaidDays, setApprovedPaidDays] = useState(0);
  const [approvedHolidayDays, setApprovedHolidayDays] = useState(0);
  const [showNegativeWarning, setShowNegativeWarning] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('leave_requests')
      .select('number_of_days, type')
      .eq('employee_id', user.id)
      .eq('status', 'approved')
      .in('type', ['paid_leave', 'public_holiday'])
      .then(({ data }) => {
        const paid = (data || []).filter(r => r.type === 'paid_leave').reduce((sum, r) => sum + Number(r.number_of_days), 0);
        const holiday = (data || []).filter(r => r.type === 'public_holiday').reduce((sum, r) => sum + Number(r.number_of_days), 0);
        setApprovedPaidDays(paid);
        setApprovedHolidayDays(holiday);
      });
  }, [user]);

  const paidBalance = profile ? computeLeaveBalance(profile, approvedPaidDays) : 0;
  const holidayBalance = profile ? computeHolidayBalance(profile, approvedHolidayDays) : 0;
  const businessDays = startDate && endDate ? calculateBusinessDays(startDate, endDate) : 0;

  const currentBalance = leaveType === 'paid_leave' ? paidBalance : leaveType === 'public_holiday' ? holidayBalance : null;
  const willBeNegative = currentBalance !== null && (currentBalance - businessDays) < 0;
  const newBalance = currentBalance !== null ? currentBalance - businessDays : null;

  const doSubmit = async () => {
    if (!user || !startDate || !endDate || businessDays <= 0) return;

    setLoading(true);
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: user.id,
      start_date: toLocalDateString(startDate),
      end_date: toLocalDateString(endDate),
      number_of_days: businessDays,
      type: leaveType,
      reason: reason.trim() || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      // Notify admins (fire-and-forget)
      const employeeName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Employee';
      supabase.functions.invoke('notify-leave-request', {
        body: {
          employeeName,
          leaveType,
          startDate: toLocalDateString(startDate!),
          endDate: toLocalDateString(endDate!),
          numberOfDays: businessDays,
          reason: reason.trim() || null,
        },
      }).catch(console.error);

      toast({
        title: language === 'fr' ? 'Demande soumise' : 'Request submitted',
        description: language === 'fr' ? 'Votre demande a été envoyée' : 'Your request has been sent for review',
      });
      navigate(profile ? '/my-leave' : '/dashboard');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startDate || !endDate || businessDays <= 0) return;

    if (willBeNegative) {
      setShowNegativeWarning(true);
      return;
    }

    doSubmit();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('newRequest')}</h1>

      {/* Negative balance warning dialog */}
      <AlertDialog open={showNegativeWarning} onOpenChange={setShowNegativeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {language === 'fr' ? 'Solde négatif' : 'Negative Balance Warning'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? `Cette demande rendra votre solde négatif (${newBalance?.toFixed(2)} jours). Votre solde sera rétabli au fur et à mesure de vos cumuls mensuels.`
                : `This request will make your balance negative (${newBalance?.toFixed(2)} days). Your balance will recover as you accrue leave in the coming months.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit}>
              {language === 'fr' ? "J'ai compris" : 'I understand'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('submitRequest')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date pickers */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? formatDate(startDate, language) : t('pickDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => {
                        setStartDate(d);
                        if (d && endDate && d > endDate) setEndDate(undefined);
                      }}
                      disabled={(date) => date.getDay() === 0 || date.getDay() === 6}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? formatDate(endDate, language) : t('pickDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) =>
                        date.getDay() === 0 || date.getDay() === 6 || (startDate ? date < startDate : false)
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Business days display */}
            {businessDays > 0 && (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">{t('businessDays')}</p>
                <p className="text-3xl font-bold text-foreground">{businessDays}</p>
              </div>
            )}

            {/* Balance warning */}
            {willBeNegative && businessDays > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {language === 'fr'
                  ? `Attention : votre solde sera négatif (${newBalance?.toFixed(2)} jours)`
                  : `Warning: your balance will be negative (${newBalance?.toFixed(2)} days)`}
              </div>
            )}

            {/* Leave type */}
            <div className="space-y-2">
              <Label>{t('leaveType')}</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid_leave">
                    {t('paidLeave')} — <span className={paidBalance < 0 ? 'text-destructive' : ''}>{paidBalance.toFixed(2)} {t('daysRemaining')}</span>
                  </SelectItem>
                  <SelectItem value="public_holiday">
                    {t('publicHoliday')} — <span className={holidayBalance < 0 ? 'text-destructive' : ''}>{holidayBalance.toFixed(2)} {t('daysRemaining')}</span>
                  </SelectItem>
                  <SelectItem value="sick_leave">{t('sickLeave')}</SelectItem>
                  <SelectItem value="unpaid_leave">{t('unpaidLeave')}</SelectItem>
                  <SelectItem value="other">{t('other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Textarea
                placeholder={t('reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !startDate || !endDate || businessDays <= 0}>
              {loading ? '...' : t('submitRequest')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
