import { useState } from 'react';
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
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { calculateBusinessDays, cn, formatDate } from '@/lib/utils';
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

  const businessDays = startDate && endDate ? calculateBusinessDays(startDate, endDate) : 0;
  const exceedsBalance = leaveType === 'paid_leave' && businessDays > (profile?.leave_balance ?? 0);
  const isPastDate = startDate && startDate < new Date(new Date().toDateString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !startDate || !endDate || businessDays <= 0) return;

    setLoading(true);
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: user.id,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      number_of_days: businessDays,
      type: leaveType,
      reason: reason.trim() || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: language === 'fr' ? 'Demande soumise' : 'Request submitted',
        description: language === 'fr' ? 'Votre demande a été envoyée' : 'Your request has been sent for review',
      });
      navigate(profile ? '/my-leave' : '/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('newRequest')}</h1>

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
                {isPastDate && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {t('pastDateError')}
                  </p>
                )}
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
            {exceedsBalance && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('balanceWarning')} ({profile?.leave_balance} {t('daysRemaining')})
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
                  <SelectItem value="paid_leave">{t('paidLeave')}</SelectItem>
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
