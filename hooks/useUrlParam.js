import { useCallback } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';

/** `?key=` read and written with replace, keeping location.state (modal routes return to it). Inert outside a Router. */
export function useUrlParam(key) {
  const inRouter = useInRouterContext();
  const location = inRouter ? useLocation() : null;
  const navigate = inRouter ? useNavigate() : null;
  const value = location ? new URLSearchParams(location.search).get(key) : null;
  const search = location?.search;
  const pathname = location?.pathname;
  const state = location?.state;
  const hash = location?.hash || '';
  const set = useCallback((next) => {
    if (!navigate) return;
    const params = new URLSearchParams(search);
    params.set(key, next);
    navigate({ pathname, search: `?${params}`, hash }, { replace: true, state });
  }, [navigate, search, pathname, hash, state, key]);
  return [value, set];
}
