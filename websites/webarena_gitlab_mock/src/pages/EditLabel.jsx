import React from 'react'
import NewLabel from './NewLabel.jsx'

// ROUTES #89 — `/:ns/:proj/-/labels/:id/edit`. Identical form to §16a's
// `/-/labels/new`, headed `Edit Label` with a `Save changes` submit.
export default function EditLabel() {
  return <NewLabel edit />
}
