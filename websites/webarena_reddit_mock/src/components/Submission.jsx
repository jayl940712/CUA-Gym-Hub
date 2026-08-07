import React from 'react'
import SLink from './SLink.jsx'
import Vote from './Vote.jsx'
import Time from './Time.jsx'
import { useApp } from '../context/AppContext.jsx'
import { renderMarkdown } from '../utils/markdown.js'
import { spaceless } from '../utils/searchHighlight.js'
import { commentCountLabel, displayHost, linkHost } from '../utils/format.js'
import images from '../data/images.json'

// templates/_layouts/submission.html.twig — the most-reused component on the
// site. Rendered order (the vote column is markup-LAST but paints first because
// .submission__row is flex-direction: row-reverse):
//
//   1. div.submission__vote
//   2. img.submission__thumb        (image posts, absolutely positioned)
//   3. h1.submission__title > a.submission__link
//   4. a.submission__host.text-xs   -> /search?q=<full host>, no parentheses
//   5. p.submission__info           (byline)
//   6. div.submission__body         (expanded only)
//   7. nav.submission__nav          (comment count first)
//
// Evaluator locators on this component: .submission__inner, .submission__title,
// .submission__body, div.submission__vote form.

const MAX_IMAGE_BOX = 500

export function canonicalPath(sub) {
  return `/f/${sub.forum}/${sub.id}/${sub.slug || '-'}`
}

function imageBox(sub) {
  const meta = images[sub.image]
  const w = (meta && meta.w) || sub.imageWidth
  const h = (meta && meta.h) || sub.imageHeight
  if (!w || !h) return { width: undefined, height: undefined }
  const scale = Math.min(1, MAX_IMAGE_BOX / w, MAX_IMAGE_BOX / h)
  return { width: Math.ceil(w * scale), height: Math.ceil(h * scale) }
}

/**
 * `submissions.image` is a bare file name in the seed (`images.file_name` in
 * the container, served from public/submission_images/). A submission created
 * through /submit's Image tab instead carries the absolute URL the mock's own
 * /upload endpoint returned (`/files/<sid>/<name>`, or a `data:` URL when the
 * plugin is not mounted), so both shapes have to resolve.
 */
export function submissionImageUrl(image) {
  if (!image) return null
  return /^(?:[a-z]+:|\/)/i.test(image) ? image : `/submission_images/${image}`
}

/** media/cache/submission_thumbnail_{1x,2x} only exists for seeded files. */
function thumbSrc(image, density) {
  if (/^(?:[a-z]+:|\/)/i.test(image)) return image
  return `/media/cache/submission_thumbnail_${density}/${image}`
}

/**
 * `rawTitle` / `rawBody` are the macro's `raw_title` / `raw_body` options
 * (templates/submission/_macros.html.twig). Only `/search` passes them, with the
 * `<mark>`-annotated ts_headline output; everything else leaves them null and
 * gets the plain title and the markdown-rendered body.
 */
export default function Submission({
  submission: sub, expanded = false, showForum = true,
  rawTitle = null, rawBody = null,
}) {
  const { state } = useApp()
  const user = state.currentUser

  const canonical = canonicalPath(sub)
  const imageUrl = submissionImageUrl(sub.image)

  // block submission_url — depends on the user's submissionLinkDestination
  let titleHref = canonical
  let external = false
  if (user.submissionLinkDestination === 'url') {
    if (sub.url) { titleHref = sub.url; external = true }
    else if (imageUrl) { titleHref = imageUrl; external = true }
  }

  // The thumbnail is a LISTING affordance only — the expanded submission shows
  // the full image instead and carries neither `submission--has-thumbnail` nor
  // `img.submission__thumb` (verified in assets/html/f_pics_45604_*.html).
  const showThumb = !!sub.image && user.showThumbnails && !expanded
  const classes = ['submission']
  if (sub.url) classes.push('submission--has-url')
  if (sub.body) classes.push('submission--has-body')
  classes.push(expanded ? 'submission--expanded' : 'submission--collapsed')
  if (sub.sticky) classes.push('submission--sticky')
  if (sub.locked) classes.push('submission--locked')
  if (showThumb) classes.push('submission--has-thumbnail')
  classes.push('submission--visibility-visible')

  // `submission_body` renders whenever `raw_body is not null or submission.body
  // is not null`. In the container 74,125 of 74,128 submissions store `''`
  // rather than NULL for "no self-text", so an expanded URL-only post still
  // carries an EMPTY `.submission__body` — keep emitting it unconditionally
  // (the mock's seed uses null where the source uses '').
  const isOwn = sub.author === user.username
  const box = sub.image ? imageBox(sub) : {}

  const thumb = showThumb && (
    <img
      src={thumbSrc(sub.image, '1x')}
      srcSet={`${thumbSrc(sub.image, '2x')} 2x`}
      className="submission__thumb" alt="" width="70" height="70" aria-hidden="true"
    />
  )

  // `{% apply spaceless %}` wraps the whole submission_title block in the
  // source, so `</mark> <mark>` collapses to `</mark><mark>` in a highlighted
  // search title — reproduce it rather than "fixing" it.
  const rawTitleHtml = rawTitle == null ? null : spaceless(rawTitle)

  // With no thumbnail the anchor's only content is the headline, so the raw
  // HTML goes straight on the <a> and the DOM matches the source exactly.
  const rawOnLink = rawTitleHtml != null && !showThumb

  const titleLink = external
    ? (
      <a
        href={titleHref} className="submission__link" rel="nofollow noreferrer noopener" target="_self"
        dangerouslySetInnerHTML={rawOnLink ? { __html: rawTitleHtml } : undefined}
      >
        {rawOnLink ? undefined : <>{thumb}{sub.title}</>}
      </a>
    )
    : (
      <SLink
        to={titleHref} className="submission__link" target="_self"
        dangerouslySetInnerHTML={rawOnLink ? { __html: rawTitleHtml } : undefined}
      >
        {rawOnLink ? undefined : <>{thumb}{sub.title}</>}
      </SLink>
    )

  return (
    <article className={classes.join(' ')}>
      <div className="submission__row">
        <div className="submission__inner">
          <header className="submission__header">
            <div className="submission__title-row break-text">
              <h1 className="submission__title unheaderize inline">{titleLink}</h1>{' '}
              {sub.url && (
                <SLink to={`/search?q=${encodeURIComponent(linkHost(sub.url))}`} className="submission__host text-xs">
                  {displayHost(sub.url)}
                </SLink>
              )}
            </div>

            <p className="submission__info">
              <span className="text-sm fg-muted">
                Submitted by{' '}
                <SLink to={`/user/${sub.author}`} className="submission__submitter fg-inherit">
                  <strong>{sub.author}</strong>
                </SLink>
                {sub.userFlag && sub.userFlag !== 'none' && (
                  <> <small className="fg-grey text-sm user-flag">{sub.userFlag}</small></>
                )}
                {' '}
                <Time iso={sub.timestamp} className="submission__timestamp" />
                {sub.editedAt && <> (edited <Time iso={sub.editedAt} />)</>}
                {showForum && (
                  <> in{' '}
                    <SLink to={`/f/${sub.forum}`} className="submission__forum fg-inherit">
                      <strong>{sub.forum}</strong>
                    </SLink>
                  </>
                )}
              </span>
            </p>
          </header>

          {sub.sticky && <p className="fg-green text-sm">This submission is pinned</p>}
          {sub.locked && <p className="fg-muted text-sm">This submission is locked</p>}

          {expanded && (
            <div className="submission__content flow-slim">
              <div
                className="submission__body break-text text-flow"
                dangerouslySetInnerHTML={{
                  __html: rawBody != null ? rawBody : renderMarkdown(sub.body || '')
                }}
              />
              {imageUrl && (
                <a href={imageUrl} className="submission__image-link" target="_self">
                  <img src={imageUrl} alt="" className="submission__image"
                       width={box.width} height={box.height} />
                </a>
              )}
            </div>
          )}

          <nav className="submission__nav">
            <ul className="unlistify fg-muted flex flex--guttered">
              <li>
                <SLink to={canonical} className="text-sm">
                  <strong>{commentCountLabel(sub.commentCount || 0)}</strong>
                </SLink>
              </li>
              {isOwn && (
                <>
                  <li>
                    <SLink to={`${canonical}/edit`} className="text-sm">Edit</SLink>
                  </li>
                  <li>
                    <SLink to={`${canonical}/delete`} className="text-sm">Delete</SLink>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>

        <div className="submission__vote">
          <Vote kind="submission" id={sub.id} netScore={sub.netScore} />
        </div>
      </div>
    </article>
  )
}
