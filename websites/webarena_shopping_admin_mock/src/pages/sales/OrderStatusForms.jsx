import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { STATE_OPTIONS } from '../../components/sales/orderStatusHelpers.js'
import '../../components/sales/sales.css'

/* ROUTES.md row 38 — the two pages behind the Order Status grid buttons.
 *
 *   /admin/sales/order_status/new/     Create New Order Status
 *   /admin/sales/order_status/assign/  Assign Order Status to State
 *
 * Field labels, fieldset legends, button labels and flash messages are the
 * source's own (Block/Adminhtml/Order/Status/NewStatus{,/Form}.php,
 * .../Assign{,/Form}.php, Controller/Adminhtml/Order/Status/{Save,AssignPost}.php).
 * Both write through the context so the change reaches saveState() and shows up
 * in /go state_diff.
 */

const GRID_URL = '/admin/sales/order_status/'

export function OrderStatusNew() {
  const { state, addCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()

  const [status, setStatus] = useState('')
  const [label, setLabel] = useState('')
  const [storeLabel, setStoreLabel] = useState('')

  function save() {
    const code = status.trim()
    if (!code || !label.trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    if (!/^[a-z0-9_]+$/i.test(code)) {
      addMessage('Please use only letters (a-z or A-Z), numbers (0-9) or underscore (_) in this field, '
        + 'and the first character should be a letter.', 'error')
      return
    }
    if ((state.orderStatuses || []).some(s => String(s.status) === code)) {
      addMessage('We found another order status with the same order status code.', 'error')
      return
    }
    addCollectionItem('orderStatuses', {
      status: code,
      label: label.trim(),
      state: null,
      is_default: 0,
      visible_on_front: 0,
      store_label: storeLabel.trim() || null,
    })
    addMessage('You saved the order status.')
    navigate(GRID_URL)
  }

  return (
    <PageShell
      title="Create New Order Status"
      documentTitle="Create New Order Status"
      actions={
        /* G-01 class — the source's toolbar carries a
           `sales-order-status-new-container-*` `data-ui-id` on every button
           and has a Reset the mock was missing. */
        <div className="page-actions-buttons">
          <button
            id="back"
            title="Back"
            type="button"
            data-ui-id="sales-order-status-new-container-back-button"
            className="action-default scalable back"
            onClick={() => navigate(GRID_URL)}
          >
            <span>Back</span>
          </button>
          <button
            id="reset"
            title="Reset"
            type="button"
            data-ui-id="sales-order-status-new-container-reset-button"
            className="action-default scalable reset"
            onClick={() => { setStatus(''); setLabel(''); setStoreLabel('') }}
          >
            <span>Reset</span>
          </button>
          <button
            id="save"
            title="Save Status"
            type="button"
            data-ui-id="sales-order-status-new-container-save-button"
            className="action-default scalable save primary"
            onClick={save}
          >
            <span>Save Status</span>
          </button>
        </div>
      }
    >
      <form id="edit_form" className="admin__fieldset-wrapper" onSubmit={e => e.preventDefault()}>
        <fieldset className="admin__fieldset" id="base_fieldset">
          <legend className="admin__legend"><span>Order Status Information</span></legend>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="status"><span>Status Code</span></label>
            <div className="admin__field-control">
              <input
                id="status"
                name="status"
                type="text"
                className="admin__control-text required-entry validate-code"
                value={status}
                onChange={e => setStatus(e.target.value)}
              />
            </div>
          </div>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="label"><span>Status Label</span></label>
            <div className="admin__field-control">
              <input
                id="label"
                name="label"
                type="text"
                className="admin__control-text required-entry"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="admin__fieldset store-scope" id="store_labels_fieldset">
          <legend className="admin__legend"><span>Store View Specific Labels</span></legend>
          <div className="admin__field admin__field-website"><span>Main Website</span></div>
          <div className="admin__field admin__field-store-group"><span>Main Website Store</span></div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="store_label_1"><span>Default Store View</span></label>
            <div className="admin__field-control">
              <input
                id="store_label_1"
                name="store_labels[1]"
                type="text"
                className="admin__control-text"
                value={storeLabel}
                onChange={e => setStoreLabel(e.target.value)}
              />
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* HANDLERS-034 — `/admin/sales/order_status/edit/status/:status/` is a real editor
 * on the source, not an alias of the grid. Verified live against
 * `/admin/sales/order_status/edit/status/processing/`:
 *   h1        Edit Order Status
 *   toolbar   Back · Reset · Save Status   (ids back / reset / save)
 *   fieldsets Order Status Information · Store View Specific Labels
 *   fields    #label (name="label") and #store_label_1 (name="store_labels[1]")
 * The Status Code is NOT editable here — the source renders no `status` input on
 * the edit form, only on `new`. */
export function OrderStatusEdit() {
  const { state, updateCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()
  const { status } = useParams()

  /* `orderStatuses` is the seed's `sales_order_status_state` join, so one code can
   * appear on more than one row; the label is per-code, so the first row wins. */
  const record = (state?.orderStatuses || []).find(s => String(s.status) === String(status))

  const [label, setLabel] = useState(record ? (record.label || '') : '')
  const [storeLabel, setStoreLabel] = useState(record ? (record.store_label || '') : '')
  const [seeded, setSeeded] = useState(!!record)

  /* The context hydrates asynchronously on a cold deep link, so seed the draft the
   * first render the record actually exists. */
  useEffect(() => {
    if (!seeded && record) {
      setLabel(record.label || '')
      setStoreLabel(record.store_label || '')
      setSeeded(true)
    }
  }, [seeded, record])

  function reset() {
    setLabel(record ? (record.label || '') : '')
    setStoreLabel(record ? (record.store_label || '') : '')
  }

  function save() {
    if (!record) {
      addMessage("We can't find this order status.", 'error')
      return
    }
    if (!label.trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    updateCollectionItem('orderStatuses', 'status', record.status, {
      label: label.trim(),
      store_label: storeLabel.trim() || null,
    })
    addMessage('You saved the order status.')
    navigate(GRID_URL)
  }

  return (
    <PageShell
      title="Edit Order Status"
      documentTitle="Edit Order Status"
      actions={
        <div className="page-actions-buttons">
          <button id="back" title="Back" type="button"
            data-ui-id="sales-order-status-edit-container-back-button"
            className="action-default scalable back" onClick={() => navigate(GRID_URL)}>
            <span>Back</span>
          </button>
          <button id="reset" title="Reset" type="button"
            data-ui-id="sales-order-status-edit-container-reset-button"
            className="action-default scalable reset" onClick={reset}>
            <span>Reset</span>
          </button>
          <button id="save" title="Save Status" type="button"
            data-ui-id="sales-order-status-edit-container-save-button"
            className="action-default scalable save primary" onClick={save}>
            <span>Save Status</span>
          </button>
        </div>
      }
    >
      <form id="edit_form" className="admin__fieldset-wrapper" onSubmit={e => e.preventDefault()}>
        <fieldset className="admin__fieldset" id="base_fieldset">
          <legend className="admin__legend"><span>Order Status Information</span></legend>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="label"><span>Status Label</span></label>
            <div className="admin__field-control">
              <input
                id="label"
                name="label"
                type="text"
                className="required-entry input-text admin__control-text required-entry _required"
                data-ui-id="sales-order-status-edit-container-form-fieldset-element-text-label"
                aria-required="true"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="admin__fieldset store-scope" id="store_labels_fieldset">
          <legend className="admin__legend"><span>Store View Specific Labels</span></legend>
          <div className="admin__field admin__field-website"><span>Main Website</span></div>
          <div className="admin__field admin__field-store-group"><span>Main Website Store</span></div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="store_label_1"><span>Default Store View</span></label>
            <div className="admin__field-control">
              <input
                id="store_label_1"
                name="store_labels[1]"
                type="text"
                className=" input-text admin__control-text"
                data-ui-id="sales-order-status-edit-container-form-fieldset-element-text-store-labels-1"
                value={storeLabel}
                onChange={e => setStoreLabel(e.target.value)}
              />
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

export function OrderStatusAssign() {
  const { state, updateCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()

  /* BUG-001. `orderStatuses` is the seed's `sales_order_status_state` join, so a
   * status assigned to two states appears twice (`fraud` -> payment_review and
   * processing). The source's Order Status select is populated from
   * `sales_order_status`, i.e. one option per distinct status code. */
  const statuses = Object.values(
    (state.orderStatuses || []).reduce((acc, s) => {
      if (!acc[s.status]) acc[s.status] = s
      return acc
    }, {}))
  const [status, setStatus] = useState('')
  const [orderState, setOrderState] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [visibleOnFront, setVisibleOnFront] = useState(true)

  function save() {
    if (!status || !orderState) {
      addMessage('This is a required field.', 'error')
      return
    }
    if (!statuses.some(s => String(s.status) === status)) {
      addMessage("We can't find this order status.", 'error')
      return
    }
    updateCollectionItem('orderStatuses', 'status', status, {
      state: orderState,
      is_default: isDefault ? 1 : 0,
      visible_on_front: visibleOnFront ? 1 : 0,
    })
    addMessage('You assigned the order status.')
    navigate(GRID_URL)
  }

  return (
    <PageShell
      title="Assign Order Status to State"
      documentTitle="Assign Order Status to State"
      actions={
        <div className="page-actions-buttons">
          <button
            id="back"
            title="Back"
            type="button"
            data-ui-id="sales-order-status-assign-container-back-button"
            className="action-default scalable back"
            onClick={() => navigate(GRID_URL)}
          >
            <span>Back</span>
          </button>
          {/* F-07 — the source's toolbar here is Back · Reset · Save Status
              Assignment; the mock was missing Reset entirely, so
              `page.click('#reset')` timed out. */}
          <button
            id="reset"
            title="Reset"
            type="button"
            data-ui-id="sales-order-status-assign-container-reset-button"
            className="action-default scalable reset"
            onClick={() => { setStatus(''); setOrderState(''); setIsDefault(false); setVisibleOnFront(true) }}
          >
            <span>Reset</span>
          </button>
          <button
            id="save"
            title="Save Status Assignment"
            type="button"
            data-ui-id="sales-order-status-assign-container-save-button"
            className="action-default scalable save primary"
            onClick={save}
          >
            <span>Save Status Assignment</span>
          </button>
        </div>
      }
    >
      <form id="edit_form" className="admin__fieldset-wrapper" onSubmit={e => e.preventDefault()}>
        <fieldset className="admin__fieldset" id="base_fieldset">
          <legend className="admin__legend"><span>Assignment Information</span></legend>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="status"><span>Order Status</span></label>
            <div className="admin__field-control">
              <select
                id="status"
                name="status"
                className="admin__control-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="" />
                {statuses.map(s => (
                  <option key={s.status} value={s.status}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="state"><span>Order State</span></label>
            <div className="admin__field-control">
              <select
                id="state"
                name="state"
                className="admin__control-select"
                value={orderState}
                onChange={e => setOrderState(e.target.value)}
              >
                <option value="" />
                {STATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin__field admin__field-option">
            <input
              id="is_default"
              name="is_default"
              type="checkbox"
              className="admin__control-checkbox"
              value="1"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
            />
            <label className="admin__field-label" htmlFor="is_default">
              <span>Use Order Status As Default</span>
            </label>
          </div>

          <div className="admin__field admin__field-option">
            <input
              id="visible_on_front"
              name="visible_on_front"
              type="checkbox"
              className="admin__control-checkbox"
              value="1"
              checked={visibleOnFront}
              onChange={e => setVisibleOnFront(e.target.checked)}
            />
            <label className="admin__field-label" htmlFor="visible_on_front">
              <span>Visible On Storefront</span>
            </label>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}
