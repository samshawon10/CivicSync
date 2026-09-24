import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathFor } from '../utils/roles.js';
import PageHead from '../components/ui/PageHead.jsx';
import { Button } from '../components/ui/primitives.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const destination = useMemo(() => user ? dashboardPathFor(user.role) : '/login', [user]);
  return <><PageHead title="Page not found" description="The requested CivicSync page could not be found." /><main className="not-found-page" role="main"><div className="not-found-grid" aria-hidden="true" /><div className="not-found-radar" aria-hidden="true"><span className="not-found-radar-ring" /><span className="not-found-radar-ring not-found-radar-ring--two" /><span className="not-found-radar-line" /><Icon name="mapPin" size={24} /></div><p className="not-found-code">404</p><p className="mt-3 text-sm font-semibold uppercase tracking-[.2em] text-civic-600">Page Not Found</p><h1 className="mt-4 max-w-xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">The page you’re looking for doesn’t exist or may have been moved.</h1><p className="mt-4 max-w-md text-sm leading-6 text-slate-600">CivicSync could not find that address. Use the dashboard to return to an active workspace.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button variant="primary" icon="dashboard" onClick={() => navigate(destination)}>Go to dashboard</Button><Button icon="arrowLeft" onClick={() => navigate(-1)}>Go back</Button></div></main></>;
}
