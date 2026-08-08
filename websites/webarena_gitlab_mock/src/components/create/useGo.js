import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Programmatic navigation that keeps `?sid=` alive.
 *
 * `<a href>` clicks are already handled by App.jsx's delegated interceptor, but
 * a form submit navigates through the router directly, and a bare
 * `navigate('/byteblaze/planner')` would drop the session id — after which
 * every later mutation lands in a different `.mock-states/<sid>.json` and /go
 * reports nothing. Only `sid` is carried; per-view params such as
 * `?file_name=` are deliberately left behind.
 */
export default function useGo() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sid = searchParams.get('sid')

  return useCallback((path, extra) => {
    const params = new URLSearchParams(extra || '')
    if (sid) params.set('sid', sid)
    const q = params.toString()
    navigate(q ? `${path}?${q}` : path)
  }, [navigate, sid])
}
