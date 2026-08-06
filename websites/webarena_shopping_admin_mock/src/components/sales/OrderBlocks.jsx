import React from 'react'
import AdminLink from '../layout/AdminLink.jsx'
import {
  formatDate, formatCurrency, orderStatusLabel, storeViewLines, formatQty, decodeEntities,
} from '../../utils/formatters.js'
import { countryLabel, regionLabel } from './directoryData.js'
import {
  formatViewDateTime, formatNoteTime, paymentMethodTitle, orderTotals, num, visibleItems,
  orderEmailSent,
} from './orderHelpers.js'

/**
 * The building blocks shared by the order view, the invoice/shipment/credit-memo
 * views and the invoice/shipment creation forms. Structure, class names and copy
 * come from assets/html/sales-order-view-299.html and
 * assets/html/sales-order-shipment-new-308.html.
 */

/* ---------------------------------------------------------- left tab rail */

/**
 * DOM-012. Each anchor's `name` is the `active_tab/<name>` URL segment tasks
 * 496-500 navigate to, and `#sales_order_view_tabs_order_shipments` is the
 * canonical selector for the Shipments tab. Source (order 299):
 *   <a href="#sales_order_view_tabs_order_shipments_content"
 *      id="sales_order_view_tabs_order_shipments" name="order_shipments"
 *      title="Order Shipments"
 *      class="admin__page-nav-link tab-item-link ui-tabs-anchor"
 *      data-tab-type="" data-ui-id="sales-order-tabs-tab-link-order-shipments"
 *      role="presentation" tabindex="-1"><span>Shipments</span></a>
 * Comments History is the one tab the source renders as a real href to
 * `/admin/sales/order/commentsHistory/order_id/<id>/` (class `ajax only
 * notloaded`), not an in-page fragment.
 */
export const ORDER_VIEW_TABS = [
  { id: 'order_info', label: 'Information', title: 'Order Information' },
  { id: 'order_invoices', label: 'Invoices', title: 'Order Invoices' },
  { id: 'order_creditmemos', label: 'Credit Memos', title: 'Order Credit Memos' },
  { id: 'order_shipments', label: 'Shipments', title: 'Order Shipments' },
  { id: 'order_history', label: 'Comments History', title: 'Order History' },
]

export function OrderViewNav({ activeTab, onSelect, commentsHistoryHref }) {
  return (
    <div className="admin__page-nav" id="sales_order_view_tabs">
      <div className="admin__page-nav-title" id="sales-order-tabs-title">
        <strong>ORDER VIEW</strong>
      </div>
      <ul className="admin__page-nav-items">
        {ORDER_VIEW_TABS.map(tab => {
          const dash = tab.id.replace(/_/g, '-')
          const isHistory = tab.id === 'order_history'
          return (
            <li
              key={tab.id}
              id={`sales-order-tabs-tab-item-${dash}`}
              className={`admin__page-nav-item${activeTab === tab.id ? ' _active' : ''}`}
            >
              <a
                href={isHistory && commentsHistoryHref
                  ? commentsHistoryHref
                  : `#sales_order_view_tabs_${tab.id}_content`}
                id={`sales_order_view_tabs_${tab.id}`}
                name={tab.id}
                title={tab.title}
                className={`admin__page-nav-link tab-item-link${isHistory ? ' ajax only notloaded' : ''} ui-tabs-anchor`}
                data-tab-type=""
                data-ui-id={`sales-order-tabs-tab-link-${dash}`}
                role="presentation"
                tabIndex={-1}
                onClick={e => { e.preventDefault(); onSelect(tab.id) }}
              >
                <span>{tab.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* -------------------------------------------- Order & Account Information */

export function OrderAndAccountInformation({ order, customerGroup = 'General', emailSent = undefined }) {
  const customerName = `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim()
  // DIFF-016: the flag is per-order (`sales_order.email_sent`), never a constant.
  const sent = emailSent === undefined ? orderEmailSent(order) : emailSent
  return (
    <section className="admin__page-section order-view-account-information">
      <div className="admin__page-section-title">
        <span className="title">Order &amp; Account Information</span>
      </div>
      <div className="admin__page-section-content order-section-columns">
        <div className="admin__page-section-item order-information">
          <div className="admin__page-section-item-title">
            <span className="title">
              Order # {order.increment_id}{' '}
              <small>({sent ? 'The order confirmation email was sent' : 'The order confirmation email is not sent'})</small>
            </span>
          </div>
          <table className="admin__table-secondary order-information-table">
            <tbody>
              <tr>
                <th>Order Date</th>
                <td>{formatViewDateTime(order.created_at)}</td>
              </tr>
              <tr>
                <th>Order Status</th>
                <td><span id="order_status">{orderStatusLabel(order.status)}</span></td>
              </tr>
              <tr>
                <th>Purchased From</th>
                <td>
                  {storeViewLines(order.store_name).map((line, i) => (
                    <span key={i} className={`store-view-line _level-${i}`}>{line}</span>
                  ))}
                </td>
              </tr>
              {order.remote_ip ? (
                <tr>
                  <th>Placed from IP</th>
                  <td>{order.remote_ip}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="admin__page-section-item order-account-information">
          <div className="admin__page-section-item-title">
            <span className="title">Account Information</span>
            {order.customer_id ? (
              <AdminLink to={`/admin/customer/index/edit/id/${order.customer_id}/`} className="sales-order-edit-link">
                Edit Customer
              </AdminLink>
            ) : null}
          </div>
          <table className="admin__table-secondary order-account-information-table">
            <tbody>
              <tr>
                <th>Customer Name</th>
                <td>
                  {order.customer_id ? (
                    <AdminLink to={`/admin/customer/index/edit/id/${order.customer_id}/`}>{customerName}</AdminLink>
                  ) : customerName}
                </td>
              </tr>
              <tr>
                <th>Email</th>
                <td><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></td>
              </tr>
              <tr>
                <th>Customer Group</th>
                <td>{customerGroup}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- addresses */

export function AddressLines({ address }) {
  if (!address) return null
  const streets = Array.isArray(address.street) ? address.street : String(address.street || '').split('\n')
  const name = [address.prefix, address.firstname, address.middlename, address.lastname, address.suffix]
    .filter(Boolean).join(' ')
  return (
    <address>
      {name}<br />
      {address.company ? <>{address.company}<br /></> : null}
      {streets.filter(Boolean).map((s, i) => <React.Fragment key={i}>{s}<br /></React.Fragment>)}
      {/* DIFF-015: the source's own markup carries two literal spaces after the
        * city comma — `Oakland,  California, 94602` in
        * assets/html/sales-order-view-299.html — which the browser collapses to
        * one. Reproduce the same text node; do NOT use `&nbsp;`, which does not
        * collapse and would put U+00A0 in innerText where the source has a
        * plain space. */}
      {`${address.city},  ${regionLabel(address)}, ${address.postcode}`}<br />
      {countryLabel(address.country_id)}<br />
      {address.telephone ? <>T: {address.telephone}<br /></> : null}
      {address.fax ? <>F: {address.fax}<br /></> : null}
      {address.vat_id ? <>VAT: {address.vat_id}<br /></> : null}
    </address>
  )
}

export function AddressInformation({ order }) {
  const billing = (order.addresses || []).find(a => a.address_type === 'billing')
  const shipping = (order.addresses || []).find(a => a.address_type === 'shipping')
  return (
    <section className="admin__page-section order-addresses">
      <div className="admin__page-section-title">
        <span className="title">Address Information</span>
      </div>
      <div className="admin__page-section-content order-section-columns">
        <div className="admin__page-section-item order-billing-address">
          <div className="admin__page-section-item-title">
            <span className="title">Billing Address</span>
            {billing ? (
              <AdminLink to={`/admin/sales/order/address/address_id/${billing.entity_id}/`} className="sales-order-edit-link">
                Edit
              </AdminLink>
            ) : null}
          </div>
          <div className="admin__page-section-item-content order-address-block">
            <AddressLines address={billing} />
          </div>
        </div>
        <div className="admin__page-section-item order-shipping-address">
          <div className="admin__page-section-item-title">
            <span className="title">Shipping Address</span>
            {shipping ? (
              <AdminLink to={`/admin/sales/order/address/address_id/${shipping.entity_id}/`} className="sales-order-edit-link">
                Edit
              </AdminLink>
            ) : null}
          </div>
          <div className="admin__page-section-item-content order-address-block">
            <AddressLines address={shipping} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------- payment & shipping method */

export function PaymentAndShippingMethod({ order, shippingTitle = 'Shipping & Handling Information', shippingAmountLabel = null }) {
  return (
    <section className="admin__page-section order-payment-method">
      <div className="admin__page-section-title">
        <span className="title">Payment &amp; Shipping Method</span>
      </div>
      <div className="admin__page-section-content order-section-columns">
        <div className="admin__page-section-item order-payment-method-item">
          <div className="admin__page-section-item-title">
            <span className="title">Payment Information</span>
          </div>
          <div className="admin__page-section-item-content">
            <div>{paymentMethodTitle(order)}</div>
            <div className="order-payment-currency">The order was placed using USD.</div>
          </div>
        </div>
        <div className="admin__page-section-item order-shipping-method">
          <div className="admin__page-section-item-title">
            <span className="title">{shippingTitle}</span>
          </div>
          <div className="admin__page-section-item-content">
            <div className="order-shipping-method-title">{order.shipping_description}</div>
            <div className="order-shipping-method-price">
              {shippingAmountLabel ? <span>{shippingAmountLabel}&nbsp;</span> : null}
              {formatCurrency(order.shipping_amount)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- items ordered */

export function ItemProductCell({ item }) {
  return (
    <>
      {/* `sales_order_item.name` is stored HTML-encoded (`Minerva LumaTech&trade;
          V-Tee`); the source renders it decoded, and evaluators match the
          decoded string. */}
      <span className="product-title">{decodeEntities(item.name)}</span>
      <span className="product-sku-block">
        <span className="label">SKU: </span>
        <span className="value">{item.sku}</span>
      </span>
      {(item.options || []).length ? (
        <dl className="item-options">
          {item.options.map((o, i) => (
            <React.Fragment key={i}>
              <dt>{o.label}:</dt>
              <dd>{o.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
    </>
  )
}

export function ItemsOrdered({ order }) {
  return (
    <section className="admin__page-section order-items">
      <div className="admin__page-section-title">
        <span className="title">Items Ordered</span>
      </div>
      <table className="order-tables data-table admin__table-primary">
        <thead>
          <tr className="headings">
            <th className="col-product">Product</th>
            <th className="col-status">Item Status</th>
            <th className="col-price-original">Original Price</th>
            <th className="col-price">Price</th>
            <th className="col-qty">Qty</th>
            <th className="col-subtotal">Subtotal</th>
            <th className="col-tax">Tax Amount</th>
            <th className="col-tax-percent">Tax Percent</th>
            <th className="col-discount">Discount Amount</th>
            <th className="col-total">Row Total</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems(order).map(item => (
            <tr key={item.item_id} id={`order_item_${item.item_id}`}>
              <td className="col-product">
                <ItemProductCell item={item} />
              </td>
              <td className="col-status"><span className="order-item-status">Ordered</span></td>
              <td className="col-price-original">{formatCurrency(item.original_price)}</td>
              <td className="col-price">{formatCurrency(item.price)}</td>
              <td className="col-qty">
                <table className="qty-table">
                  <tbody>
                    <tr>
                      <th>Ordered</th>
                      <td>{formatQty(item.qty_ordered)}</td>
                    </tr>
                    {num(item.qty_invoiced) ? (
                      <tr><th>Invoiced</th><td>{formatQty(item.qty_invoiced)}</td></tr>
                    ) : null}
                    {num(item.qty_shipped) ? (
                      <tr><th>Shipped</th><td>{formatQty(item.qty_shipped)}</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </td>
              <td className="col-subtotal">{formatCurrency(item.row_total)}</td>
              <td className="col-tax">{formatCurrency(item.tax_amount || 0)}</td>
              <td className="col-tax-percent">{num(item.tax_percent)}%</td>
              <td className="col-discount">{formatCurrency(item.discount_amount || 0)}</td>
              <td className="col-total">
                {formatCurrency(num(item.row_total) - num(item.discount_amount) + num(item.tax_amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/* ------------------------------------------------------------ order totals */

export function OrderTotalsBlock({ order }) {
  const t = orderTotals(order)
  return (
    <div className="admin__page-section-item order-totals">
      <div className="admin__page-section-item-title">
        <span className="title">Order Totals</span>
      </div>
      <table className="order-totals-table">
        <tbody>
          <tr className="subtotal">
            <th>Subtotal</th>
            <td>{formatCurrency(t.subtotal)}</td>
          </tr>
          {t.discount ? (
            <tr className="discount">
              <th>Discount</th>
              <td>{formatCurrency(-Math.abs(t.discount))}</td>
            </tr>
          ) : null}
          <tr className="shipping">
            <th>Shipping &amp; Handling</th>
            <td>{formatCurrency(t.shipping)}</td>
          </tr>
          {t.tax ? (
            <tr className="tax">
              <th>Tax</th>
              <td>{formatCurrency(t.tax)}</td>
            </tr>
          ) : null}
          <tr className="grand_total">
            <th>Grand Total</th>
            <td>{formatCurrency(t.grand)}</td>
          </tr>
          <tr className="total-paid">
            <th>Total Paid</th>
            <td>{formatCurrency(t.paid)}</td>
          </tr>
          <tr className="total-refunded">
            <th>Total Refunded</th>
            <td>{formatCurrency(t.refunded)}</td>
          </tr>
          <tr className="total-due">
            <th>Total Due</th>
            <td>{formatCurrency(t.due)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/* --------------------------------------------------------------- note list */

/**
 * `#order_history_block .note-list` — tasks 491-495 read
 * `.note-list` firstElementChild `.note-list-comment` outerText, so the newest
 * entry must be first and `.note-list-comment` must hold the comment text and
 * nothing else.
 */
/**
 * `Magento_Sales::order/view/tab/history.phtml`, transcribed literally.
 *
 * `items` are the merged entries from `fullOrderHistory()` — status-history
 * rows AND the derived "Invoice #N created" / "Shipment #N created" /
 * "Credit memo #N created" lines (DIFF-S02).
 *
 * The `.note-list-customer` span is conditional on `isItemNotified($item, false)`
 * — `isset($item['notified']) && false !== $item['notified']` — so an entry
 * whose `notified` is null (the document's `email_sent` was NULL) renders no
 * span at all, which is exactly what the source does for invoice #000000002.
 * `notified === 2` is Magento's CUSTOMER_NOTIFICATION_NOT_APPLICABLE.
 *
 * The comment body does NOT live in the `<li>` on the source; it is repeated
 * below in `CommentsBlock`.
 */
export function NoteList({ items }) {
  return (
    <ul className="note-list">
      {(items || []).map((item, i) => (
        <li className="note-list-item" key={`${item.created_at}-${i}`}>
          {/* history.phtml puts each span on its own line, so the source's
              `innerText` reads "Apr 19, 2023 12:15:45 PM Invoice #… created".
              Without these separators the mock renders it run together. */}
          <span className="note-list-date">{formatDate(item.created_at)}</span>{' '}
          <span className="note-list-time">{formatNoteTime(item.created_at)}</span>{' '}
          <span className="note-list-status">{item.title}</span>{' '}
          {item.notified !== undefined && item.notified !== null && item.notified !== false ? (
            <span className="note-list-customer">
              Customer{' '}
              {item.notified === 2 ? (
                <span className="note-list-customer-notapplicable">Notification Not Applicable</span>
              ) : item.notified ? (
                <span className="note-list-customer-notified">Notified</span>
              ) : (
                <span className="note-list-customer-not-notified">Not Notified</span>
              )}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * `Magento_Sales::order/view/history.phtml` — a DIFFERENT list from the one
 * above: the Information tab and the invoice/shipment/credit-memo views show
 * only `getStatusHistoryCollection(true)` (newest first, no derived document
 * entries), always render `.note-list-customer`, and DO carry the comment body
 * inside the `<li>`.
 */
export function StatusHistoryNoteList({ comments }) {
  return (
    <ul className="note-list">
      {(comments || []).map((c, i) => (
        <li className="note-list-item" key={`${c.created_at}-${i}`}>
          <span className="note-list-date">{formatDate(c.created_at)}</span>{' '}
          <span className="note-list-time">{formatNoteTime(c.created_at)}</span>{' '}
          <span className="note-list-status">{orderStatusLabel(c.status)}</span>{' '}
          <span className="note-list-customer">
            Customer{' '}
            {c.is_customer_notified === 2 ? (
              <span className="note-list-customer-notapplicable">Notification Not Applicable</span>
            ) : c.is_customer_notified ? (
              <span className="note-list-customer-notified">Notified</span>
            ) : (
              <span className="note-list-customer-not-notified">Not Notified</span>
            )}
          </span>
          {c.comment ? <div className="note-list-comment">{c.comment}</div> : null}
        </li>
      ))}
    </ul>
  )
}

/** The `.edit-order-comments-block` half of history.phtml. */
export function CommentsBlock({ items }) {
  return (
    <div className="edit-order-comments-block">
      <div className="edit-order-comments-block-title">Notes for this Order</div>
      {(items || []).filter(item => item.comment).map((item, i) => (
        <div className="comments-block-item" key={`${item.created_at}-${i}`}>
          <div className="comments-block-item-comment">{item.comment}</div>
          <span className="comments-block-item-date-time">
            {`Comment added ${formatDate(item.created_at)} ${formatNoteTime(item.created_at)}`}
          </span>
        </div>
      ))}
    </div>
  )
}
