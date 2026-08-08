/**
 * The static catalogue loader.
 *
 * 84,149 items live on disk as 23 per-category shards of positional tuples plus
 * 85 description shards. They are NEVER copied into session state — /go diffs the
 * whole state object on every call, so the catalogue is read-only reference data
 * loaded lazily and memoised in module-level Maps for the life of the page.
 *
 * See CONTRACTS.md for the published contract and assets/data_model.md for the
 * shapes this file reads.
 */
import manifest from './catalog/manifest.json'

/** Positional layout of one catalogue row. Mirrors each shard's `fields` array. */
export const CATALOG_FIELDS = [
  'id', 'cat', 'price', 'pub', 'title', 'name', 'email', 'city',
  'regionIdx', 'cityId', 'phone', 'showEmail', 'showPhone', 'imgExt', 'excerpt'
]

export const PAGE_SIZE = manifest.pageSize            // 12
export const TOTAL_ITEMS = manifest.totalItems        // 84149
export const CATEGORY_COUNTS = manifest.categories    // { "8": {count, bytes}, ... }
/**
 * The sort keys backed by a PRECOMPUTED `order.<key>` array on disk.
 *
 * `'oldest'` (`dt_pub_date ASC`) is deliberately NOT one of them: it is served by
 * reversing `order.newest` rather than by a fourth captured array. Measured
 * against the live source on `sCategory=9` — reversing `order.newest` reproduces
 * `dt_pub_date&iOrderType=asc` id-for-id on page 1 (`32464, 69456, 40883, …`),
 * page 50 (`75204, 2833, 45861, …`) and page 125 (`50224`). See `ORDER_ARRAY_KEY`.
 */
export const SORT_KEYS = ['newest', 'priceAsc', 'priceDesc']

/** sort key -> the `order.<key>` array it reads, plus whether to reverse it. */
const ORDER_ARRAY_KEY = { newest: 'newest', oldest: 'newest', priceAsc: 'priceAsc', priceDesc: 'priceDesc' }
const ORDER_REVERSED = { oldest: true }

// ---------------------------------------------------------------------------
// tuple <-> object
// ---------------------------------------------------------------------------

/** Convert a positional catalogue row into a named object. */
export function toItem(row) {
  return {
    id: row[0],
    cat: row[1],
    price: row[2],
    pub: row[3],
    title: row[4],
    name: row[5],
    email: row[6],
    city: row[7],
    regionIdx: row[8],
    cityId: row[9],
    phone: row[10],
    showEmail: row[11],
    showPhone: row[12],
    imgExt: row[13],
    excerpt: row[14]
  }
}

// ---------------------------------------------------------------------------
// lazy shard loaders — vite turns each glob entry into its own chunk
// ---------------------------------------------------------------------------

const catGlob = import.meta.glob('./catalog/cat-*.json')
const descGlob = import.meta.glob('./descriptions/desc-*.json')
const globalOrderGlob = import.meta.glob('./catalog/global-order.json')
const itemCatGlob = import.meta.glob('./catalog/item-category.json')
const homeLatestGlob = import.meta.glob('./catalog/home-latest.json')

const categoryCache = new Map()      // catId -> Promise<CategoryShard>
const descriptionCache = new Map()   // shardIdx -> Promise<Record<string,string>>
let allPromise = null
let globalOrderPromise = null
let itemCategoryPromise = null

function unwrap(mod) {
  return mod && mod.default !== undefined ? mod.default : mod
}

/**
 * Load one category shard.
 * @returns {Promise<{cat:number,count:number,items:Object[],byId:Map<number,Object>,order:{newest:number[],priceAsc:number[],priceDesc:number[]}}>}
 */
export function loadCategory(catId) {
  const id = Number(catId)
  if (categoryCache.has(id)) return categoryCache.get(id)
  const loader = catGlob[`./catalog/cat-${id}.json`]
  if (!loader) {
    const empty = Promise.resolve({ cat: id, count: 0, items: [], byId: new Map(), order: { newest: [], priceAsc: [], priceDesc: [] } })
    categoryCache.set(id, empty)
    return empty
  }
  const p = loader().then(mod => {
    const raw = unwrap(mod)
    const items = raw.items.map(toItem)
    const byId = new Map()
    for (const it of items) byId.set(it.id, it)
    return { cat: raw.cat, count: raw.count, items, byId, order: raw.order }
  })
  categoryCache.set(id, p)
  return p
}

/**
 * Load the full description text for one item.
 * @returns {Promise<string|null>}
 */
export function loadDescription(itemId) {
  const id = Number(itemId)
  const shard = Math.floor(id / 1000)
  let p = descriptionCache.get(shard)
  if (!p) {
    const loader = descGlob[`./descriptions/desc-${shard}.json`]
    p = loader ? loader().then(unwrap) : Promise.resolve({})
    descriptionCache.set(shard, p)
  }
  return p.then(map => (map && map[String(id)] !== undefined ? map[String(id)] : null))
}

/**
 * The captured global (all-categories) sort orders.
 *
 * NOTE: these are PARTIAL by design. `assets/dump-orderings.py` replays the
 * source's own `LIMIT 12 OFFSET n` queries to capture MySQL's real tie order,
 * and caps the all-categories listing at `GLOBAL_PAGES = 200` (2,400 ids) —
 * no anchor route pages it deeper. `loadAll()` extends each array with the
 * remaining ids in deterministic order so the counter still reads 84149 and
 * deep pages still render. See `globalOrderFull`.
 */
export function loadGlobalOrder() {
  if (!globalOrderPromise) {
    const loader = globalOrderGlob['./catalog/global-order.json']
    globalOrderPromise = loader ? loader().then(unwrap) : Promise.resolve({ newest: [], priceAsc: [], priceDesc: [] })
  }
  return globalOrderPromise
}

/**
 * id -> category id index (a flat array indexed by item id, 0 = no such item).
 * Derived from the shards; lets the item route load exactly one shard.
 */
export function loadItemCategoryIndex() {
  if (!itemCategoryPromise) {
    const loader = itemCatGlob['./catalog/item-category.json']
    itemCategoryPromise = loader ? loader().then(unwrap) : Promise.resolve({ maxId: 0, cat: [] })
  }
  return itemCategoryPromise
}

/** @returns {Promise<number>} the category id owning `itemId`, or 0. */
export function categoryOf(itemId) {
  const id = Number(itemId)
  return loadItemCategoryIndex().then(idx => (id >= 0 && id < idx.cat.length ? idx.cat[id] : 0))
}

/**
 * Load every catalogue shard in parallel and merge them.
 * Required by the 9 anchor routes that search or sort across all categories.
 * ~11.7 MB gzipped, once per page load, then cached.
 * @returns {Promise<{count:number,items:Object[],byId:Map<number,Object>,order:{newest:number[],priceAsc:number[],priceDesc:number[]}}>}
 */
export function loadAll() {
  if (allPromise) return allPromise
  const catIds = Object.keys(CATEGORY_COUNTS).map(Number).sort((a, b) => a - b)
  allPromise = Promise.all([
    Promise.all(catIds.map(c => loadCategory(c))),
    loadGlobalOrder()
  ]).then(([shards, captured]) => {
    const byId = new Map()
    const items = []
    for (const s of shards) {
      for (const it of s.items) { byId.set(it.id, it); items.push(it) }
    }
    const order = {}
    for (const key of SORT_KEYS) {
      order[key] = globalOrderFull(key, captured[key] || [], items)
    }
    return { count: items.length, items, byId, order }
  })
  return allPromise
}

/**
 * Captured prefix (the source's real tie order for the first 200 pages) followed
 * by every remaining id in the deterministic order documented in DESIGN.md
 * §Ordering (sort column, then `pk_i_id ASC`).
 */
function globalOrderFull(key, capturedIds, items) {
  if (capturedIds.length >= items.length) return capturedIds.slice(0, items.length)
  const seen = new Set(capturedIds)
  const rest = items.filter(it => !seen.has(it.id))
  rest.sort(comparator(key))
  return capturedIds.concat(rest.map(it => it.id))
}

let homeLatestPromise = null

/**
 * The 60 newest rows site-wide, precomputed so the home page does NOT have to
 * pull all 23 shards just to show `maxLatestItems@home = 12` cards.
 * Derived from catalog/global-order.json `newest` — same tuple layout.
 * @returns {Promise<Object[]>} items in newest order
 */
export function loadHomeLatest() {
  if (!homeLatestPromise) {
    const loader = homeLatestGlob['./catalog/home-latest.json']
    homeLatestPromise = loader
      ? loader().then(mod => unwrap(mod).items.map(toItem))
      : Promise.resolve([])
  }
  return homeLatestPromise
}

/**
 * Every description shard. Only the global keyword-search path should ever want
 * this (~41 MB) — prefer the 250-char `excerpt` already on the catalogue row.
 * @returns {Promise<Map<number,string>>}
 */
export function loadAllDescriptions() {
  const shards = manifest.descriptionShards
  return Promise.all(shards.map(n => {
    let p = descriptionCache.get(n)
    if (!p) {
      const loader = descGlob[`./descriptions/desc-${n}.json`]
      p = loader ? loader().then(unwrap) : Promise.resolve({})
      descriptionCache.set(n, p)
    }
    return p
  })).then(maps => {
    const out = new Map()
    for (const m of maps) for (const k in m) out.set(Number(k), m[k])
    return out
  })
}

// ---------------------------------------------------------------------------
// session-state precedence  (assets/data_model.md §0)
// ---------------------------------------------------------------------------

export function isDeleted(id, state) {
  return !!(state && state.deletedItemIds && state.deletedItemIds.includes(Number(id)))
}

export function findNewItem(id, state) {
  if (!state || !state.newItems) return null
  return state.newItems.find(i => Number(i.id) === Number(id)) || null
}

/** Apply `state.itemOverrides[id]` on top of a catalogue row. */
export function applyOverrides(item, state) {
  if (!item || !state || !state.itemOverrides) return item
  const ov = state.itemOverrides[item.id] || state.itemOverrides[String(item.id)]
  return ov ? { ...item, ...ov } : item
}

/**
 * Resolve one item, honouring the precedence in assets/data_model.md §0:
 *   deletedItemIds -> newItems -> catalog -> itemOverrides
 * @returns {Promise<Object|null>} null means "render the 404 body".
 */
export async function getItem(id, state) {
  const numId = Number(id)
  if (!Number.isFinite(numId)) return null
  if (isDeleted(numId, state)) return null
  const created = findNewItem(numId, state)
  if (created) return applyOverrides(created, state)
  const cat = await categoryOf(numId)
  if (!cat) return null
  const shard = await loadCategory(cat)
  const base = shard.byId.get(numId)
  if (!base) return null
  return applyOverrides(base, state)
}

/** Sync variant for when the owning shard is already in hand. */
export function getItemFrom(id, state, byId) {
  const numId = Number(id)
  if (isDeleted(numId, state)) return null
  const created = findNewItem(numId, state)
  if (created) return applyOverrides(created, state)
  const base = byId.get(numId)
  return base ? applyOverrides(base, state) : null
}

// ---------------------------------------------------------------------------
// ordering
// ---------------------------------------------------------------------------

/** Sort value for one item under a given sort key. */
function sortValue(item, sort) {
  if (sort === 'priceAsc' || sort === 'priceDesc') return item.price
  return item.pub
}

function comparator(sort) {
  if (sort === 'priceAsc') return (a, b) => (a.price - b.price) || (a.id - b.id)
  if (sort === 'priceDesc') return (a, b) => (b.price - a.price) || (a.id - b.id)
  // oldest: dt_pub_date ASC, id ASC
  if (sort === 'oldest') return (a, b) => (a.pub > b.pub ? 1 : a.pub < b.pub ? -1 : a.id - b.id)
  // newest: dt_pub_date DESC, id ASC
  return (a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : a.id - b.id)
}

/**
 * The ordered id list for a scope, with session state folded in:
 * deleted ids removed, agent-created items merged into the right position.
 *
 * NEVER re-sorts the catalogue — it slices the precomputed `order` arrays, so
 * deep pages (iPage=331) land on exactly the items recon measured.
 *
 * @param {{catId?:number|null, sort?:string, state?:object}} opts
 * @returns {Promise<{ids:number[], byId:Map<number,Object>}>}
 */
export async function getOrderedIds({ catId = null, sort = 'newest', state = null } = {}) {
  const key = ORDER_ARRAY_KEY[sort] ? sort : 'newest'
  const arrayKey = ORDER_ARRAY_KEY[key]
  let base, byId
  if (catId) {
    const shard = await loadCategory(catId)
    base = shard.order[arrayKey] || []
    byId = shard.byId
  } else {
    const all = await loadAll()
    base = all.order[arrayKey] || []
    byId = all.byId
  }
  // `oldest` is `newest` read backwards — never a re-sort, so deep anchor pages
  // (iPage=331) keep landing on exactly the ids recon measured.
  if (ORDER_REVERSED[key]) base = base.slice().reverse()

  const deleted = state && state.deletedItemIds && state.deletedItemIds.length
    ? new Set(state.deletedItemIds.map(Number))
    : null
  let ids = deleted ? base.filter(id => !deleted.has(id)) : base.slice()

  const created = (state && state.newItems ? state.newItems : [])
    .filter(i => (!catId || Number(i.cat) === Number(catId)) && !(deleted && deleted.has(Number(i.id))))
  if (created.length) {
    const cmp = comparator(key)
    const lookup = new Map(byId)
    for (const it of created) lookup.set(Number(it.id), it)
    const merged = created.slice().sort(cmp)
    const out = []
    let mi = 0
    for (const id of ids) {
      const cur = lookup.get(id)
      while (mi < merged.length && cur && cmp(merged[mi], cur) <= 0) out.push(merged[mi++].id)
      out.push(id)
    }
    while (mi < merged.length) out.push(merged[mi++].id)
    ids = out
    return { ids, byId: lookup }
  }

  return { ids, byId }
}

/** Materialise one page of items (state-resolved) from an ordered id list. */
export function pageOf(ids, byId, page, state, pageSize = PAGE_SIZE) {
  const offset = Math.max(page - 1, 0) * pageSize
  return ids.slice(offset, offset + pageSize)
    .map(id => getItemFrom(id, state, byId))
    .filter(Boolean)
}

export { sortValue }
