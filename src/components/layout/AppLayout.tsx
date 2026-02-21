import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LayoutDashboard,
  CalendarPlus,
  ClipboardList,
  User,
  CalendarDays,
  Users,
  LogOut,
  Menu,
  X,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import techflowLogo from '@/assets/TechFlow_Logo.png';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { role, profile, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const isAdmin = role === 'admin';

  const employeeLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/new-request', icon: CalendarPlus, label: t('newRequest') },
    { to: '/my-leave', icon: ClipboardList, label: t('myLeave') },
    { to: '/profile', icon: User, label: t('myProfile') },
  ];

  const adminLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/team-calendar', icon: CalendarDays, label: t('teamCalendar') },
    { to: '/employees', icon: Users, label: t('employees') },
    { to: '/profile', icon: User, label: t('myProfile') },
  ];

  const links = isAdmin ? adminLinks : employeeLinks;

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email
    : '';

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-border">
          <img src={techflowLogo} alt="TechFlow" className="h-8 w-auto" />
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Globe className="h-5 w-5" />
            {language === 'en' ? 'Français' : 'English'}
          </button>

          {/* User info */}
          {displayName && (
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </button>
          <img src={techflowLogo} alt="TechFlow" className="h-7 w-auto" />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
