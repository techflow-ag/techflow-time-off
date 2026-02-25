import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { UserPlus, Pencil, Trash2, KeyRound } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { computeLeaveBalance, computeHolidayBalance } from '@/lib/leaveBalance';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type ApprovedLeave = {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
};

export default function EmployeeManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Tables<'profiles'>[]>([]);
  const [approvedPaidMap, setApprovedPaidMap] = useState<Record<string, number>>({});
  const [approvedHolidayMap, setApprovedHolidayMap] = useState<Record<string, number>>({});
  const [totalLeaveTaken, setTotalLeaveTaken] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Tables<'profiles'> | null>(null);
  const [editForm, setEditForm] = useState({ email: '', hireDate: '', monthlyAccrual: '1.5', monthlyHolidayAccrual: '1.08' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tables<'profiles'> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [detailProfile, setDetailProfile] = useState<Tables<'profiles'> | null>(null);
  const [detailLeaves, setDetailLeaves] = useState<ApprovedLeave[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    hireDate: '',
    initialBalance: '0',
  });
  const [inviting, setInviting] = useState(false);

  const openDetail = async (profile: Tables<'profiles'>) => {
    setDetailProfile(profile);
    setDetailOpen(true);
    const { data } = await supabase
      .from('leave_requests')
      .select('id, type, start_date, end_date, number_of_days')
      .eq('employee_id', profile.id)
      .eq('status', 'approved')
      .order('start_date', { ascending: false });
    setDetailLeaves((data as ApprovedLeave[]) || []);
  };

  const fetchProfiles = async () => {
    const [profRes, leaveRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('employee_id, number_of_days, type, status'),
    ]);
    setProfiles(profRes.data || []);
    
    const paidMap: Record<string, number> = {};
    const holidayMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};
    (leaveRes.data || []).forEach((r) => {
      if (r.status === 'approved') {
        if (r.type === 'paid_leave') {
          paidMap[r.employee_id] = (paidMap[r.employee_id] || 0) + Number(r.number_of_days);
        }
        if (r.type === 'public_holiday') {
          holidayMap[r.employee_id] = (holidayMap[r.employee_id] || 0) + Number(r.number_of_days);
        }
        totalMap[r.employee_id] = (totalMap[r.employee_id] || 0) + Number(r.number_of_days);
      }
    });
    setApprovedPaidMap(paidMap);
    setApprovedHolidayMap(holidayMap);
    setTotalLeaveTaken(totalMap);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) return;
    setInviting(true);

    const { data, error } = await supabase.functions.invoke('invite-employee', {
      body: {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        hireDate: form.hireDate || null,
        initialBalance: 0,
      },
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({
        title: language === 'fr' ? 'Employé ajouté' : 'Employee added',
        description: language === 'fr' ? 'Invitation envoyée par email' : 'Invitation email sent',
      });
      setDialogOpen(false);
      setForm({ firstName: '', lastName: '', email: '', hireDate: '', initialBalance: '0' });
      fetchProfiles();
    }
    setInviting(false);
  };

  const openEdit = (profile: Tables<'profiles'>) => {
    setEditingProfile(profile);
    setEditForm({
      email: profile.email,
      hireDate: profile.hire_date || '',
      monthlyAccrual: String(profile.monthly_accrual ?? 1.5),
      monthlyHolidayAccrual: String(profile.monthly_holiday_accrual ?? 1.08),
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setSaving(true);

    const { data, error } = await supabase.functions.invoke('update-employee', {
      body: {
        userId: editingProfile.id,
        email: editForm.email.trim(),
        hireDate: editForm.hireDate || null,
        monthlyAccrual: parseFloat(editForm.monthlyAccrual) || 1.5,
        monthlyHolidayAccrual: parseFloat(editForm.monthlyHolidayAccrual) || 1.08,
      },
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: language === 'fr' ? 'Employé modifié' : 'Employee updated' });
      setEditDialogOpen(false);
      fetchProfiles();
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!editingProfile) return;
    setResettingPassword(true);
    const { error } = await supabase.auth.resetPasswordForEmail(editingProfile.email, {
      redirectTo: window.location.origin,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: language === 'fr' ? 'Email envoyé' : 'Email sent',
        description: language === 'fr' ? 'Un email de réinitialisation a été envoyé à l\'employé' : 'A password reset email has been sent to the employee',
      });
    }
    setResettingPassword(false);
  };

  const toggleActive = async (profile: Tables<'profiles'>) => {
    await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id);
    fetchProfiles();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { data, error } = await supabase.functions.invoke('update-employee', {
      body: { userId: deleteTarget.id, action: 'delete' },
    });

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: language === 'fr' ? 'Employé supprimé' : 'Employee deleted' });
      fetchProfiles();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('employees')}</h1>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {t('addEmployee')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addEmployee')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('firstName')}</Label>
                  <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>{t('lastName')}</Label>
                  <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>{t('hireDate')}</Label>
                <Input type="date" value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" disabled={inviting}>
                {inviting ? '...' : t('sendInvite')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editEmployee')}{editingProfile ? ` — ${editingProfile.first_name} ${editingProfile.last_name}` : ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('email')}</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>{t('hireDate')}</Label>
              <Input type="date" value={editForm.hireDate} onChange={(e) => setEditForm((f) => ({ ...f, hireDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('paidLeave')} — {t('monthlyAccrual')} ({t('daysPerMonth')})</Label>
              <Input type="number" step="0.01" min="0" value={editForm.monthlyAccrual} onChange={(e) => setEditForm((f) => ({ ...f, monthlyAccrual: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('publicHoliday')} — {t('monthlyAccrual')} ({t('daysPerMonth')})</Label>
              <Input type="number" step="0.01" min="0" value={editForm.monthlyHolidayAccrual} onChange={(e) => setEditForm((f) => ({ ...f, monthlyHolidayAccrual: e.target.value }))} />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full text-muted-foreground"
              onClick={handleResetPassword}
              disabled={resettingPassword}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {resettingPassword ? '...' : (language === 'fr' ? 'Réinitialiser le mot de passe' : 'Reset Password')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? '...' : t('save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'fr' ? 'Supprimer cet employé ?' : 'Delete this employee?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr'
                ? `Cette action supprimera définitivement ${deleteTarget?.first_name} ${deleteTarget?.last_name} et toutes ses données.`
                : `This will permanently delete ${deleteTarget?.first_name} ${deleteTarget?.last_name} and all their data.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? '...' : (language === 'fr' ? 'Supprimer' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('employee')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('email')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('hireDate')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('paidLeave')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('publicHoliday')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{language === 'fr' ? 'Total congés pris' : 'Total Leave Taken'}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const paidBalance = computeLeaveBalance(p, approvedPaidMap[p.id] || 0);
                  const holidayBal = computeHolidayBalance(p, approvedHolidayMap[p.id] || 0);
                  const totalTaken = totalLeaveTaken[p.id] || 0;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(p)}>
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          {p.first_name} {p.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.hire_date ? formatDate(p.hire_date, language) : '—'}
                      </td>
                      <td className={`px-4 py-3 font-medium ${paidBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {paidBalance.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 font-medium ${holidayBal < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {holidayBal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{totalTaken.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_active ? 'success' : 'secondary'}>
                          {p.is_active ? t('active') : t('inactive')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                            {p.is_active ? t('deactivate') : t('activate')}
                          </Button>
                          {!p.is_active && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(p)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Leave Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailProfile ? `${detailProfile.first_name} ${detailProfile.last_name}` : ''} — {language === 'fr' ? 'Congés approuvés' : 'Approved Leaves'}
            </DialogTitle>
          </DialogHeader>
          {detailLeaves.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">{language === 'fr' ? 'Aucun congé approuvé.' : 'No approved leaves.'}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('startDate')}</TableHead>
                    <TableHead>{t('endDate')}</TableHead>
                    <TableHead className="text-right">{language === 'fr' ? 'Jours' : 'Days'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailLeaves.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant="outline">{t(l.type as any)}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(l.start_date, language)}</TableCell>
                      <TableCell>{formatDate(l.end_date, language)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(l.number_of_days).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t pt-3 mt-2">
                <span className="font-semibold text-foreground">
                  {language === 'fr' ? 'Total' : 'Total'}: {detailLeaves.reduce((s, l) => s + Number(l.number_of_days), 0).toFixed(1)} {language === 'fr' ? 'jours' : 'days'}
                </span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
