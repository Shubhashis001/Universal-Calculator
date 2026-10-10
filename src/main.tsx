import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
const App = lazy(() => import('./App.tsx'));
const AdminPanel = lazy(() => import('./admin/AdminPanel.tsx'));
const adminRoute = window.location.pathname === '/admin' || window.location.pathname === '/admin/';
if (adminRoute) {
  const robots = document.createElement('meta');
  robots.name = 'robots'; robots.content = 'noindex,nofollow';
  document.head.append(robots);
  document.title = 'Administration | Universal Calculator';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {adminRoute ? <Suspense fallback={<div role="status" style={{ padding: 24 }}>Opening admin workspace…</div>}><AdminPanel /></Suspense> : <App />}
  </StrictMode>
);
