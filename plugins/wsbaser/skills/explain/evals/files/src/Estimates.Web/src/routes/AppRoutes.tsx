import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { RequirePermission } from "../auth/RequirePermission";
import { SignInPage } from "../pages/SignInPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { DashboardPage } from "../pages/DashboardPage";
import { CustomerListPage } from "../pages/CustomerListPage";
import { CustomerPage } from "../pages/CustomerPage";
import { EstimateListPage } from "../pages/EstimateListPage";
import { EstimatePage } from "../pages/EstimatePage";
import { NewEstimatePage } from "../pages/NewEstimatePage";
import { InvoiceListPage } from "../pages/InvoiceListPage";
import { InvoicePage } from "../pages/InvoicePage";
import { ReportsPage } from "../pages/ReportsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { UsersPage } from "../pages/UsersPage";

// Route table for the whole web app.
// Pages that need a permission are wrapped in RequirePermission, which redirects to "/"
// when the signed-in user lacks it.
// Pages without the wrapper load for everyone and rely on the API's 403.
const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignInPage />,
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "customers",
        element: <CustomerListPage />,
      },
      {
        path: "customers/:customerId",
        element: <CustomerPage />,
      },
      {
        path: "invoices",
        element: (
          <RequirePermission permission="invoices.read">
            <InvoiceListPage />
          </RequirePermission>
        ),
      },
      {
        path: "invoices/:invoiceId",
        element: (
          <RequirePermission permission="invoices.read">
            <InvoicePage />
          </RequirePermission>
        ),
      },
      {
        path: "reports",
        element: (
          <RequirePermission permission="reports.read">
            <ReportsPage />
          </RequirePermission>
        ),
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "users",
        element: (
          <RequirePermission permission="users.admin">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        path: "estimates",
        element: <EstimateListPage />,
      },
      {
        path: "estimates/new",
        element: <NewEstimatePage />,
      },
      {
        path: "estimates/:estimateId",
        element: <EstimatePage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
