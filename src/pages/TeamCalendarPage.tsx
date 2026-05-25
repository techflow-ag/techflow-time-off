import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalDateString } from '@/lib/utils';
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
  'bg-blue-500/20 text-blue-600',
  'bg-pink-500/20 text-pink-600',
  'bg-teal-500/20 text-teal-600',
  'bg-orange-500/20 text-orange-600',
  'bg-violet-500/20 text-violet-600',
];

export default function TeamCalendarPage() {
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [leaves, setLeaves] = useState<LeaveWithProfile[]>([]);
  const [allEmployees, setAllEmployees] = useState<Tables<'profiles'>[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  // Fetch all active employees once
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
      .then(({ data }) => {
        const employees = data || [];
        setAllEmployees(employees);
        setSelectedEmployees(new Set(employees.map((e) => e.id)));
      });
  }, []);

  // Fetch leaves for current month
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = toLocalDateString(new Date(year, month, 1));
    const lastDay = toLocalDateString(new Date(year, month + 1, 0));

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

  const calendarDays: (number | null)[] = [];
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = 0; i < adjustedFirstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // Assign a stable color to every employee (not just those with leaves)
  const employeeColorMap = new Map<string, string>();
  allEmployees.forEach((emp, idx) => {
    employeeColorMap.set(emp.id, COLORS[idx % COLORS.length]);
  });

  const allSelected = selectedEmployees.size === allEmployees.length;

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(allEmployees.map((e) => e.id)));
    }
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getLeavesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.filter(
      (l) => l.start_date <= dateStr && l.end_date >= dateStr && selectedEmployees.has(l.employee_id)
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('teamVacationCalendar')}</h1>

      {/* Employee filter */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {language === 'fr' ? 'Filtrer par employé' : 'Filter by employee'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {/* Select all */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all" className="cursor-pointer text-sm font-medium">
                {language === 'fr' ? 'Toute l\'équipe' : 'Entire team'}
              </Label>
            </div>

            <div className="w-px bg-border h-5 self-center" />

            {allEmployees.map((emp) => {
              const color = employeeColorMap.get(emp.id) || '';
              return (
                <div key={emp.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`emp-${emp.id}`}
                    checked={selectedEmployees.has(emp.id)}
                    onCheckedChange={() => toggleEmployee(emp.id)}
                  />
                  <Label htmlFor={`emp-${emp.id}`} className="cursor-pointer text-sm flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color.split(' ')[0]}`} />
                    {emp.first_name} {emp.last_name}
                  </Label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
                  className={`min-h-[80px] rounded-md border p-1 text-sm ${
                    day && isToday(day)
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : isWeekend ? 'border-border bg-muted/50' : 'border-border bg-card'
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-medium ${isToday(day) ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{day}</span>
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

          {/* Legend — all employees, always visible */}
          {allEmployees.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {allEmployees
                .filter((emp) => selectedEmployees.has(emp.id))
                .map((emp) => {
                  const color = employeeColorMap.get(emp.id) || '';
                  return (
                    <div key={emp.id} className="flex items-center gap-1.5 text-xs">
                      <span className={`inline-block h-3 w-3 rounded ${color.split(' ')[0]}`} />
                      {emp.first_name} {emp.last_name}
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
