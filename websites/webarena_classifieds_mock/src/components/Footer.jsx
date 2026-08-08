import React from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { indexUrl } from '../utils/urls.js'

/**
 * #cde8e9, padding 35px 0 25px 0. One link plus the "Powered by …" line.
 * Per TRADEMARKS.md the wordmark is altered; the sentence shape is kept.
 */
export default function Footer() {
  const { sid } = useApp()
  return (
    <footer>
      <div className="wrapper">
        <div className="box">
          <Link to={indexUrl({ page: 'contact' }, sid)}>Contact</Link>

          <div className="clear"></div>
          <div className="clear"></div>

          <div className="copy">
            Powered by <a title="Osclazz classifieds script" href="#">best classifieds scripts</a> osclazz
          </div>
        </div>
      </div>
    </footer>
  )
}
