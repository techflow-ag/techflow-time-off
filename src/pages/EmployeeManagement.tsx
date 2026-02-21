import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

export default function EmployeeManagement() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Tables<'profiles'>[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    hireDate: '',
    initialBalance: '25',
  });
  const [inviting, setInviting] = useState(false);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(data || []);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) return;
    setInviting(true);

    // Use Supabase admin invite (via edge function in production)
    // For now, create user with signUp and metadata
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: crypto.randomUUID(), // temp password, user will set via invite link
      options: {
        data: {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
        },
      },
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else if (data.user) {
      // Update profile with additional info
      await supabase
        .from('profiles')
        .update({
          hire_date: form.hireDate || null,
          leave_balance: parseFloat(form.initialBalance) || 25,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
        })
        .eq('id', data.user.id);

      toast({
        title: language === 'fr' ? 'Employé ajouté' : 'Employee added',
        description: language === 'fr' ? 'Invitation envoyée' : 'Invitation sent',
      });
      setDialogOpen(false);
      setForm({ firstName: '', lastName: '', email: '', hireDate: '', initialBalance: '25' });
      fetchProfiles();
    }
    setInviting(false);
  };

  const toggleActive = async (profile: Tables<'profiles'>) => {
    await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id);
    fetchProfiles();
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
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('lastName')}</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('hireDate')}</Label>
                  <Input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('initialBalance')}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.initialBalance}
                    onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={inviting}>
                {inviting ? '...' : t('sendInvite')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('employee')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('email')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('hireDate')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('leaveBalance')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t('status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.hire_date ? formatDate(p.hire_date, language) : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">{p.leave_balance}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.is_active ? 'success' : 'secondary'}>
                        {p.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                        {p.is_active ? t('deactivate') : t('activate')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
