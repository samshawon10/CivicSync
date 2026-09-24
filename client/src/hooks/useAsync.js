import { useCallback, useEffect, useRef, useState } from 'react';
import { apiMessage } from '../services/api.js';

/**
 * Tiny data hook shared by every API-driven screen: consistent loading,
 * error and retry behaviour so skeletons and error states never diverge.
 *
 * `loader` is intentionally not part of the dependency list — pass the inputs
 * it depends on through `deps`.
 */
export default function useAsync(loader, deps = [], { immediate = true, keepPreviousData = false } = {}) {
  const [state, setState] = useState({ loading: immediate, error: '', data: null });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!immediate && nonce === 0) return undefined;
    const requestId = latest.current + 1;
    latest.current = requestId;
    let alive = true;
    setState((current) => ({ loading: true, error: '', data: keepPreviousData ? current.data : null }));
    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (!alive || latest.current !== requestId) return;
        setState({ loading: false, error: '', data: result });
      })
      .catch((error) => {
        if (!alive || latest.current !== requestId) return;
        setState({ loading: false, error: apiMessage(error), data: null });
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, immediate]);

  const update = useCallback((updater) => {
    setState((current) => ({ ...current, data: typeof updater === 'function' ? updater(current.data) : updater }));
  }, []);

  return { ...state, reload, setData: update };
}
