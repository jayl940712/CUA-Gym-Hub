import React, { useId, useState } from 'react'

// The "Markdown allowed. Formatting help" disclosure that sits under every
// markdown textarea (_forms/markdown.html.twig block _markdown_help).
// Copy keys: markdown.allowed, markdown.help.
//
// The toggle is JS-free in the source: a visually-hidden `.hideable__checkbox`
// plus a `<label class="hideable__toggle">`. The `+` / `−` glyph is NOT a text
// node — `_things/hideable.less` emits it from
// `.hideable__indicator::after { content: attr(data-unhide-text) ' +' }`, so
// the source's rendered text is "Markdown allowed. Formatting help " with no
// glyph. Emitting a literal `+` here leaked into every `document.body.outerText`
// extraction on /submit, /create_forum, /f/*/edit, /user/*/edit_biography and
// every comment box. Keep the span EMPTY; the glyph lives in index.css.
export default function MarkdownHelp() {
  const [open, setOpen] = useState(false)
  // The source's id is `<field_id>_markdown_help`; this component is mounted
  // under a dozen different fields, so the prefix comes from useId(). Strip the
  // colons React puts in it — they are legal in an HTML id but break every CSS
  // and querySelector('#…') that would target it.
  const id = `${useId().replace(/:/g, '')}_markdown_help`
  return (
    <div className="hideable text-flow-slim">
      <input
        type="checkbox" className="hideable__checkbox" id={id}
        checked={open} onChange={e => setOpen(e.target.checked)}
      />
      <span className="fg-muted text-sm">Markdown allowed.</span>{' '}
      <label className="hideable__toggle no-underline text-sm" htmlFor={id}>
        {/* The source's Twig puts a newline between these two spans, which
            collapses to one space in innerText ("Formatting help "). JSX drops
            whitespace-only lines, so the space has to be explicit or every
            markdown form's extracted text loses a character against the source. */}
        <span className="no-underline__exempt">Formatting help</span>{' '}
        <span className="hideable__indicator" role="presentation" />
      </label>
      {open && (
        /* Transcribed row for row from the container's
           templates/_forms/markdown.html.twig `_markdown_help` block, with the
           copy taken from translations/messages.en.yml (markdown.paragraph,
           markdown.another_paragraph, markdown.line, markdown.break,
           markdown.emphasis, markdown.strong_emphasis, markdown.strikethrough,
           markdown.heading = 'Heading %count%', markdown.list_item,
           markdown.link, markdown.forum, markdown.user, markdown.wiki_page,
           markdown.blockquote, markdown.horizontal_rule, markdown.inline_code,
           markdown.code_block). Thirteen rows in this exact order — the
           previous version was missing the headings, ordered-list and
           code-block rows and paraphrased the samples (`https://example.com`
           for `http://example.com`, `-` for `*`, ``` for ~~~). */
        <table className="formatting-help hideable__hide fg-muted text-sm">
          <tbody>
            <tr>
              <td className="text-flow"><p>Paragraph</p><p>Another paragraph</p></td>
              <td><kbd>Paragraph<br /><br />Another paragraph</kbd></td>
            </tr>
            <tr>
              <td>line<br />break</td>
              <td><kbd>line \<br />break</kbd></td>
            </tr>
            <tr>
              <td><em>Emphasis</em></td>
              <td><kbd>*Emphasis*</kbd></td>
            </tr>
            <tr>
              <td><strong>Strong emphasis</strong></td>
              <td><kbd>**Strong emphasis**</kbd></td>
            </tr>
            <tr>
              <td><del>Strikethrough</del></td>
              <td><kbd>~~Strikethrough~~</kbd></td>
            </tr>
            <tr>
              <td>
                <h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>
                <h4>Heading 4</h4><h5>Heading 5</h5><h6>Heading 6</h6>
              </td>
              <td>
                <kbd>
                  Heading 1<br />===<br /><br />
                  Heading 2<br />---<br /><br />
                  ### Heading 3<br />#### Heading 4<br />
                  ##### Heading 5<br />###### Heading 6
                </kbd>
              </td>
            </tr>
            <tr>
              <td><ul><li>List item</li><li>List item</li></ul></td>
              <td><kbd>* List item<br />* List item<br /></kbd></td>
            </tr>
            <tr>
              <td><ol><li>List item</li><li>List item</li></ol></td>
              <td><kbd>1. List item<br />2. List item<br /></kbd></td>
            </tr>
            <tr>
              <td>
                <a href="#" tabIndex={-1} onClick={e => e.preventDefault()}>Link</a><br />
                <a href="#" tabIndex={-1} onClick={e => e.preventDefault()}>/f/forum</a><br />
                <a href="#" tabIndex={-1} onClick={e => e.preventDefault()}>/u/user</a><br />
                <a href="#" tabIndex={-1} onClick={e => e.preventDefault()}>/w/wiki_page</a>
              </td>
              <td>
                <kbd>
                  [Link](http://example.com)<br />
                  /f/forum<br />/u/user<br />/w/wiki_page
                </kbd>
              </td>
            </tr>
            <tr>
              <td className="text-flow">
                <blockquote><p>Blockquote</p><p>Another paragraph</p></blockquote>
              </td>
              <td><kbd>&gt; Blockquote<br />&gt;<br />&gt; Another paragraph</kbd></td>
            </tr>
            <tr>
              <td>Horizontal rule<hr /></td>
              <td><kbd>Horizontal rule<br /><br />---</kbd></td>
            </tr>
            <tr>
              <td><code>Inline code</code></td>
              <td><kbd>`Inline code`</kbd></td>
            </tr>
            <tr>
              <td>
                <code>
                  <span className="fg-blue">&lt;</span>
                  <span className="fg-orange">div</span>
                  <span className="fg-blue">&gt;</span><br />
                  {'  '}<span className="fg-text">Code block</span><br />
                  <span className="fg-blue">&lt;/</span>
                  <span className="fg-orange">div</span>
                  <span className="fg-blue">&gt;</span><br />
                </code>
              </td>
              <td>
                <kbd>
                  ~~~html<br />
                  &lt;div&gt;<br />
                  {'  '}Code block<br />
                  &lt;/div&gt;<br />
                  ~~~
                </kbd>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
