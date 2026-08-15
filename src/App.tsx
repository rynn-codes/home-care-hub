import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/context/DataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Hiring from "./pages/Hiring";
import Admissions from "./pages/Admissions";
import People from "./pages/People";
import Clients from "./pages/Clients";
import Employees from "./pages/Employees";
import Scheduling from "./pages/Scheduling";
import Billing from "./pages/Billing";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Sops from "./pages/Sops";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import OAuthConsent from "./pages/OAuthConsent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* Everything inside the shell requires a session. The real boundary
                is row level security in the database; this only keeps people out
                of screens they have no right to see. */}
            <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              {/* Joy navigation, section 6. Home keeps "/" as its path; /home redirects to it. */}
              <Route path="/" element={<Dashboard />} />
              <Route path="/home" element={<Navigate to="/" replace />} />

              <Route path="/operations" element={<Operations />} />
              <Route path="/operations/hiring" element={<Hiring />} />

              <Route path="/admissions" element={<Admissions />} />

              <Route path="/people" element={<People />} />
              <Route path="/people/clients" element={<Clients />} />
              <Route path="/people/employees" element={<Employees />} />

              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/sops" element={<Sops />} />
              <Route path="/settings" element={<Settings />} />

              {/* Clients and Employees moved under People. Keep old links working. */}
              <Route path="/clients" element={<Navigate to="/people/clients" replace />} />
              <Route path="/employees" element={<Navigate to="/people/employees" replace />} />
            </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
