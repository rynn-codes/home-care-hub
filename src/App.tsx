import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

// The standalone demo build (published as a hosted single-file page for
// Karynn to click through) has no server to answer deep links, so routes live
// in the hash and survive a refresh. The dev/production build keeps clean
// paths. Same routes, same screens, one flag.
const Router = import.meta.env.VITE_STANDALONE_DEMO === "true" ? HashRouter : BrowserRouter;
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/context/DataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { DemoDataProvider } from "@/context/DemoDataProvider";
import Home from "./pages/Home";
import TheBrain from "./pages/TheBrain";
import Operations from "./pages/Operations";
import Hiring from "./pages/Hiring";
import PortalActivity from "./pages/PortalActivity";
import Audit from "./pages/Audit";
import EvvLog from "./pages/EvvLog";
import Incidents from "./pages/Incidents";
import IncidentReport from "./pages/IncidentReport";
import Admissions from "./pages/Admissions";
import PhoneIntake from "./pages/PhoneIntake";
import Assessment from "./pages/Assessment";
import AdmissionReview from "./pages/AdmissionReview";
import People from "./pages/People";
import Clients from "./pages/Clients";
import CarePlans from "./pages/CarePlans";
import Supervision from "./pages/Supervision";
import Employees from "./pages/Employees";
import Scheduling from "./pages/Scheduling";
import Billing from "./pages/Billing";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Signing from "./pages/Signing";
import TemplateBuilder from "./pages/TemplateBuilder";
import NewSigningRequest from "./pages/NewSigningRequest";
import SigningRequest from "./pages/SigningRequest";
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
import PortalFamilySign from "./pages/portal/FamilySign";
import PortalDocuments from "./pages/portal/Documents";
import PortalWorkforceHome from "./pages/portal/WorkforceHome";
import PortalEmployeeSchedule from "./pages/portal/EmployeeSchedule";
import PortalVisitScreen from "./pages/portal/VisitScreen";
import { PortalSessionProvider } from "@/context/PortalSessionProvider";
import { RequirePortal } from "@/components/portal/RequirePortal";

const queryClient = new QueryClient();

/** A new screen starts at the top. Hash routing keeps the old scroll otherwise. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataProvider>
        <DemoDataProvider>
        <PortalSessionProvider>
        <Router>
          <ScrollToTop />
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
              <Route path="/portal/care/sign/:id" element={<PortalFamilySign />} />
            </Route>
            {/* Everything inside the shell requires a session. The real boundary
                is row level security in the database; this only keeps people out
                of screens they have no right to see. */}
            <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              {/* Joy navigation, section 6. Home keeps "/" as its path; /home redirects to it. */}
              <Route path="/" element={<Home />} />
              {/* The Brain sits under Home, per the design's own breadcrumb. */}
              <Route path="/brain" element={<TheBrain />} />
              <Route path="/brain/my-work" element={<TheBrain />} />
              <Route path="/brain/operations" element={<TheBrain />} />
              <Route path="/home" element={<Navigate to="/" replace />} />

              {/* Hiring and the reports moved out from under Operations in
                  September; the old paths keep working for bookmarks. */}
              <Route path="/hiring" element={<Hiring />} />
              <Route path="/reports/audit" element={<Audit />} />
              <Route path="/reports/audit/evv" element={<EvvLog />} />
              <Route path="/reports/incidents" element={<Incidents />} />
              <Route path="/reports/incidents/annual" element={<IncidentReport />} />
              <Route path="/reports/supervision" element={<Supervision />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/operations/hiring" element={<Navigate to="/hiring" replace />} />
              <Route path="/operations/portal" element={<PortalActivity />} />
              <Route path="/operations/audit" element={<Navigate to="/reports/audit" replace />} />
              <Route path="/operations/incidents" element={<Navigate to="/reports/incidents" replace />} />
              <Route path="/operations/incidents/annual" element={<Navigate to="/reports/incidents/annual" replace />} />

              <Route path="/admissions" element={<Admissions />} />
              <Route path="/admissions/:id/intake" element={<PhoneIntake />} />
              <Route path="/admissions/:id/assessment" element={<Assessment />} />
              <Route path="/admissions/:id/review" element={<AdmissionReview />} />

              {/* Clients, Employees and People are siblings — see the note in
                  AppSidebar. The client record is a nested route so a link to
                  one person survives a refresh and can be sent to somebody. */}
              <Route path="/clients/care-plans" element={<CarePlans />} />
              <Route path="/clients/supervision" element={<Navigate to="/reports/supervision" replace />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<Clients />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:id" element={<Employees />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<People />} />

              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/documents/signing" element={<Signing />} />
              <Route path="/documents/signing/new" element={<NewSigningRequest />} />
              <Route path="/documents/signing/templates/:id" element={<TemplateBuilder />} />
              <Route path="/documents/signing/:id" element={<SigningRequest />} />
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
        </Router>
        </PortalSessionProvider>
      </DemoDataProvider>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
