import React, { useMemo, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import StoreScopeSwitcher from '../../components/layout/StoreScopeSwitcher.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import { Field, Fieldset, Toggle, CollapsibleSection } from '../../components/catalog/FormControls.jsx'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { getCategories, getCategory, getProducts, nextCategoryId } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatCurrency } from '../../utils/formatters.js'

/* ROUTES rows 44 & 45 — /admin/catalog/category/ and
 * /admin/catalog/category/edit/id/:id/. Both render the same page: the tree on
 * the left, the edit form for the selected category on the right. The source
 * titles the page "<Name> (ID: <id>)".
 */

function buildTree(categories) {
  const byParent = new Map()
  for (const c of categories) {
    const key = String(c.parent_id)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position || a.entity_id - b.entity_id)
  return byParent
}

function TreeNode({ node, byParent, activeId, onSelect, expanded, toggle }) {
  const children = byParent.get(String(node.entity_id)) || []
  const isOpen = expanded.has(node.entity_id)
  return (
    <li>
      <div className="admin__category-tree-node">
        {children.length ? (
          <button
            type="button"
            className="admin__category-tree-toggle"
            aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={isOpen}
            onClick={() => toggle(node.entity_id)}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : <span className="admin__category-tree-toggle" aria-hidden="true" />}
        <button
          type="button"
          className={`admin__category-tree-link${String(activeId) === String(node.entity_id) ? ' _active' : ''}`}
          onClick={() => onSelect(node.entity_id)}
        >
          {/* Source label: `Default Category (ID: 2) (1181)` — the id segment is
            * the only place the tree exposes a category's id (BUG-106). */}
          {node.name} (ID: {node.entity_id}) ({node.product_count})
        </button>
      </div>
      {isOpen && children.length ? (
        <ul>
          {children.map(c => (
            <TreeNode
              key={c.entity_id}
              node={c}
              byParent={byParent}
              activeId={activeId}
              onSelect={onSelect}
              expanded={expanded}
              toggle={toggle}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export default function CategoryPage() {
  const params = useParams()
  const { state, patchCategory, addCategory, deleteCategories, patchProduct, addMessage } = useApp()
  const navigate = useSidNavigate()

  const categories = useMemo(() => getCategories(state), [state])
  const byParent = useMemo(() => buildTree(categories), [categories])

  // Default Category (id 2) is the root the source lands on.
  const activeId = params.id ? Number(params.id) : 2
  const category = getCategory(state, activeId)

  const [expanded, setExpanded] = useState(() => new Set([1, 2]))
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (!category) { setForm(null); return }
    setForm({
      is_active: Number(category.is_active) === 1,
      include_in_menu: Number(category.include_in_menu) === 1,
      name: category.name || '',
      description: category.description || '',
      url_key: category.url_key || '',
      is_anchor: Number(category.is_anchor) === 1,
      meta_title: category.meta_title || '',
      meta_keywords: category.meta_keywords || '',
      meta_description: category.meta_description || '',
      custom_design: category.custom_design ?? '',
    })
    // keep the path to the selected node open
    setExpanded(prev => {
      const next = new Set(prev)
      for (const seg of String(category.path || '').split('/')) next.add(Number(seg))
      return next
    })
  }, [activeId, category?.name])

  const products = useMemo(() => getProducts(state), [state])
  const inCategory = useMemo(
    () => products.filter(p => (p.category_ids || []).includes(activeId)),
    [products, activeId])
  const notInCategory = useMemo(
    () => products.filter(p => !(p.category_ids || []).includes(activeId)),
    [products, activeId])

  function toggle(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function select(id) {
    navigate(`/admin/catalog/category/edit/id/${id}/`)
  }

  function save() {
    patchCategory(activeId, {
      is_active: form.is_active ? 1 : 0,
      include_in_menu: form.include_in_menu ? 1 : 0,
      name: form.name,
      description: form.description,
      url_key: form.url_key,
      is_anchor: form.is_anchor ? 1 : 0,
      meta_title: form.meta_title,
      meta_keywords: form.meta_keywords,
      meta_description: form.meta_description,
      // HANDLERS-026 — bound in the Design section, so it has to be saved.
      custom_design: form.custom_design || null,
    })
    addMessage('You saved the category.')
  }

  /**
   * The source's tree starts at `Default Category (ID: 2)`; Magento's synthetic
   * `Root Catalog` (entity_id 1, the parent of every store root) is never
   * rendered (BUG-106). Children of 0 other than id 1 are kept so a category
   * created by "Add Root Category" still appears.
   */
  const roots = [
    ...(byParent.get('1') || []),
    ...(byParent.get('0') || []).filter(c => String(c.entity_id) !== '1'),
  ]
  const title = category ? `${category.name} (ID: ${category.entity_id})` : 'Categories'

  /**
   * HANDLERS-020 — the source's two create buttons sit above the tree and both
   * open a blank form for a new child of the given parent (0 for a root). The
   * mock creates the row immediately and navigates to it, so the new id is in
   * the URL and the state footprint lands on the click.
   */
  function addChildOf(parentId) {
    const parent = parentId ? getCategory(state, parentId) : null
    const id = nextCategoryId(state)
    const siblings = byParent.get(String(parentId)) || []
    addCategory({
      entity_id: id,
      parent_id: parentId,
      path: parent ? `${parent.path}/${id}` : String(id),
      position: siblings.length + 1,
      level: parent ? Number(parent.level) + 1 : 0,
      children_count: 0,
      name: 'New Category',
      is_active: 1,
      include_in_menu: 1,
      is_anchor: 0,
      url_key: '',
      description: '',
      meta_title: '',
      meta_keywords: '',
      meta_description: '',
      product_count: 0,
    })
    setExpanded(prev => new Set([...prev, parentId]))
    navigate(`/admin/catalog/category/edit/id/${id}/`)
  }

  function removeCategory() {
    if (!category) return
    // The source cascades: deleting a node deletes its whole subtree.
    const subtree = categories
      .filter(c => c.entity_id === activeId || String(c.path || '').split('/').includes(String(activeId)))
      .map(c => c.entity_id)
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete this category?')) return
    deleteCategories(subtree)
    addMessage('You deleted the category.')
    navigate(`/admin/catalog/category/edit/id/${category.parent_id || 2}/`)
  }

  // Source toolbar (assets/html/catalog-category-edit-3.html):
  // Scope: All Store Views | What is this? | Delete | Save
  const actions = (
    <>
      {/* The source opens the category toolbar with the scope switcher
        * (`#store-change-button`, label "All Store Views"); it was missing
        * here entirely, so `page.click('#store-change-button')` found nothing
        * on all three category routes (DOM F-01). */}
      <StoreScopeSwitcher label="Scope:" />
      {/* The source omits Delete entirely on the root categories — compare
        * assets/html/catalog-category.html (id 2, Save only) with
        * catalog-category-edit-3.html (id 3, Delete + Save). */}
      {category && activeId > 2 ? (
        <button type="button" id="delete" className="action-default" onClick={removeCategory}>
          Delete
        </button>
      ) : null}
      <button type="button" id="save" className="action-secondary" onClick={save} disabled={!form}>
        Save
      </button>
    </>
  )

  const productColumns = [
    { id: 'entity_id', label: 'ID', filterType: 'range' },
    { id: 'name', label: 'Name', filterType: 'text' },
    { id: 'sku', label: 'SKU', filterType: 'text' },
    {
      id: 'price',
      label: 'Price',
      filterType: 'range',
      render: r => formatCurrency(r.price),
      exportValue: r => formatCurrency(r.price),
      sortValue: r => Number(r.price ?? 0),
    },
    {
      id: 'position',
      // HANDLERS-021 — `catalog_category_product.position`; the source shows
      // the row's ordinal within the category, not a blank cell.
      label: 'Position',
      sortable: false,
      render: r => String(inCategory.findIndex(x => x.entity_id === r.entity_id) + 1),
      searchValue: r => String(inCategory.findIndex(x => x.entity_id === r.entity_id) + 1),
    },
  ]

  /* HANDLERS-021 — assign/unassign. The source's grid has an "in category"
   * checkbox per row; the mock uses the shared grid's mass actions, which gives
   * both directions and reaches saveState through patchProduct. */
  const categoryProductActions = [
    {
      id: 'unassign',
      label: 'Remove from Category',
      onApply: (ids) => {
        for (const id of ids) {
          const p = products.find(x => String(x.entity_id) === String(id))
          if (!p) continue
          patchProduct(id, { category_ids: (p.category_ids || []).filter(c => c !== activeId) })
        }
        addMessage(`A total of ${ids.length} record(s) were updated.`)
      },
    },
  ]

  const unassignedColumns = productColumns.filter(c => c.id !== 'position')
  const unassignedActions = [
    {
      id: 'assign',
      label: 'Add to Category',
      onApply: (ids) => {
        for (const id of ids) {
          const p = products.find(x => String(x.entity_id) === String(id))
          if (!p) continue
          patchProduct(id, { category_ids: [...new Set([...(p.category_ids || []), activeId])] })
        }
        addMessage(`A total of ${ids.length} record(s) were updated.`)
      },
    },
  ]

  return (
    <PageShell title={title} actions={actions}>
      <div className="admin__category-layout">
        <div className="admin__category-tree-wrap">
          <div className="sidebar-actions admin__category-tree-actions">
            <button
              type="button"
              id="add_root_category_button"
              className="action-default scalable add"
              data-ui-id="category-tree-add-root-button"
              onClick={() => addChildOf(1)}
            >
              Add Root Category
            </button>
            <button
              type="button"
              id="add_subcategory_button"
              className="action-default scalable add"
              data-ui-id="category-tree-add-sub-button"
              onClick={() => addChildOf(activeId)}
              disabled={!category}
            >
              Add Subcategory
            </button>
          </div>
          <div className="admin__category-tree-actions">
            <button
              type="button"
              className="action-secondary"
              onClick={() => setExpanded(new Set(categories.map(c => c.entity_id)))}
            >
              Expand All
            </button>
            <button type="button" className="action-default" onClick={() => setExpanded(new Set([1, 2]))}>
              Collapse All
            </button>
          </div>
          <ul className="admin__category-tree">
            {roots.map(r => (
              <TreeNode
                key={r.entity_id}
                node={r}
                byParent={byParent}
                activeId={activeId}
                onSelect={select}
                expanded={expanded}
                toggle={toggle}
              />
            ))}
          </ul>
        </div>

        <div className="admin__category-form">
          {form ? (
            <form onSubmit={e => { e.preventDefault(); save() }}>
              <Fieldset>
                <Field label="Enable Category" htmlFor="category-is-active">
                  <Toggle
                    id="category-is-active"
                    name="is_active"
                    checked={form.is_active}
                    onChange={v => setForm(f => ({ ...f, is_active: v }))}
                  />
                </Field>
                <Field label="Include in Menu" htmlFor="category-include-in-menu">
                  <Toggle
                    id="category-include-in-menu"
                    name="include_in_menu"
                    checked={form.include_in_menu}
                    onChange={v => setForm(f => ({ ...f, include_in_menu: v }))}
                  />
                </Field>
                <Field label="Category Name" required htmlFor="category-name">
                  <input
                    id="category-name"
                    name="name"
                    className="admin__control-text"
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </Field>
              </Fieldset>

              <CollapsibleSection title="Content" dataIndex="content">
                <Field label="Description" htmlFor="category-description">
                  <textarea
                    id="category-description"
                    name="description"
                    className="admin__control-textarea"
                    rows={8}
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </Field>
              </CollapsibleSection>

              <CollapsibleSection title="Display Settings" dataIndex="display-settings">
                <Field label="Anchor" htmlFor="category-is-anchor">
                  <Toggle
                    id="category-is-anchor"
                    name="is_anchor"
                    checked={form.is_anchor}
                    onChange={v => setForm(f => ({ ...f, is_anchor: v }))}
                  />
                </Field>
              </CollapsibleSection>

              <CollapsibleSection title="Search Engine Optimization" dataIndex="search-engine-optimization">
                <Field label="URL Key" htmlFor="category-url-key">
                  <input
                    id="category-url-key"
                    name="url_key"
                    className="admin__control-text"
                    type="text"
                    value={form.url_key}
                    onChange={e => setForm(f => ({ ...f, url_key: e.target.value }))}
                  />
                </Field>
                <Field label="Meta Title" htmlFor="category-meta-title">
                  <input
                    id="category-meta-title"
                    name="meta_title"
                    className="admin__control-text"
                    type="text"
                    value={form.meta_title}
                    onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                  />
                </Field>
                <Field label="Meta Keywords" htmlFor="category-meta-keywords">
                  <textarea
                    id="category-meta-keywords"
                    name="meta_keywords"
                    className="admin__control-textarea"
                    rows={3}
                    value={form.meta_keywords}
                    onChange={e => setForm(f => ({ ...f, meta_keywords: e.target.value }))}
                  />
                </Field>
                <Field label="Meta Description" htmlFor="category-meta-description">
                  <textarea
                    id="category-meta-description"
                    name="meta_description"
                    className="admin__control-textarea"
                    rows={3}
                    value={form.meta_description}
                    onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                  />
                </Field>
              </CollapsibleSection>

              <CollapsibleSection title="Products in Category" dataIndex="assign-products">
                <AdminGrid
                  gridId={`category_products_${activeId}`}
                  rows={inCategory}
                  columns={productColumns}
                  rowKey={r => r.entity_id}
                  selectable
                  massActions={categoryProductActions}
                  exportFileName={`category-${activeId}-products`}
                  defaultSort={{ field: 'entity_id', direction: 'asc' }}
                  searchPlaceholder="Search by keyword"
                />
                <div className="admin__form-section-title">Products Not in Category</div>
                <AdminGrid
                  gridId={`category_products_available_${activeId}`}
                  rows={notInCategory}
                  columns={unassignedColumns}
                  rowKey={r => r.entity_id}
                  selectable
                  massActions={unassignedActions}
                  exportFileName={`category-${activeId}-available-products`}
                  defaultSort={{ field: 'entity_id', direction: 'asc' }}
                  searchPlaceholder="Search by keyword"
                />
              </CollapsibleSection>

              <CollapsibleSection title="Design" dataIndex="design">
                <Field label="Theme" htmlFor="category-custom-design" short>
                  <select
                    id="category-custom-design"
                    name="custom_design"
                    className="admin__control-select"
                    value={form.custom_design ?? ''}
                    onChange={e => setForm(f => ({ ...f, custom_design: e.target.value }))}
                  >
                    <option value="">-- Please Select --</option>
                    <option value="1">Magento Blank</option>
                    <option value="3">Magento Luma</option>
                  </select>
                </Field>
              </CollapsibleSection>
            </form>
          ) : (
            <div className="admin__data-grid-empty">Select a category from the tree.</div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
