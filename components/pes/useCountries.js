import { useEffect, useState } from 'react';

let countriesPromise = null;
/** public/paises.json (same ids as the game and the EJOGC exporter), downloaded once per session. */
function loadCountries() {
  countriesPromise ??= fetch('/paises.json')
    .then(r => (r.ok ? r.json() : {}))
    .then(data => Object.entries(data).map(([id, name]) => ({ id: Number(id), name }))
      .filter(c => c.id > 0 && c.name && c.name !== 'N/A').sort((a, b) => a.name.localeCompare(b.name)))
    .catch(e => { countriesPromise = null; throw e; });
  return countriesPromise;
}

/** Country list of the app, sorted by name. Empty while loading or when the file is missing. */
export function useCountries() {
  const [countries, setCountries] = useState([]);
  useEffect(() => {
    let alive = true;
    loadCountries().then(list => { if (alive) setCountries(list); }).catch(() => { if (alive) setCountries([]); });
    return () => { alive = false; };
  }, []);
  return countries;
}
