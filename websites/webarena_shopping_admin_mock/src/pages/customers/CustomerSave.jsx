import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

/* ROUTES row 55 — /admin/customer/index/save.
 *
 * POST-only in the source; the mock persists from the form itself, so a GET
 * here reproduces the post-save redirect back to the Customers grid with
 * `?sid=` preserved.
 */
export default function CustomerSave() {
  const location = useLocation()
  return <Navigate to={`/admin/customer/index/${location.search}`} replace />
}
