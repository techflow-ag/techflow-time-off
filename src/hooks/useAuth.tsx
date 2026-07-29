import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isRecoveryUrl } from '@/lib/recovery';
import { toast } from '@/hooks/use-toast';
import type { User } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

type AppRole = 'admin' | 'employee';

// Captured synchronously at module load: supabase-js strips the token hash from
// the URL while the app is still on its loading spinner, so reading
// location.hash later (as AppRoutes used to do) misses the recovery flow.
const initialPasswordRecovery =
  typeof window !== 'undefined' &&
  isRecoveryUrl(window.location.hash + window.location.search);

interface AuthContextType {
  user: User | null;
  profile: Tables<'profiles'> | null;
  role: AppRole | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(initialPasswordRecovery);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Deactivated employees are banned at the auth level for new sign-ins;
    // this also evicts any session that was already open.
    if (profileData && profileData.is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setRole(null);
      toast({
        title: 'Compte désactivé / Account deactivated',
        description: 'Contactez votre administrateur. / Contact your administrator.',
        variant: 'destructive',
      });
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    setProfile(profileData);
    setRole(roleData?.role as AppRole ?? 'employee');
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(currentUser.id), 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    // Deactivated employees are banned at the auth level — show a clear message
    const message = error.message.toLowerCase().includes('banned')
      ? 'Compte désactivé. Contactez votre administrateur. / Account deactivated. Contact your administrator.'
      : error.message;
    return { error: new Error(message) };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, passwordRecovery, clearPasswordRecovery, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
