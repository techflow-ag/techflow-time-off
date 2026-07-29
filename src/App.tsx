import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import EmployeeDashboard from "@/pages/EmployeeDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import NewRequest from "@/pages/NewRequest";
import LeaveHistory from "@/pages/LeaveHistory";
import TeamCalendarPage from "@/pages/TeamCalendarPage";
import EmployeeManagement from "@/pages/EmployeeManagement";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading, passwordRecovery } = useAuth();

  // Recovery/invite flow: the flag is captured before supabase-js strips the
  // token hash from the URL, and survives until the password is actually set.
  // Checked before `loading` so the user never sees a flash of the dashboard.
  if (passwordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<SetPassword />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <AppLayout>
      <Routes>
        <Route
          path="/dashboard"
          element={isAdmin ? <AdminDashboard /> : <EmployeeDashboard />}
        />
        <Route path="/new-request" element={<NewRequest />} />
        <Route path="/my-leave" element={<LeaveHistory />} />
        <Route path="/leave-requests" element={<Navigate to="/dashboard" />} />
        <Route path="/team-calendar" element={isAdmin ? <TeamCalendarPage /> : <Navigate to="/dashboard" />} />
        <Route path="/employees" element={isAdmin ? <EmployeeManagement /> : <Navigate to="/dashboard" />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
