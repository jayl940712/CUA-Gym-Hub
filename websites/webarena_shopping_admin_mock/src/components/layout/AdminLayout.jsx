import React from 'react'
import AdminSidebar from './AdminSidebar.jsx'
import AdminFooter from './AdminFooter.jsx'

/** Rail + content column (`.page-wrapper` is `calc(100% - 8.8rem)`). */
export default function AdminLayout({ children }) {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="page-wrapper">
        {children}
        <AdminFooter />
      </div>
    </div>
  )
}
