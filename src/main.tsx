import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireSystem } from "@/components/RequireSystem";
import { InstallPrompt } from "@/components/app/InstallPrompt";
import { IosSpinner } from "@/components/ui/IosSpinner";
import { AuthProvider } from "@/hooks/use-auth";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createHashRouter,
  Navigate,
  RouterProvider,
} from "react-router";
import { I18nProvider } from "@/lib/i18n";
import { initOnlineSync, switchUser } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const RegisterPage = lazy(() => import("./pages/Register.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Today = lazy(() => import("./pages/Today.tsx"));
const InboxPage = lazy(() => import("./pages/Inbox.tsx"));
const Tasks = lazy(() => import("./pages/Tasks.tsx"));
const Projects = lazy(() => import("./pages/Projects.tsx"));
const Processes = lazy(() => import("./pages/Processes.tsx"));
const CalendarPage = lazy(() => import("./pages/Calendar.tsx"));
const Habits = lazy(() => import("./pages/Habits.tsx"));
const Goals = lazy(() => import("./pages/Goals.tsx"));
const Progress = lazy(() => import("./pages/Progress.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const SelectSystem = lazy(() => import("./pages/SelectSystem.tsx"));
const ExpenseDashboard = lazy(() => import("./pages/expense/Dashboard.tsx"));
const ExpenseTransactions = lazy(() => import("./pages/expense/Transactions.tsx"));
const ExpenseCategories = lazy(() => import("./pages/expense/Categories.tsx"));
const ExpenseReports = lazy(() => import("./pages/expense/Reports.tsx"));
const ExpenseAccounts = lazy(() => import("./pages/expense/Accounts.tsx"));
const ExpenseRecurring = lazy(() => import("./pages/expense/Recurring.tsx"));
const ExpenseDebts = lazy(() => import("./pages/expense/Debts.tsx"));
const ExpenseSavings = lazy(() => import("./pages/expense/Savings.tsx"));
const SalonDashboard = lazy(() => import("./pages/salon/Dashboard.tsx"));
const SalonPOS = lazy(() => import("./pages/salon/POS.tsx"));
const SalonSales = lazy(() => import("./pages/salon/Sales.tsx"));
const SalonCustomers = lazy(() => import("./pages/salon/Customers.tsx"));
const SalonServices = lazy(() => import("./pages/salon/Services.tsx"));
const SalonProducts = lazy(() => import("./pages/salon/Products.tsx"));
const SalonStaffPage = lazy(() => import("./pages/salon/Staff.tsx"));
const SalonReports = lazy(() => import("./pages/salon/Reports.tsx"));
const SalonSettings = lazy(() => import("./pages/salon/Settings.tsx"));
const BusinessDashboard = lazy(() => import("./pages/business/Dashboard.tsx"));
const BusinessPOS = lazy(() => import("./pages/business/POS.tsx"));
const BusinessSales = lazy(() => import("./pages/business/Sales.tsx"));
const BusinessProducts = lazy(() => import("./pages/business/Products.tsx"));
const BusinessInventory = lazy(() => import("./pages/business/Inventory.tsx"));
const BusinessCustomers = lazy(() => import("./pages/business/Customers.tsx"));
const BusinessSuppliers = lazy(() => import("./pages/business/Suppliers.tsx"));
const BusinessPurchases = lazy(() => import("./pages/business/Purchases.tsx"));
const BusinessExpenses = lazy(() => import("./pages/business/Expenses.tsx"));
const BusinessReports = lazy(() => import("./pages/business/Reports.tsx"));
const BusinessStaff = lazy(() => import("./pages/business/Staff.tsx"));
const BusinessQuotes = lazy(() => import("./pages/business/Quotes.tsx"));
const BusinessSettings = lazy(() => import("./pages/business/Settings.tsx"));
const AdminOverview = lazy(() => import("./pages/admin/Overview.tsx"));
const AdminUsers = lazy(() => import("./pages/admin/Users.tsx"));
const AdminActivity = lazy(() => import("./pages/admin/Activity.tsx"));
const AdminData = lazy(() => import("./pages/admin/Data.tsx"));
const SuperAdminLogin = lazy(() => import("./pages/superadmin/Login.tsx"));
const SuperAdminPanel = lazy(() => import("./pages/superadmin/Panel.tsx"));
const Workspace = lazy(() => import("./pages/workspace/Workspace.tsx"));

// The expense system shares the app Settings page (theme/language/data).
const ExpenseSettings = Settings;

// The single centered loader used for lazy system/page transitions.
function RouteLoading() {
  return (
    <div className="fixed inset-0 z-[80] flex min-h-dvh items-center justify-center bg-background">
      <IosSpinner />
    </div>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Bridges auth state to the local store: each signed-in account gets its own
 * isolated dataset (its own "table") via switchUser(). Signing out returns
 * the app to the shared signed-out dataset. Data also syncs to the Neon
 * Postgres `app_data` table per user (see lib/store.ts).
 */
function UserStoreBridge() {
  const { isLoading, isAuthenticated, user } = useAuth();
  // Key on the stable user id (not the user object, whose identity changes
  // every render) so the store only swaps when the account actually changes.
  const userId = user?._id ?? null;
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && userId) {
      switchUser(userId);
    } else if (!isAuthenticated) {
      switchUser(null);
    }
  }, [isLoading, isAuthenticated, userId]);
  return null;
}

/** App pages share the AppLayout (sidebar / bottom nav / quick add). */
/**
 * Lazy chunks are content-hashed; after a deploy the old HTML/JS in a
 * user's browser may reference chunk files that no longer exist (404 →
 * "Failed to fetch dynamically imported module"). Catch that case and
 * reload once so the fresh app shell takes over.
 */
function ReloadOnNewChunk({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RouteLoading />}>
      <ChunkErrorBoundary>{children}</ChunkErrorBoundary>
    </Suspense>
  );
}

class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    const msg = String(error?.message ?? "");
    const isChunkError =
      msg.includes("dynamically imported module") ||
      msg.includes("Failed to fetch dynamically imported") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Importing a module script failed");
    const alreadyRetried = sessionStorage.getItem("flowday-chunk-reload");
    if (isChunkError && !alreadyRetried) {
      sessionStorage.setItem("flowday-chunk-reload", "1");
      window.location.reload();
    } else if (!isChunkError) {
      // A successful boot should not inherit a stale retry marker into a
      // later, unrelated runtime error.
      sessionStorage.removeItem("flowday-chunk-reload");
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <p className="text-sm font-semibold">Something went wrong</p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/superadmin" element={<SuperAdminLogin />} />
      <Route path="/superadmin/users" element={<SuperAdminPanel />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/workspace"
        element={
          <RequireSystem system="life">
            <Workspace />
          </RequireSystem>
        }
      />
      <Route
        path="/select-system"
        element={
          <RequireAuth>
            <SelectSystem />
          </RequireAuth>
        }
      />

      {/* Life Flow Tracking system */}
      <Route
        path="/life/today"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="today" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/inbox"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="inbox" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/tasks"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="tasks" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/projects"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="projects" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/processes"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="processes" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/calendar"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="calendar" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/habits"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="habits" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/goals"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="goals" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/progress"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="progress" />
          </RequireSystem>
        }
      />
      <Route
        path="/life/settings"
        element={
          <RequireSystem system="life">
            <AppLayoutMount view="settings" />
          </RequireSystem>
        }
      />

      {/* Expense Management system — wrapped in AppLayout so it gets the
          same sidebar / bottom-nav chrome as the Life system. */}
      <Route path="/expense/dashboard" element={<RequireSystem system="expense"><AppLayout><ExpenseDashboard /></AppLayout></RequireSystem>} />
      <Route path="/expense/transactions" element={<RequireSystem system="expense"><AppLayout><ExpenseTransactions /></AppLayout></RequireSystem>} />
      <Route path="/expense/categories" element={<RequireSystem system="expense"><AppLayout><ExpenseCategories /></AppLayout></RequireSystem>} />
      <Route path="/expense/reports" element={<RequireSystem system="expense"><AppLayout><ExpenseReports /></AppLayout></RequireSystem>} />
      <Route path="/expense/accounts" element={<RequireSystem system="expense"><AppLayout><ExpenseAccounts /></AppLayout></RequireSystem>} />
      <Route path="/expense/recurring" element={<RequireSystem system="expense"><AppLayout><ExpenseRecurring /></AppLayout></RequireSystem>} />
      <Route path="/expense/debts" element={<RequireSystem system="expense"><AppLayout><ExpenseDebts /></AppLayout></RequireSystem>} />
      <Route path="/expense/savings" element={<RequireSystem system="expense"><AppLayout><ExpenseSavings /></AppLayout></RequireSystem>} />
      <Route path="/expense/settings" element={<RequireSystem system="expense"><AppLayout><ExpenseSettings /></AppLayout></RequireSystem>} />

      {/* Salon Management system — same AppLayout chrome as the other systems. */}
      <Route path="/salon/dashboard" element={<RequireSystem system="salon"><AppLayout><SalonDashboard /></AppLayout></RequireSystem>} />
      <Route path="/salon/pos" element={<RequireSystem system="salon"><AppLayout><SalonPOS /></AppLayout></RequireSystem>} />
      <Route path="/salon/sales" element={<RequireSystem system="salon"><AppLayout><SalonSales /></AppLayout></RequireSystem>} />
      <Route path="/salon/customers" element={<RequireSystem system="salon"><AppLayout><SalonCustomers /></AppLayout></RequireSystem>} />
      <Route path="/salon/services" element={<RequireSystem system="salon"><AppLayout><SalonServices /></AppLayout></RequireSystem>} />
      <Route path="/salon/products" element={<RequireSystem system="salon"><AppLayout><SalonProducts /></AppLayout></RequireSystem>} />
      <Route path="/salon/staff" element={<RequireSystem system="salon"><AppLayout><SalonStaffPage /></AppLayout></RequireSystem>} />
      <Route path="/salon/reports" element={<RequireSystem system="salon"><AppLayout><SalonReports /></AppLayout></RequireSystem>} />
      <Route path="/salon/settings" element={<RequireSystem system="salon"><AppLayout><SalonSettings /></AppLayout></RequireSystem>} />

      {/* Business Management / POS system — same AppLayout chrome as Life. */}
      <Route path="/business/dashboard" element={<RequireSystem system="business"><AppLayout><BusinessDashboard /></AppLayout></RequireSystem>} />
      <Route path="/business/pos" element={<RequireSystem system="business"><AppLayout><BusinessPOS /></AppLayout></RequireSystem>} />
      <Route path="/business/sales" element={<RequireSystem system="business"><AppLayout><BusinessSales /></AppLayout></RequireSystem>} />
      <Route path="/business/products" element={<RequireSystem system="business"><AppLayout><BusinessProducts /></AppLayout></RequireSystem>} />
      <Route path="/business/inventory" element={<RequireSystem system="business"><AppLayout><BusinessInventory /></AppLayout></RequireSystem>} />
      <Route path="/business/customers" element={<RequireSystem system="business"><AppLayout><BusinessCustomers /></AppLayout></RequireSystem>} />
      <Route path="/business/suppliers" element={<RequireSystem system="business"><AppLayout><BusinessSuppliers /></AppLayout></RequireSystem>} />
      <Route path="/business/purchases" element={<RequireSystem system="business"><AppLayout><BusinessPurchases /></AppLayout></RequireSystem>} />
      <Route path="/business/expenses" element={<RequireSystem system="business"><AppLayout><BusinessExpenses /></AppLayout></RequireSystem>} />
      <Route path="/business/reports" element={<RequireSystem system="business"><AppLayout><BusinessReports /></AppLayout></RequireSystem>} />
      <Route path="/business/staff" element={<RequireSystem system="business"><AppLayout><BusinessStaff /></AppLayout></RequireSystem>} />
      <Route path="/business/quotes" element={<RequireSystem system="business"><AppLayout><BusinessQuotes /></AppLayout></RequireSystem>} />
      <Route path="/business/settings" element={<RequireSystem system="business"><AppLayout><BusinessSettings /></AppLayout></RequireSystem>} />

      {/* Admin / Owner tools — cross-system oversight (read-only) */}
      <Route path="/admin/overview" element={<RequireSystem system="admin"><AppLayout><AdminOverview /></AppLayout></RequireSystem>} />
      <Route path="/admin/users" element={<RequireSystem system="admin"><AppLayout><AdminUsers /></AppLayout></RequireSystem>} />
      <Route path="/admin/activity" element={<RequireSystem system="admin"><AppLayout><AdminActivity /></AppLayout></RequireSystem>} />
      <Route path="/admin/data" element={<RequireSystem system="admin"><AppLayout><AdminData /></AppLayout></RequireSystem>} />
      <Route path="/admin/settings" element={<RequireSystem system="admin"><AppLayout><Settings /></AppLayout></RequireSystem>} />

      {/* System roots: SelectSystem and the sidebar logo navigate to these,
          so they must redirect into the system's default page. */}
      <Route path="/life" element={<Navigate to="/life/today" replace />} />
      <Route path="/expense" element={<Navigate to="/expense/dashboard" replace />} />
      <Route path="/salon" element={<Navigate to="/salon/dashboard" replace />} />
      <Route path="/business" element={<Navigate to="/business/dashboard" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />

      {/* Legacy paths (bookmarks / installed PWA shortcuts) → new system routes */}
      {[
        ["/today", "/life/today"],
        ["/inbox", "/life/inbox"],
        ["/tasks", "/life/tasks"],
        ["/projects", "/life/projects"],
        ["/processes", "/life/processes"],
        ["/calendar", "/life/calendar"],
        ["/habits", "/life/habits"],
        ["/goals", "/life/goals"],
        ["/progress", "/life/progress"],
        ["/settings", "/life/settings"],
      ].map(([from, to]) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Imported after AppRoutes definition to avoid circular import confusion.
import { AppLayout } from "@/components/app/AppLayout";
import { Routes, Route } from "react-router";

/** Renders the AppLayout chrome around the active page. */
function AppLayoutMount({ view }: { view: string }) {
  const page = (() => {
    switch (view) {
      case "today":
        return <Today />;
      case "inbox":
        return <InboxPage />;
      case "tasks":
        return <Tasks />;
      case "projects":
        return <Projects />;
      case "processes":
        return <Processes />;
      case "calendar":
        return <CalendarPage />;
      case "habits":
        return <Habits />;
      case "goals":
        return <Goals />;
      case "progress":
        return <Progress />;
      case "settings":
        return <Settings />;
      default:
        return <Today />;
    }
  })();
  return <AppLayout>{page}</AppLayout>;
}

/**
 * Registers the service worker (offline support) and the online/offline
 * listeners (auto re-sync when connectivity returns).
 */
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Relative path so the SW also works under a GitHub Pages subpath.
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration skipped:", err);
      });
    }
    return initOnlineSync();
  }, []);
  return null;
}

function Root() {
  return (
    <AuthProvider>
      <I18nProvider>
        <RouterProvider router={router} />
        <Toaster />
      </I18nProvider>
    </AuthProvider>
  );
}

/**
 * Hash router: GitHub Pages serves static files with no server-side routing,
 * so /today lives at /#/today. Works identically in local dev.
 */
const router = createHashRouter([
  {
    path: "/*",
    element: (
      <ReloadOnNewChunk>
        <ServiceWorkerRegistrar />
        <UserStoreBridge />
        <InstallPrompt />
        <AppRoutes />
      </ReloadOnNewChunk>
    ),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <Root />
    </RootErrorBoundary>
  </StrictMode>,
);
