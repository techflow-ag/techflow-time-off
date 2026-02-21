import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { profile, user } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: language === 'fr' ? 'Profil mis à jour' : 'Profile updated',
      });
      setEditing(false);
    }
    setSaving(false);
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
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? '...' : t('save')}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
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
                <p className="font-medium text-foreground">{profile.hire_date || '—'}</p>
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
              <p className="text-sm text-muted-foreground">{t('currentBalance')}</p>
              <p className="text-3xl font-bold text-foreground">{profile.leave_balance}</p>
              <p className="text-sm text-muted-foreground">{t('daysRemaining')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('monthlyAccrual')}</p>
              <p className="text-xl font-semibold text-foreground">+{profile.monthly_accrual}</p>
              <p className="text-sm text-muted-foreground">{t('daysPerMonth')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
