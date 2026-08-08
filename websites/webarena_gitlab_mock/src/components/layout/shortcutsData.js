// ---------------------------------------------------------------------------
// The GitLab 15.7 "Keyboard shortcuts" modal, extracted verbatim from the
// SOURCE container's own rendered modal (clicked `.js-shortcuts-modal-trigger`
// on http://localhost:8023/byteblaze/dotfiles and read the resulting
// `#keyboard-shortcut-modal` DOM). 14 sections, 75 rows, in source order.
//
// Shape: [sectionTitle, [ [tokens, description], ... ] ] where a token is
// ['kbd', 'Shift'] for a <kbd> and ['txt', '+'] for the literal joiner text
// GitLab puts between them (`+`, `or`, `then`).
// ---------------------------------------------------------------------------

const KEYBOARD_SHORTCUTS = [
  ["Global Shortcuts", [
    [[["kbd", "?"]], "Toggle keyboard shortcuts help dialog"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "p"]], "Go to your projects"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "g"]], "Go to your groups"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "a"]], "Go to the activity feed"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "l"]], "Go to the milestone list"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "s"]], "Go to your snippets"],
    [[["kbd", "s"], ["txt", "or"], ["kbd", "/"]], "Start search"],
    [[["kbd", "f"]], "Focus filter bar"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "i"]], "Go to your issues"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "m"]], "Go to your merge requests"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "r"]], "Go to your review requests"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "t"]], "Go to your To-Do list"],
    [[["kbd", "p"], ["txt", "then"], ["kbd", "b"]], "Toggle the Performance Bar"],
    [[["kbd", "Esc"]], "Hide tooltips or popovers"],
  ]],
  ["Editing", [
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "b"]], "Bold text"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "i"]], "Italic text"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "Shift"], ["txt", "+"], ["kbd", "x"]], "Strikethrough text"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "k"]], "Link text"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "Shift"], ["txt", "+"], ["kbd", "p"]], "Toggle Markdown preview"],
    [[["kbd", "\u2191"]], "Edit your most recent comment in a thread (from an empty textarea)"],
  ]],
  ["Wiki", [
    [[["kbd", "e"]], "Edit wiki page"],
  ]],
  ["Repository Graph", [
    [[["kbd", "\u2190"], ["txt", "or"], ["kbd", "h"]], "Scroll left"],
    [[["kbd", "\u2192"], ["txt", "or"], ["kbd", "l"]], "Scroll right"],
    [[["kbd", "\u2191"], ["txt", "or"], ["kbd", "k"]], "Scroll up"],
    [[["kbd", "\u2193"], ["txt", "or"], ["kbd", "j"]], "Scroll down"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "\u2191"], ["txt", "or"], ["txt", "br"], ["kbd", "Shift"], ["txt", "+"], ["kbd", "k"]], "Scroll to top"],
    [[["kbd", "Shift"], ["txt", "+"], ["kbd", "\u2193"], ["txt", "or"], ["txt", "br"], ["kbd", "Shift"], ["txt", "+"], ["kbd", "j"]], "Scroll to bottom"],
  ]],
  ["Project", [
    [[["kbd", "g"], ["txt", "then"], ["kbd", "p"]], "Go to the project's overview page"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "v"]], "Go to the project's activity feed"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "r"]], "Go to releases"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "f"]], "Go to files"],
    [[["kbd", "t"]], "Go to find file"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "c"]], "Go to commits"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "n"]], "Go to repository graph"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "d"]], "Go to repository charts"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "i"]], "Go to issues"],
    [[["kbd", "i"]], "New issue"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "b"]], "Go to issue boards"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "m"]], "Go to merge requests"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "j"]], "Go to jobs"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "l"]], "Go to metrics"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "e"]], "Go to environments"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "k"]], "Go to kubernetes"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "s"]], "Go to snippets"],
    [[["kbd", "g"], ["txt", "then"], ["kbd", "w"]], "Go to wiki"],
    [[["kbd", "."]], "Open in Web IDE"],
  ]],
  ["Project Files", [
    [[["kbd", "\u2191"]], "Move selection up"],
    [[["kbd", "\u2193"]], "Move selection down"],
    [[["kbd", "Enter"]], "Open Selection"],
    [[["kbd", "Esc"]], "Go back (while searching for files)"],
    [[["kbd", "y"]], "Go to file permalink (while viewing a file)"],
  ]],
  ["Epics, issues, and merge requests", [
    [[["kbd", "r"]], "Comment/Reply (quoting selected text)"],
    [[["kbd", "e"]], "Edit description"],
    [[["kbd", "l"]], "Change label"],
  ]],
  ["Issues and merge requests", [
    [[["kbd", "a"]], "Change assignee"],
    [[["kbd", "m"]], "Change milestone"],
  ]],
  ["Merge requests", [
    [[["kbd", "]"], ["txt", "or"], ["kbd", "j"]], "Next file in diff"],
    [[["kbd", "["], ["txt", "or"], ["kbd", "k"]], "Previous file in diff"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "p"], ["txt", "or"], ["kbd", "t"]], "Go to file"],
    [[["kbd", "n"]], "Next unresolved discussion"],
    [[["kbd", "p"]], "Previous unresolved discussion"],
    [[["kbd", "b"]], "Copy source branch name"],
  ]],
  ["Merge request commits", [
    [[["kbd", "c"]], "Next commit"],
    [[["kbd", "x"]], "Previous commit"],
  ]],
  ["Issues", [
    [[["kbd", "\u2192"]], "Next design"],
    [[["kbd", "\u2190"]], "Previous design"],
    [[["kbd", "Esc"]], "Close design"],
  ]],
  ["Web IDE", [
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "p"]], "Go to file"],
    [[["kbd", "Ctrl"], ["txt", "+"], ["kbd", "Enter"]], "Commit (when editing commit message)"],
  ]],
  ["Metrics", [
    [[["kbd", "e"]], "Expand panel"],
    [[["kbd", "l"]], "View logs"],
    [[["kbd", "d"]], "Download CSV"],
    [[["kbd", "c"]], "Copy link to chart"],
    [[["kbd", "a"]], "Alerts"],
  ]],
  ["Miscellaneous", [
    [[["kbd", "g"], ["txt", "then"], ["kbd", "x"]], "Toggle GitLab Next"],
  ]],
]

export default KEYBOARD_SHORTCUTS
