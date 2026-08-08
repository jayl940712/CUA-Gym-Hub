# DEV — round 19 (polish)

> Scope: the three P2s `AUDIT.md §8` singled out — **P2-A** (README on the tree
> route), **P2-C** (three anchored label filters select zero rows), **P2-E**
> (blob syntax highlighting) — under a hard "do not regress the passing gate"
> constraint.
>
> Written incrementally. Each section is finished before the next is started.

---

## 1 · P2-A — mount the README on `/-/tree/:ref[/*path]` · **DONE**

**Finding** (AUDIT.md P2-A, TEST.md DIFF-1701): the source renders the current
directory's README beneath the file table on every tree page; the mock rendered
it only on the project overview.

### 1.1 What the source actually does — measured, not assumed

Read out of `assets/html/` and then re-driven live, read-only and anonymously
(no login, no POST, **no `?sort=` URL**):

| question | answer | evidence |
|---|---|---|
| Is the tree page's readme markup the same as the overview's? | **byte-identical** | the ~900-char window around `readme-holder` in `assets/html/proj-dotfiles-tree-main.html` and `assets/html/proj-dotfiles.html` compares equal character for character |
| Root only, or every directory? | **every directory that contains one** | `/kkroening/ffmpeg-python/-/tree/master/examples` → holder present, `h1` = `Examples`, href `…/-/blob/master/examples/README.md` |
| Directory with no README? | **no holder at all** | `/byteblaze/gimmiethat.space/-/tree/main` → `readme-holder` absent (and its capture has no `readme-holder` either) |
| Which file when a directory has more than one? | **the markup one** | `kkroening/ffmpeg-python` and `DynamoRIO/dynamorio` both carry `README` *and* `README.md` at the root; the source renders `README.md` on all four of their tree/overview pages |
| Link text vs `data-path` | **basename** vs **full repo-relative path** | source header `innerText` is `" README.md"` (leading space) with href `…/examples/README.md` and `data-path="examples/README.md"` |

Markup, transcribed verbatim:

```html
<article class="file-holder limited-width-container readme-holder">
  <div class="js-file-title file-title-flex-parent">
    <div class="file-header-content">
      <svg data-testid="doc-text-icon" …> <a href="…/-/blob/<ref>/<path>" class="gl-link"><strong>NAME</strong></a>
  <div data-qa-selector="blob_viewer_content" itemprop="about" class="blob-viewer">
    <div><div data-rich-type="markup" data-path="<path>" class="blob-viewer">
      <div class="file-content md">…rendered markdown…
```

### 1.2 Change

One component, two mount points — no second renderer:

- `src/pages/RepoTree.jsx` — new exported `ReadmeHolder` (the markup above,
  `renderMarkdown()` for the body) and `findReadmeEntry` / `findReadme`
  (directory-scoped lookup with the markup-over-extensionless ranking).
- `src/pages/RepoTree.jsx` `RepoTree()` — mounts it inside `#tree-holder`,
  immediately after `.tree-content-holder`, where the source puts it.
- `src/pages/ProjectOverview.jsx` — **replaced** its ad-hoc block (a
  `div.blob-viewer` with inline borders and an unlinked `<strong>`) with the
  same component, and switched its readme lookup to `findReadmeEntry`. The
  overview's markup is now the source's too.
- `src/styles/global.css` — `.readme-holder` block. Every value is a
  `getComputedStyle` reading off the live source at 1280 on
  `/byteblaze/dotfiles/-/tree/main`, including the non-obvious part: the
  `<article>` has a border on **left/right/bottom only** (`border-top: 0 none`)
  and the title bar supplies the top edge.

Renders nothing when `repo_files.json` has no body for the entry — the seed is
partial by design and half a README is worse than none.

### 1.3 Verified — mock vs source, six paths at 1280×720

| path | mock | source |
|---|---|---|
| `/byteblaze/dotfiles/-/tree/main` | holder ✔ · `README.md` · `h1` **New System Setup** | same |
| `/byteblaze/dotfiles` | holder ✔ · `README.md` · `h1` **New System Setup** | same |
| `/kkroening/ffmpeg-python/-/tree/master/examples` | holder ✔ · `examples/README.md` · `h1` **Examples** | same |
| `/kkroening/ffmpeg-python/-/tree/master` | holder ✔ · **`README.md`** (not the 9-byte `README`) · `h1` **ffmpeg-python: Python bindings for FFmpeg** | same |
| `/byteblaze/gimmiethat.space/-/tree/main` | **no holder** | **no holder** |
| `/byteblaze/dotfiles/-/tree/main/.mackup` | **no holder** | (no README in that directory) |

Header `innerText` is `" README.md"` on both sides. Class list is
`file-holder limited-width-container readme-holder` on both. Geometry
**x = 289, width = 958 on both**. `document.body.innerText` on
`/byteblaze/dotfiles/-/tree/main` went **2 270 → 8 519** (source 8 096).
Zero console errors, zero pageerrors, zero horizontal scroll on all six.

**No anchor is touched.** Checked in `assets/task_anchors.json`: no anchor
locator selects `.readme-holder`, `.file-holder`, `.blob-viewer` or
`.file-content`, and no anchor route is a tree page whose assertion reads page
text. The change is additive on tree pages and markup-only on the overview.
