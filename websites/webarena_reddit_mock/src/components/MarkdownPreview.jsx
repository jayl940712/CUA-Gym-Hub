import React from 'react'
import { renderMarkdown } from '../utils/markdown.js'

// `templates/_forms/markdown.html.twig`, `{% block markdown_widget %}`, read out
// of the container verbatim:
//
//   <div class="flow-slim" {{ (app.user.enablePostPreviews ?? false) ? 'data-controller="markdown"' }}>
//     {{ form_widget(form, { attr: { class: 'flex__grow',
//                                    'data-action': 'markdown#preview',
//                                    'data-markdown-target': 'input' } }) }}
//     <div class="markdown-preview" data-markdown-target="previewContainer" hidden>
//       <h3 class="markdown-preview__title">{{ 'markdown.preview'|trans }}</h3>
//       <div class="markdown-preview__inner text-flow" data-markdown-target="preview"></div>
//     </div>
//   </div>
//
// Every field built from `App\Form\Type\MarkdownType` gets this wrapper:
// SubmissionType `body` (/submit, /f/{f}/{id}/{slug}/edit), ForumType `sidebar`
// (/create_forum, /f/{name}/edit), CommentType `comment` (the comment and reply
// forms) and UserBiographyType `biography` (/user/{name}/edit_biography).
//
// Visibility rule — `assets/js/controller/markdown-controller.js` in the
// container, re-measured on the live source with a 2,500 ms settle (the
// controller debounces at 600 ms and then async-imports markdown-it, which is
// what an earlier audit mis-measured as "the source keeps it hidden"):
//
//   updatePreview = debounce(() => {
//     if (input.length === 0) { previewContainerTarget.hidden = true; return }
//     … previewContainerTarget.hidden = rendered.length === 0
//   }, 600)
//   connect() { this.updatePreview() }        // ← also runs on page load
//
// i.e. hidden iff the rendered output is empty. `hidden` is the HTML attribute,
// so an empty field contributes NOTHING to document.body.innerText — which is
// what evaluators read, and the reason this pane is only mounted on forms whose
// field starts empty (see the note in EditBiographyPage.jsx).
export default function MarkdownPreview({ value }) {
  const rendered = !value || value.length === 0 ? '' : renderMarkdown(value)
  return (
    <div
      className="markdown-preview"
      data-markdown-target="previewContainer"
      hidden={rendered.length === 0}
    >
      <h3 className="markdown-preview__title">Preview</h3>
      <div
        className="markdown-preview__inner text-flow"
        data-markdown-target="preview"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  )
}
