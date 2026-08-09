import React from 'react'
import { SLink } from '../utils/url.js'
import { relatedSearchTerms } from '../utils/catalog.js'

/**
 * `Magento\AdvancedSearch\Block\Recommendations`, rendered by
 * `module-advanced-search/view/frontend/templates/search_data.phtml` and
 * reached through `Result::getAdditionalHtml()` — which `result.phtml` emits
 * inside the `.message.notice`, on both zero-result states.
 *
 * Markup, verbatim from the live source at `/catalogsearch/result/?q=ab`
 * (2026-08-09), whitespace collapsed:
 *
 *   <dl class="block">
 *     <dt class="title">Related search terms</dt>
 *     <dd class="item"><a href="…/catalogsearch/result/?q=abc">abc</a></dd>
 *   </dl>
 *
 * The `<span class="count">` in the template is NOT rendered here because
 * `catalog/search/search_recommendations_count_results_enabled` is 0 in
 * `module-advanced-search/etc/config.xml` and the container carries no
 * `core_config_data` override — matching the source, which emits no count.
 *
 * `if (count($data))` in the template means the whole `<dl>` disappears when
 * nothing matches, which is what `/catalogsearch/result/?q=zzzqqxwv` renders
 * live: `Your search returned no results.` and no list.
 *
 * This replaced a `div.block.block-related-search > ul.search-terms` block that
 * printed the ten most popular terms on every empty result page regardless of
 * the query. That markup belongs to `/search/term/popular/` (CmsPages.jsx),
 * not here, and the ten-fixed-terms selection was not the source's.
 */
export default function RelatedSearchTerms({ term }) {
  const items = relatedSearchTerms(term)
  if (!items.length) return null
  return (
    <dl className="block">
      <dt className="title">Related search terms</dt>
      {items.map(t => (
        <dd className="item" key={t.queryId}>
          <SLink to="/catalogsearch/result/" params={{ q: t.queryText }}>{t.queryText}</SLink>
        </dd>
      ))}
    </dl>
  )
}
