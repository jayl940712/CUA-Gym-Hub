// Diff computation for /go.
//
// The mutable seed holds ~3 500 records across 12 collections, so a naive
// deep diff would emit one entry per array index on any insert. Collections
// keyed by a stable id are diffed as sets (added / removed / changed);
// everything else falls back to a recursive value diff.

const KEYED_COLLECTIONS = {
  users: 'id',
  projects: 'id',
  groups: 'id',
  issues: 'id',
  mergeRequests: 'id',
  notes: 'id',
  labels: 'id',
  milestones: 'id',
  members: 'id',
  todos: 'id',
  snippets: 'id',
}

function indexBy(rows, key) {
  const m = new Map()
  if (!Array.isArray(rows)) return m
  for (const r of rows) if (r && r[key] !== undefined) m.set(r[key], r)
  return m
}

function diffKeyedCollection(before, after, key) {
  const a = indexBy(before, key)
  const b = indexBy(after, key)
  const added = []
  const removed = []
  const changed = []
  for (const [id, row] of b) {
    if (!a.has(id)) added.push(row)
    else if (JSON.stringify(a.get(id)) !== JSON.stringify(row)) {
      changed.push({ [key]: id, old: a.get(id), new: row })
    }
  }
  for (const [id, row] of a) if (!b.has(id)) removed.push(row)
  if (!added.length && !removed.length && !changed.length) return null
  return { added, removed, changed }
}

function diffUnkeyedList(before, after) {
  const key = v => JSON.stringify(v)
  const a = new Map((before || []).map(v => [key(v), v]))
  const b = new Map((after || []).map(v => [key(v), v]))
  const added = []
  const removed = []
  for (const [k, v] of b) if (!a.has(k)) added.push(v)
  for (const [k, v] of a) if (!b.has(k)) removed.push(v)
  if (!added.length && !removed.length) return null
  return { added, removed }
}

function diffValues(path, a, b, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return
  if (Array.isArray(a) || Array.isArray(b)) { out[path] = { old: a, new: b }; return }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) diffValues(`${path}.${k}`, a[k], b[k], out)
    return
  }
  out[path] = { old: a, new: b }
}

export function computeStateDiff(initial, current) {
  if (!initial || !current) return {}
  const diff = {}
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)])

  for (const k of keys) {
    const a = initial[k]
    const b = current[k]
    if (JSON.stringify(a) === JSON.stringify(b)) continue

    if (KEYED_COLLECTIONS[k] && Array.isArray(a) && Array.isArray(b)) {
      const d = diffKeyedCollection(a, b, KEYED_COLLECTIONS[k])
      if (d) diff[k] = d
      continue
    }
    if ((k === 'stars' || k === 'follows') && Array.isArray(a) && Array.isArray(b)) {
      const d = diffUnkeyedList(a, b)
      if (d) diff[k] = d
      continue
    }
    diffValues(k, a, b, diff)
  }
  return diff
}

export default computeStateDiff
