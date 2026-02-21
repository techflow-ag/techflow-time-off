import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { computeLeaveBalance, computeHolidayBalance } from '@/lib/leaveBalance';
import { formatDate } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

export default function Profile() {
  const { profile, user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [emailField, setEmailField] = useState(profile?.email || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [approvedPaidDays, setApprovedPaidDays] = useState(0);
  const [approvedHolidayDays, setApprovedHolidayDays] = useState(0);

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

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setEmailField(profile.email || '');
    }
  }, [profile]);

  const paidBalance = profile ? computeLeaveBalance(profile, approvedPaidDays) : 0;
  const holidayBalance = profile ? computeHolidayBalance(profile, approvedHolidayDays) : 0;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', user.id);

    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    if (emailField.trim() !== profile?.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: emailField.trim() });
      if (emailError) {
        toast({ title: 'Error', description: emailError.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      await supabase.from('profiles').update({ email: emailField.trim() }).eq('id', user.id);
      toast({
        title: language === 'fr' ? 'Email de confirmation envoyé' : 'Confirmation email sent',
        description: language === 'fr' ? 'Vérifiez votre boîte mail pour confirmer le changement' : 'Check your inbox to confirm the change',
      });
    }

    toast({ title: language === 'fr' ? 'Profil mis à jour' : 'Profile updated' });
    setEditing(false);
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (newPassword.length < 6) {
      toast({ title: 'Error', description: language === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: language === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInError) {
      toast({ title: 'Error', description: language === 'fr' ? 'Mot de passe actuel incorrect' : 'Current password is incorrect', variant: 'destructive' });
      setChangingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: language === 'fr' ? 'Mot de passe modifié' : 'Password updated' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('myProfile')}</h1>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{language === 'fr' ? 'Informations personnelles' : 'Personal Information'}</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                {language === 'fr' ? 'Modifier' : 'Edit'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('firstName')}</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('lastName')}</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input type="email" value={emailField} onChange={(e) => setEmailField(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? '...' : t('save')}
                </Button>
                <Button variant="outline" onClick={() => { setEditing(false); setEmailField(profile.email); }}>
                  {t('cancel')}
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">{t('firstName')}</p>
                <p className="font-medium text-foreground">{profile.first_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('lastName')}</p>
                <p className="font-medium text-foreground">{profile.last_name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('email')}</p>
                <p className="font-medium text-foreground">{profile.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('hireDate')}</p>
                <p className="font-medium text-foreground">{profile.hire_date ? formatDate(profile.hire_date, language) : '—'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t('leaveBalance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">{t('paidLeave')}</p>
              <p className={`text-3xl font-bold ${paidBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>{paidBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">+{Number(profile.monthly_accrual).toFixed(2)} {t('daysPerMonth')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('publicHoliday')}</p>
              <p className={`text-3xl font-bold ${holidayBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>{holidayBalance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">+{Number(profile.monthly_holiday_accrual).toFixed(2)} {t('daysPerMonth')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password change card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{language === 'fr' ? 'Changer le mot de passe' : 'Change Password'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Mot de passe actuel' : 'Current Password'}</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Nouveau mot de passe' : 'New Password'}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm Password'}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? '...' : (language === 'fr' ? 'Mettre à jour' : 'Update Password')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
