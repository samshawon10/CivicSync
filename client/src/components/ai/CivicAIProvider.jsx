
import { createContext, useContext, lazy, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../ui/primitives.jsx';
import { useCivicAI } from './useCivicAI.js';

const CivicAICopilot = lazy(() => import('./CivicAICopilot.jsx'));

const CivicAIContext = createContext(null);

/** Access the copilot from any component. Returns null outside the provider. */
export function useCivicAIContext() {
  return useContext(CivicAIContext);
}

/** True only for a signed-in, active CivicSync account. */
function useCanUseAI() {
  const { user } = useAuth();
  // AuthContext receives the server's safe user projection, which exposes the
  // Mongo id as `id` (not `_id`). Accept `_id` as well for callers that provide
  // a hydrated document, so the AI entry points work with both shapes.
  return Boolean((user?.id || user?._id) && user?.status !== 'suspended' && user?.status !== 'disabled');
}

/** The floating ✦ entry point. Desktop: inline pill. Mobile: fixed action. */
export function CivicAIButton({ className = '', label = true }) {
  const ai = useCivicAIContext();
  const allowed = useCanUseAI();
  if (!allowed || !ai) return null;
  return (
    <Button
      onClick={() => ai.openCopilot()}
      aria-label="Open CivicSync Intelligence"
      className={`gap-1.5 ${className}`}
    >
      <span aria-hidden="true">✦</span>
      {label && <span className="hidden sm:inline">AI</span>}
    </Button>
  );
}

export default function CivicAIProvider({ children }) {
  const ai = useCivicAI();
  const allowed = useCanUseAI();

  return (
    <CivicAIContext.Provider value={ai}>
      {children}
      {allowed && (
        <>
          <div className="pointer-events-none fixed bottom-4 right-4 z-[60] sm:hidden">
            <Button
              onClick={() => ai.openCopilot()}
              aria-label="Open CivicSync Intelligence"
              className="pointer-events-auto h-12 w-12 rounded-full shadow-lg"
            >
              <span aria-hidden="true">✦</span>
            </Button>
          </div>
          <Suspense fallback={null}>
            <CivicAICopilot
              open={ai.open}
              context={ai.context}
              onClose={ai.closeCopilot}
            />
          </Suspense>
        </>
      )}
    </CivicAIContext.Provider>
  );
}
