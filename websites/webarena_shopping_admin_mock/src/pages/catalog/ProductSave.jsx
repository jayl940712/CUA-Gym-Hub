import React from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

/* ROUTES row 42 — /admin/catalog/product/save/id/:id/.
 *
 * In the source this is a POST-only controller that redirects to the grid (or
 * back to the form, depending on the Save split-button choice). The mock does
 * the mutation in the form itself, so reaching this URL with a GET behaves like
 * the source's post-save redirect: back to the product edit page, `?sid=` and
 * the rest of the query string intact.
 */
export default function ProductSave() {
  const { id } = useParams()
  const location = useLocation()
  const to = id ? `/admin/catalog/product/edit/id/${id}/` : '/admin/catalog/product/'
  return <Navigate to={`${to}${location.search}`} replace />
}
