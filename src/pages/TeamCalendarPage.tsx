import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type LeaveWithProfile = Tables<'leave_requests'> & {
  profiles: Tables<'profiles'> | null;
};

const COLORS = [
  'bg-primary/20 text-primary',
  'bg-success/20 text-success',
  'bg-warning/20 text-warning',
  'bg-destructive/20 text-destructive',
  'bg-secondary/20 text-secondary',
];

export default function TeamCalendarPage() {
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveWithProfile[]>([]);

  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    supabase
      .from('leave_requests')
      .select('*, profiles!leave_requests_employee_id_fkey(*)')
      .eq('status', 'approved')
      .lte('start_date', lastDay)
      .gte('end_date', firstDay)
      .then(({ data }) => setLeaves((data as LeaveWithProfile[]) || []));
  }, [currentMonth]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = currentMonth.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  const dayNames = language === 'fr'
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = 0; i < adjustedFirstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const employeeColorMap = new Map<string, string>();
  let colorIdx = 0;
  leaves.forEach((l) => {
    if (l.profiles && !employeeColorMap.has(l.employee_id)) {
      employeeColorMap.set(l.employee_id, COLORS[colorIdx % COLORS.length]);
      colorIdx++;
    }
  });

  const getLeavesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter((l) => l.start_date <= dateStr && l.end_date >= dateStr);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('teamCalendar')}</h1>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month - 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="capitalize">{monthName}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(year, month + 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {dayNames.map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const dayLeaves = day ? getLeavesForDay(day) : [];
              const isWeekend = idx % 7 >= 5;
              return (
                <div
                  key={idx}
                  className={`min-h-[80px] rounded-md border border-border p-1 text-sm ${
                    isWeekend ? 'bg-muted/50' : 'bg-card'
                  }`}
                >
                  {day && (
                    <>
                      <span className="text-xs text-muted-foreground">{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayLeaves.map((l) => (
                          <div
                            key={l.id}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${employeeColorMap.get(l.employee_id) || ''}`}
                          >
                            {l.profiles?.first_name} {l.profiles?.last_name?.charAt(0)}.
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {leaves.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {Array.from(employeeColorMap.entries()).map(([empId, color]) => {
                const leave = leaves.find((l) => l.employee_id === empId);
                return (
                  <div key={empId} className="flex items-center gap-1.5 text-xs">
                    <span className={`inline-block h-3 w-3 rounded ${color.split(' ')[0]}`} />
                    {leave?.profiles?.first_name} {leave?.profiles?.last_name}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
