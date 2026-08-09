import { useSyncExternalStore, useEffect, useMemo } from 'react'
import {
  subscribeCatalogDetail, catalogDetailVersion, detailReady, ensureDetail,
  descriptionsReadyFor, ensureDescriptionsFor,
  searchIndexReadyFor, ensureSearchIndexFor,
} from '../utils/catalog.js'

/**
 * Subscribe to the code-split detail seeds (utils/catalog.js) and report
 * whether the ones this view reads are installed yet.
 *
 * R7-004. The seeds are read through synchronous accessors, so a view that
 * paints before its module lands shows an empty description or an empty review
 * list and then fills it in — a flash. The previous fix awaited all three in
 * `AppProvider`'s boot gate, which removed the flash but put 15.4 MB gzip in
 * front of the first paint of every route, including the ones that read none of
 * it. This moves the wait to the views that actually read the data:
 *
 *   const ready = useDetailReady(['descriptions'])
 *
 * `ensureDetail` is fired from the effect as a safety net; in practice
 * `main.jsx` has already had all three in flight since before React mounted, so
 * this only ever *waits*, it does not delay the request.
 *
 * `needs` may be a fresh array literal on every render — it is keyed on its
 * contents, not its identity, so it will not loop.
 */
export function useDetailReady(needs) {
  const key = (needs || []).join(',')
  const mods = useMemo(() => (key ? key.split(',') : []), [key])
  const version = useSyncExternalStore(
    subscribeCatalogDetail, catalogDetailVersion, catalogDetailVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ready = useMemo(() => detailReady(mods), [mods, version])
  useEffect(() => {
    if (!ready) ensureDetail(mods)
  }, [mods, ready])
  return ready
}

/**
 * Same, for the description corpus's *shards* (R8-001): report whether the
 * descriptions of these specific products are in memory, and pull the one or
 * two shards they live in if not.
 *
 *   const descReady = useDescriptionsFor([product.id])
 *
 * A PDP that used this instead of `useDetailReady(['descriptions'])` waits on
 * ~0.29 MB gzip rather than 9.35 MB. `ids` is keyed on its contents, so a fresh
 * array literal per render will not loop.
 */
export function useDescriptionsFor(ids) {
  const key = (ids || []).join(',')
  const list = useMemo(() => (key ? key.split(',').map(Number) : []), [key])
  const version = useSyncExternalStore(
    subscribeCatalogDetail, catalogDetailVersion, catalogDetailVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ready = useMemo(() => descriptionsReadyFor(list), [list, version])
  useEffect(() => {
    if (!ready) ensureDescriptionsFor(list)
  }, [list, ready])
  return ready
}

/**
 * Same, for the description SEARCH INDEX (R8-001, shard Q): report whether the
 * index buckets this query term reads are in memory, and pull them if not.
 *
 *   const indexReady = useSearchIndexFor(term)
 *
 * An uncaptured `?q=` page that used to gate on the 9.35 MB-gzip description
 * corpus now gates on one or two ~49 kB-gzip buckets. `term` may be null when
 * the page does not read the derived pool at all (a fully captured listing), in
 * which case this is trivially ready and requests nothing.
 */
export function useSearchIndexFor(term) {
  const key = term == null ? null : String(term)
  const version = useSyncExternalStore(
    subscribeCatalogDetail, catalogDetailVersion, catalogDetailVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ready = useMemo(
    () => (key === null ? true : searchIndexReadyFor(key)), [key, version])
  useEffect(() => {
    if (!ready && key !== null) ensureSearchIndexFor(key)
  }, [ready, key])
  return ready
}

/**
 * Render `children` once `needs` is installed, `fallback` until then.
 * `<Page needs={[...]}>` covers most callers; this is for the two views that
 * build their own shell (the PDP) or need a narrower gate.
 */
export default function DetailGate({ needs, fallback = null, children }) {
  return useDetailReady(needs) ? children : fallback
}
