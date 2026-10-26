import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import HomePage from "./pages/HomePage.jsx";
import BillsPage from "./pages/BillsPage.jsx";
import BillDetailPage from "./pages/BillDetailPage.jsx";
import MembersPage from "./pages/MembersPage.jsx";
import MemberDetailPage from "./pages/MemberDetailPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";

function PageLayout() {
  return (
    <main className="container page">
      <Outlet />
    </main>
  );
}

export default function App() {
  const isHome = useLocation().pathname === "/";

  return (
    <>
      <Header overlay={isHome} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<PageLayout />}>
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/bills/:congress/:type/:number" element={<BillDetailPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:bioguideId" element={<MemberDetailPage />} />
          <Route
            path="/tracking"
            element={<PlaceholderPage title="Tracking" text="Log in to follow bills and members and get notified when they change." />}
          />
          <Route
            path="/login"
            element={<PlaceholderPage title="Log in" text="Firebase Authentication is coming soon." />}
          />
          <Route
            path="/subscribe"
            element={<PlaceholderPage title="Subscribe" text="Email updates on the bills you follow are coming soon." />}
          />
          <Route path="*" element={<PlaceholderPage title="Page not found" />} />
        </Route>
      </Routes>
    </>
  );
}
