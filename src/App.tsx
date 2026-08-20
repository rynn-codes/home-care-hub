import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/context/DataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { DemoDataProvider } from "@/context/DemoDataProvider";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Hiring from "./pages/Hiring";
import Admissions from "./pages/Admissions";
import PhoneIntake from "./pages/PhoneIntake";
import Assessment from "./pages/Assessment";
import AdmissionReview from "./pages/AdmissionReview";
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
import PortalApplication from "./pages/portal/Application";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalChoose from "./pages/portal/PortalChoose";
import PortalClosed from "./pages/portal/PortalClosed";
import PortalFamilyHome from "./pages/portal/FamilyHome";
import PortalFamilyMoments from "./pages/portal/FamilyMoments";
import PortalFamilyDocuments from "./pages/portal/FamilyDocuments";
import PortalDocuments from "./pages/portal/Documents";
import PortalWorkforceHome from "./pages/portal/WorkforceHome";
import PortalEmployeeSchedule from "./pages/portal/EmployeeSchedule";
import PortalVisitScreen from "./pages/portal/VisitScreen";
import { PortalSessionProvider } from "@/context/PortalSessionProvider";
import { RequirePortal } from "@/components/portal/RequirePortal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataProvider>
        <DemoDataProvider>
        <PortalSessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

            {/* The portal sits outside the admin shell entirely — §1: "Do not
                force caregivers or families into the CEO/admin dashboard." It
                is outside RequireAuth too, deliberately: a candidate is not a
                Supabase user. They hold a portal grant proven by phone OTP,
                and RequirePortal is that boundary. */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/choose" element={<PortalChoose />} />
            <Route path="/portal/closed" element={<PortalClosed />} />

            <Route element={<RequirePortal audience="workforce" />}>
              {/* §6 and §7: one identity, one portal, changing state. What
                  /portal/work shows is decided by the grant, not by the URL,
                  so a caregiver's bookmark survives being hired. */}
              <Route path="/portal/work" element={<PortalWorkforceHome />} />
              <Route path="/portal/work/application" element={<PortalApplication />} />
              <Route path="/portal/work/documents" element={<PortalDocuments />} />
              <Route path="/portal/work/schedule" element={<PortalEmployeeSchedule />} />
              <Route path="/portal/work/visit/:id" element={<PortalVisitScreen />} />
            </Route>

            {/* §18–24, the client and family side. Same guard, different
                audience — a workforce grant does not open these. */}
            <Route element={<RequirePortal audience="family" />}>
              <Route path="/portal/care" element={<PortalFamilyHome />} />
              <Route path="/portal/care/moments" element={<PortalFamilyMoments />} />
              <Route path="/portal/care/documents" element={<PortalFamilyDocuments />} />
            </Route>
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
              <Route path="/admissions/:id/intake" element={<PhoneIntake />} />
              <Route path="/admissions/:id/assessment" element={<Assessment />} />
              <Route path="/admissions/:id/review" element={<AdmissionReview />} />

              {/* Clients, Employees and People are siblings — see the note in
                  AppSidebar. The client record is a nested route so a link to
                  one person survives a refresh and can be sent to somebody. */}
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<Clients />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:id" element={<Employees />} />
              <Route path="/people" element={<People />} />

              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/sops" element={<Sops />} />
              <Route path="/settings" element={<Settings />} />

              {/* Clients and Employees moved back out of People. Keep the
                  intermediate links working rather than 404ing a bookmark. */}
              <Route path="/people/clients" element={<Navigate to="/clients" replace />} />
              <Route path="/people/employees" element={<Navigate to="/employees" replace />} />
            </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </PortalSessionProvider>
      </DemoDataProvider>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
