/* Order state codes and their titles, transcribed from the "State Code and
 * Title" column of assets/html/sales-order-status.html (`new[Pending]`,
 * `holded[On Hold]`, …). The Order Status grid renders `code[Title]` from this
 * map and the Assign form offers the same set as its Order State options. */

export const STATE_TITLES = {
  new: 'Pending',
  pending_payment: 'Pending Payment',
  processing: 'Processing',
  complete: 'Complete',
  closed: 'Closed',
  canceled: 'Canceled',
  holded: 'On Hold',
  payment_review: 'Payment Review',
}

/**
 * F-05 — the Assign form's `[name="state"]` is ordered by the state's visible
 * LABEL on the source (Canceled, Closed, Complete, On Hold, Payment Review,
 * Pending, Pending Payment, Processing — so `new` sorts between
 * `payment_review` and `pending_payment`), not by lifecycle. "Pick the first
 * state" resolved to a different option in the mock. Verified against the live
 * `/admin/sales/order_status/assign/`.
 */
export const STATE_OPTIONS = Object.entries(STATE_TITLES)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label))
