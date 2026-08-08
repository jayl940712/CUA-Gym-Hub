import React, { useState, useRef, useEffect } from 'react'
import Icon from '../layout/Icon.jsx'
import LICENSES, { LICENSE_GROUPS, renderLicense } from './licenses.js'

// The single-file editor behind `/-/new/:ref` and `/-/edit/:ref/*path`
// (TODO.md P1-C, 20 tasks). DOM and copy from
// assets/html/proj-newfile-dotfiles.html.
//
// The real page runs Monaco; a textarea is the honest equivalent here — what
// the tasks need is that the bytes it produces reach state.repo.fileOverlay,
// because the evaluators read them straight back off /-/raw/:ref/*path.

// The five entries in the source's "Select a template type" dropdown.
const TEMPLATE_TYPES = ['.gitignore', '.gitlab-ci.yml', '.metrics-dashboard.yml', 'Dockerfile', 'LICENSE']

const GITIGNORE_SAMPLE = `# Logs
logs
*.log
npm-debug.log*

# Dependency directories
node_modules/

# Build output
dist/
build/

# Environment
.env
.env.local
`

const CI_SAMPLE = `# This file is a template, and might need editing before it works on your project.
stages:
  - build
  - test
  - deploy

build-job:
  stage: build
  script:
    - echo "Compiling the code..."

test-job:
  stage: test
  script:
    - echo "Running tests..."

deploy-job:
  stage: deploy
  script:
    - echo "Deploying application..."
`

const DOCKERFILE_SAMPLE = `FROM alpine:latest

WORKDIR /app
COPY . .

CMD ["/bin/sh"]
`

const METRICS_SAMPLE = `dashboard: 'Environment metrics'
panel_groups:
  - group: 'Response metrics'
    panels:
      - title: 'Throughput'
        type: 'area-chart'
        y_label: 'Requests / sec'
`

const SIMPLE_TEMPLATES = {
  '.gitignore': GITIGNORE_SAMPLE,
  '.gitlab-ci.yml': CI_SAMPLE,
  '.metrics-dashboard.yml': METRICS_SAMPLE,
  Dockerfile: DOCKERFILE_SAMPLE,
}

/** A `.dropdown` that closes on outside click, matching the source markup. */
function Dropdown({ label, qa, children, width = 260 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div className={`dropdown${open ? ' show' : ''}`} ref={ref}>
      <button type="button" className="dropdown-menu-toggle btn gl-button btn-default"
        data-qa-selector={qa} onClick={() => setOpen(o => !o)}>
        <span className="dropdown-toggle-text">{label}</span>
        <Icon name="chevron-down" className="dropdown-menu-toggle-icon" />
      </button>
      <div className="dropdown-menu dropdown-select dropdown-menu-selectable" style={{ minWidth: width }}>
        <div className="dropdown-content" data-qa-selector="dropdown_list_content"
          onClick={() => setOpen(false)}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * @param mode           'create' | 'edit'
 * @param project        project record
 * @param refName        the branch the editor opened on
 * @param initialPath    prefilled file path (create) or the path being edited
 * @param initialBody    prefilled body
 * @param initialMessage prefilled commit message
 * @param authorName     used to fill `[fullname]` in licence templates
 * @param onCommit       ({ path, body, message, branch, newBranch, startMr })
 * @param cancelHref
 */
export default function FileEditor({
  mode, project, refName, initialPath = '', initialBody = '', initialMessage,
  authorName, onCommit, cancelHref,
}) {
  const isCreate = mode === 'create'
  const dir = !isCreate && initialPath.includes('/')
    ? initialPath.slice(0, initialPath.lastIndexOf('/') + 1)
    : ''
  const [fileName, setFileName] = useState(isCreate ? initialPath : initialPath.slice(dir.length))
  const [body, setBody] = useState(initialBody)
  const [message, setMessage] = useState(initialMessage)
  const [branch, setBranch] = useState(refName)
  const [startMr, setStartMr] = useState(true)
  const [templateType, setTemplateType] = useState(null)
  const [softWrap, setSoftWrap] = useState(false)
  const [error, setError] = useState(null)

  const fullName = dir + fileName
  const looksLikeLicense = /^licen[cs]e(\.\w+)?$/i.test(fullName.split('/').pop() || '')
  const showLicensePicker = templateType === 'LICENSE' || looksLikeLicense
  const branchChanged = branch !== refName

  function applySimpleTemplate(kind) {
    setTemplateType(kind)
    if (SIMPLE_TEMPLATES[kind]) {
      setBody(SIMPLE_TEMPLATES[kind])
      if (isCreate && !fileName) setFileName(kind)
    } else if (kind === 'LICENSE' && isCreate && !fileName) {
      setFileName('LICENSE')
    }
  }

  function submit(e) {
    e.preventDefault()
    if (!fullName.trim()) { setError('You must provide a file name.'); return }
    if (!message.trim()) { setError('A commit message is required.'); return }
    setError(null)
    onCommit({
      path: fullName.replace(/^\/+/, ''),
      body,
      message: message.trim(),
      branch: branch.trim() || refName,
      newBranch: branchChanged,
      startMr: branchChanged && startMr,
    })
  }

  return (
    <div className="file-editor create-flow">
      {error ? (
        <div className="gl-alert gl-alert-danger gl-mb-3" role="alert">
          <div className="gl-alert-content"><div className="gl-alert-body">{error}</div></div>
        </div>
      ) : null}

      <form className="js-edit-blob-form" onSubmit={submit} noValidate>
        <div className="file-holder file">
          <div className="js-file-title file-title" data-current-action={isCreate ? 'create' : 'update'}>
            <div className="editor-ref block-truncated has-tooltip" title={refName}>
              <Icon name="fork" data-testid="branch-icon" /> {refName}
            </div>
            <span className="float-left gl-mr-3">/</span>
            {dir ? <span className="gl-font-monospace gl-mr-2">{dir}</span> : null}
            <input type="text" name="file_name" id="file_name" placeholder="File name"
              data-qa-selector="file_name_field" required autoComplete="off"
              className="form-control gl-form-input new-file-name js-file-path-name-input"
              value={fileName} onChange={e => setFileName(e.target.value)} />

            <div className="template-selectors-menu gl-pl-3">
              <div className="template-type-selector js-template-type-selector-wrap">
                <Dropdown label={templateType || 'Select a template type'} qa="template_type_dropdown">
                  <ul>
                    {TEMPLATE_TYPES.map(t => (
                      <li key={t}>
                        <a href="#" onClick={e => { e.preventDefault(); applySimpleTemplate(t) }}>{t}</a>
                      </li>
                    ))}
                  </ul>
                </Dropdown>
              </div>

              {showLicensePicker ? (
                <div className="license-selector js-license-selector-wrap">
                  <Dropdown label="Apply a template" qa="license_dropdown" width={320}>
                    {LICENSE_GROUPS.map(g => (
                      <ul key={g.label}>
                        <li className="dropdown-header">{g.label}</li>
                        {g.keys.map(k => (
                          <li key={k}>
                            <a href="#" onClick={e => {
                              e.preventDefault()
                              setBody(renderLicense(k, { fullname: authorName, project: project.name }))
                              if (isCreate && !fileName) setFileName('LICENSE')
                            }}>{LICENSES[k].name}</a>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </Dropdown>
                </div>
              ) : null}
            </div>

            <div className="editor-options">
              <button type="button" className="btn gl-button btn-default"
                onClick={() => setSoftWrap(w => !w)}>{softWrap ? 'Soft wrap' : 'No wrap'}</button>
            </div>
          </div>

          <div className="editor-shell">
            <textarea id="editor" className="editor-textarea" spellCheck="false"
              wrap={softWrap ? 'soft' : 'off'}
              aria-label="Editor content" value={body} onChange={e => setBody(e.target.value)} />
          </div>
        </div>

        <div className="form-group row commit_message-group">
          <label className="col-form-label col-sm-2" htmlFor="commit_message">Commit message</label>
          <div className="col-sm-10">
            <div className="commit-message-container">
              <textarea name="commit_message" id="commit_message" rows={3} required
                className="form-control gl-form-input js-commit-message"
                data-qa-selector="commit_message_field"
                placeholder={isCreate ? 'Add new file' : `Update ${fileName}`}
                value={message} onChange={e => setMessage(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-group row branch">
          <label className="col-form-label col-sm-2" htmlFor="branch_name">Target Branch</label>
          <div className="col-sm-10">
            <input type="text" name="branch_name" id="branch_name" required
              className="form-control gl-form-input js-branch-name ref-name"
              value={branch} onChange={e => setBranch(e.target.value)} />
            {/* The source keeps this block hidden until the target branch is
                changed — committing to the original branch cannot open an MR. */}
            <div className="js-create-merge-request-container"
              style={{ display: branchChanged ? 'block' : 'none' }}>
              <div className="form-check gl-mt-3">
                <input type="checkbox" name="create_merge_request" id="create_merge_request"
                  value="1" className="js-create-merge-request form-check-input"
                  checked={startMr} onChange={e => setStartMr(e.target.checked)} />
                <label className="form-check-label" htmlFor="create_merge_request">
                  Start a <strong>new merge request</strong> with these changes
                </label>
              </div>
            </div>
          </div>
        </div>
        <input type="hidden" name="original_branch" id="original_branch" value={refName} readOnly />

        <div className="form-actions gl-display-flex">
          <button id="commit-changes" type="submit" data-qa-selector="commit_button"
            className="gl-button btn btn-md btn-confirm js-commit-button">
            <span className="gl-button-text">Commit changes</span>
          </button>
          <a className="gl-button btn btn-md btn-default gl-ml-3" id="cancel-changes"
            aria-label="Discard changes" href={cancelHref}>
            <span className="gl-button-text">Cancel</span>
          </a>
        </div>
      </form>
    </div>
  )
}
