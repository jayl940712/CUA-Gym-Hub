import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { Field, Fieldset } from '../../components/catalog/FormControls.jsx'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { staticData as S } from '../../utils/dataManager.js'
import { useSidNavigate } from '../../utils/navigation.js'

/* ROUTES rows 48 & 49 — Stores > Attribute Set.
 * The grid's one column header is literally "Set" (assets/html/catalog-product-set.html).
 */

/**
 * `attributeSetsFull` is a static module, so a renamed set lives in the
 * `attributeSetOverlay` state key — the same `{ [id]: Partial<entity> }` shape
 * `productAttributeOverrides` uses in ProductAttributes.jsx. Everything the
 * Save button touches goes through `setState`, so it reaches `saveState()` and
 * shows up in `/go` `state_diff`.
 */
function getAttributeSet(state, id) {
  const created = (state?.newAttributeSets || []).find(s => String(s.attribute_set_id) === String(id))
  if (created) return created
  const base = S.attributeSetsFull.find(s => String(s.attribute_set_id) === String(id))
  if (!base) return null
  const patch = state?.attributeSetOverrides?.[String(id)]
  return patch ? { ...base, ...patch } : base
}

function getAttributeSets(state) {
  const patches = state?.attributeSetOverrides || {}
  const base = S.attributeSetsFull.map(s => {
    const p = patches[String(s.attribute_set_id)]
    return p ? { ...s, ...p } : s
  })
  return [...base, ...(state?.newAttributeSets || [])]
}

export function AttributeSetGrid() {
  const { state } = useApp()
  const navigate = useSidNavigate()

  const rows = useMemo(
    () => getAttributeSets(state)
      .map(s => ({ attribute_set_id: s.attribute_set_id, attribute_set_name: s.attribute_set_name, sort_order: s.sort_order }))
      .sort((a, b) => a.attribute_set_name.localeCompare(b.attribute_set_name)),
    [state?.attributeSetOverrides])

  const columns = [
    {
      /* DIFF-R102. The column's id has to be the source's own sort key, not the
       * seed's field name: the live grid's header is
       *   <th data-sort="set_name" data-direction="desc"
       *       class="data-grid-th _sortable _ascend last col-set_name">
       * and its cells are `<td data-column="set_name" class="a-left col-set_name last">`.
       * Under `attribute_set_name` the mock emitted `data-sort="attribute_set_name"`
       * and matched nothing when the URL carried the source's own
       * `/sort/set_name/dir/desc/`, so the segment was silently ignored.
       * Measured on the source, cold, one context per URL:
       *   .../product_set/index/                        Bag, Bottom, Default, Downloadable,
       *                                                 Gear, Sprite Stasis Ball,
       *                                                 Sprite Yoga Strap, Top   (_ascend)
       *   .../index/sort/set_name/dir/desc/             exactly that reversed  (_descend)
       *   .../index/sort/attribute_set_name/dir/desc/   unsorted, no _ascend/_descend
       *                                                 (the source ignores a column it
       *                                                 does not have) */
      id: 'set_name',
      label: 'Set',
      filterType: 'text',
      sortValue: r => r.attribute_set_name,
      render: r => (
        <AdminLink to={`/admin/catalog/product_set/edit/id/${r.attribute_set_id}/`}>
          {r.attribute_set_name}
        </AdminLink>
      ),
      exportValue: r => r.attribute_set_name,
      searchValue: r => r.attribute_set_name,
    },
  ]

  const actions = (
    <button
      type="button"
      className="action-primary"
      data-ui-id="page-actions-toolbar-addbutton"
      title="Add Attribute Set"
      onClick={() => navigate('/admin/catalog/product_set/add/')}
    >
      Add Attribute Set
    </button>
  )

  return (
    <PageShell title="Attribute Sets" actions={actions}>
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid
        legacyToolbarBase={0} gridId="setGrid"
        basePath="/admin/catalog/product_set/index"
        rows={rows}
        columns={columns}
        rowKey={r => r.attribute_set_id}
        exportable={false}
        defaultSort={{ field: 'set_name', direction: 'asc' }}
        rowHref={r => `/admin/catalog/product_set/edit/id/${r.attribute_set_id}/`}
      />
    </PageShell>
  )
}

/**
 * BUG-102 — Stores > Attribute Set > Add Attribute Set
 * (`/admin/catalog/product_set/add/`).
 *
 * The source form is one fieldset: `Name` (note "For internal use") and a
 * `Based On` select seeded from the existing sets. Saving copies the chosen
 * skeleton's groups, appends to `state.newAttributeSets` (visible in /go), and
 * lands on the new set's edit page — the same redirect the source performs.
 */
export function AttributeSetNew() {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const [name, setName] = useState('')
  const [basedOn, setBasedOn] = useState('4')
  const [error, setError] = useState(null)

  const skeletons = useMemo(
    () => getAttributeSets(state).slice().sort((a, b) => Number(a.attribute_set_id) - Number(b.attribute_set_id)),
    [state])

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('This is a required field.')
      addMessage('This is a required field.', 'error')
      return
    }
    if (skeletons.some(s => s.attribute_set_name.toLowerCase() === trimmed.toLowerCase())) {
      setError('An attribute set with the "' + trimmed + '" name already exists.')
      addMessage('An attribute set with the "' + trimmed + '" name already exists.', 'error')
      return
    }
    const skeleton = getAttributeSet(state, basedOn)
    const attribute_set_id = skeletons.reduce((n, s) => Math.max(n, Number(s.attribute_set_id)), 0) + 1
    const record = {
      attribute_set_id,
      attribute_set_name: trimmed,
      entity_type_id: 4,
      sort_order: skeleton?.sort_order ?? 0,
      // Magento's "Based On" clones the skeleton's groups and their attributes.
      groups: (skeleton?.groups || []).map(g => ({ ...g, attribute_ids: [...(g.attribute_ids || [])] })),
    }
    setState(prev => ({ ...prev, newAttributeSets: [...(prev.newAttributeSets || []), record] }))
    addMessage('You saved the attribute set.')
    navigate(`/admin/catalog/product_set/edit/id/${attribute_set_id}/`)
  }

  const actions = (
    <>
      <button type="button" className="action-primary" onClick={save}>Save</button>
      <button type="button" className="action-default" onClick={() => navigate('/admin/catalog/product_set/')}>Back</button>
    </>
  )

  return (
    <PageShell title="New Attribute Set" documentTitle="New Attribute Set" actions={actions}>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <Fieldset legend="Attribute Set Information">
          <Field label="Name" required htmlFor="attribute-set-name" note="For internal use" error={error}>
            <input
              id="attribute-set-name"
              name="attribute_set_name"
              className="admin__control-text"
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
            />
          </Field>
          <Field label="Based On" htmlFor="skeleton-set" short>
            <select
              id="skeleton-set"
              name="skeleton_set"
              className="admin__control-select"
              value={basedOn}
              onChange={e => setBasedOn(e.target.value)}
            >
              {skeletons.map(s => (
                <option key={s.attribute_set_id} value={String(s.attribute_set_id)}>{s.attribute_set_name}</option>
              ))}
            </select>
          </Field>
        </Fieldset>
      </form>
    </PageShell>
  )
}

export function AttributeSetEdit() {
  const params = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()

  const set = getAttributeSet(state, params.id)
  const attributeById = useMemo(
    () => new Map(S.productAttributes.map(a => [a.attribute_id, a])), [])

  const [name, setName] = useState(set?.attribute_set_name || '')
  const [openGroups, setOpenGroups] = useState(() => new Set((set?.groups || []).map(g => g.attribute_group_id)))

  if (!set) {
    return (
      <PageShell title="Edit Attribute Set">
        <div className="admin__data-grid-empty">
          That attribute set does not exist.{' '}
          <AdminLink to="/admin/catalog/product_set/">Back to Attribute Sets</AdminLink>
        </div>
      </PageShell>
    )
  }

  const assignedIds = new Set((set.groups || []).flatMap(g => g.attribute_ids || []))
  const unassigned = S.productAttributes.filter(a => !assignedIds.has(a.attribute_id))

  function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      addMessage('This is a required field.', 'error')
      return
    }
    setState(prev => ({
      ...prev,
      attributeSetOverrides: {
        ...(prev.attributeSetOverrides || {}),
        [String(set.attribute_set_id)]: {
          ...(prev.attributeSetOverrides?.[String(set.attribute_set_id)] || {}),
          attribute_set_name: trimmed,
        },
      },
    }))
    addMessage('You saved the attribute set.')
    navigate('/admin/catalog/product_set/')
  }

  function toggleGroup(id) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function resetForm() {
    setName(set.attribute_set_name || '')
    setOpenGroups(new Set((set.groups || []).map(g => g.attribute_group_id)))
  }

  /* DOM-213 — the source's page actions here are
   * `Back \u00b7 Reset \u00b7 Save \u00b7 Add New \u00b7 Delete Selected Group`,
   * and their ids are per-request hashes, so `data-ui-id` is the stable hook.
   * `Add New` / `Delete Selected Group` edit attribute *groups*, which this
   * mock has no override shape for yet, so they are left out rather than
   * rendered as dead controls (tracked as HANDLERS-035). */
  const actions = (
    <>
      <button type="button" title="Back" data-ui-id="page-actions-toolbar-back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/catalog/product_set/')}>
        Back
      </button>
      <button type="button" title="Reset" data-ui-id="page-actions-toolbar-reset-button"
        className="action-default scalable reset" onClick={resetForm}>
        Reset
      </button>
      <button
        type="button"
        title="Save"
        data-ui-id="page-actions-toolbar-save-button"
        className="action-primary save-attribute-set"
        onClick={save}
      >
        Save
      </button>
    </>
  )

  return (
    <PageShell title={set.attribute_set_name} documentTitle="Edit Attribute Set" actions={actions}>
      <Fieldset legend="Edit Attribute Set Name">
        <Field label="Name" required htmlFor="attribute_set_name">
          {/* DOM-213 — this is Magento's legacy form; `#attribute_set_name` is a
            * stable, canonical id on the source and must not be kebab-cased. */}
          <input
            id="attribute_set_name"
            name="attribute_set_name"
            data-ui-id="adminhtml-catalog-product-set-edit-edit-set-form-fieldset-element-text-attribute-set-name"
            className="admin__control-text"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>
      </Fieldset>

      <div className="admin__category-layout">
        <div className="admin__category-tree-wrap">
          <div className="admin__page-section-title">Groups</div>
          <ul className="admin__category-tree">
            {(set.groups || []).map(g => (
              <li key={g.attribute_group_id}>
                <div className="admin__category-tree-node">
                  <button
                    type="button"
                    className="admin__category-tree-toggle"
                    aria-expanded={openGroups.has(g.attribute_group_id)}
                    aria-label={`Toggle ${g.attribute_group_name}`}
                    onClick={() => toggleGroup(g.attribute_group_id)}
                  >
                    {openGroups.has(g.attribute_group_id) ? '▾' : '▸'}
                  </button>
                  <span>{g.attribute_group_name}</span>
                </div>
                {openGroups.has(g.attribute_group_id) ? (
                  <ul>
                    {(g.attribute_ids || []).map(id => {
                      const a = attributeById.get(id)
                      return (
                        <li key={id}>
                          <div className="admin__category-tree-node">
                            <span className="admin__category-tree-toggle" aria-hidden="true" />
                            <AdminLink to={`/admin/catalog/product_attribute/edit/attribute_id/${id}/`}>
                              {a ? (a.frontend_label || a.attribute_code) : `Attribute ${id}`}
                            </AdminLink>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="admin__category-form">
          <div className="admin__page-section-title">Unassigned Attributes</div>
          <ul className="admin__category-tree">
            {unassigned.map(a => (
              <li key={a.attribute_id}>
                <div className="admin__category-tree-node">
                  <span className="admin__category-tree-toggle" aria-hidden="true" />
                  <AdminLink to={`/admin/catalog/product_attribute/edit/attribute_id/${a.attribute_id}/`}>
                    {a.frontend_label || a.attribute_code}
                  </AdminLink>
                </div>
              </li>
            ))}
            {unassigned.length === 0 ? <li>No unassigned attributes.</li> : null}
          </ul>
        </div>
      </div>
    </PageShell>
  )
}
