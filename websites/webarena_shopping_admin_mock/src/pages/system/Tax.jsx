import React, { useMemo } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { COUNTRY_OPTIONS } from '../../components/catalog/countries.js'

/**
 * Stores > Taxes — ROUTES rows 117-119, backed by `taxConfig.json`
 * (`tax_calculation_rate` 3 rows, `tax_calculation_rule` 1 row,
 * `tax_calculation` linking them, `tax_class`).
 *
 * `tax_region_id` is a `directory_country_region` key, and that table was not
 * extracted; the three ids this DB actually uses are resolved from the codes the
 * source renders in assets/html/tax-rate.html (12 = CA, 33 = MI, 43 = NY).
 */
const REGION_CODES = { 12: 'CA', 33: 'MI', 43: 'NY' }
const COUNTRY_NAMES = { US: 'United States' }

export function TaxRates() {
  const { state, setState, addMessage } = useApp()
  const rates = state?.taxConfig?.rates || []

  const rows = useMemo(() => rates.map(r => ({
    ...r,
    country: COUNTRY_NAMES[r.tax_country_id] || r.tax_country_id,
    region: REGION_CODES[r.tax_region_id] || '*',
    rate_display: Number(r.rate).toFixed(4),
  })), [rates])

  const columns = [
    {
      id: 'code', label: 'Tax Identifier', filterType: 'text', searchValue: r => r.code,
      render: r => <AdminLink to={`/admin/tax/rate/edit/rate/${r.tax_calculation_rate_id}/`}>{r.code}</AdminLink>,
      exportValue: r => r.code,
    },
    {
      /* Round 10 — the source's control is `[name="tax_country_id"]` and its
         option values are ISO country codes over the full country list.
         F-01a (round 11) — round 10 then DERIVED that list from the three
         seeded rates, leaving 2 options, so `select_option('FR')` raised. The
         option set of a filter is the source's, never the seed's: this is
         Magento's own 249-entry directory list, byte-compared against the live
         `#tax_rate_grid_filter_tax_country_id` this round (values, labels and
         order all identical). `COUNTRY_OPTIONS[0]` is the blank sentinel, which
         the legacy grid emits itself, so it is dropped here. */
      /* DIFF-R102 — the source renders this header `no-link` with no
         `data-sort`; it is filterable but NOT sortable. */
      id: 'country', label: 'Country', filterType: 'select', filterName: 'tax_country_id',
      sortable: false,
      options: COUNTRY_OPTIONS.slice(1), emptyOptionLabel: 'All Countries',
      filterValue: r => (r.country === 'United States' ? 'US' : r.country),
    },
    { id: 'region', label: 'State/Region', filterType: 'text', filterName: 'region_name' },
    { id: 'tax_postcode', label: 'Zip/Post Code', filterType: 'text' },
    { id: 'rate_display', label: 'Rate', filterType: 'range', filterName: 'rate', sortValue: r => Number(r.rate) },
  ]

  const actions = (
    <>
      <AdminLink to="/admin/tax/rate/importExport/" className="action-default scalable">
        <span>Export</span>
      </AdminLink>
      <AdminLink to="/admin/tax/rate/add/" className="action-default scalable primary" id="add"
        data-ui-id="adminhtml-tax-rate-container-add-button">
        <span>Add New Tax Rate</span>
      </AdminLink>
    </>
  )

  return (
    <PageShell title="Tax Zones and Rates" actions={actions}>
      {/* Round 10. LEGACY on the source, and the source ships NO massaction bar
        * here (5 columns, no checkbox column) but DOES ship `Export to:` +
        * `select#tax_rate_grid_export`.
        * DIFF-R102 (round 11) — the source's cold-load sort is State/Region
        * ascending: `th[data-sort="region_name"]` carries `_ascend` while Tax
        * Identifier carries `not-sort`. */}
      <LegacyAdminGrid legacyToolbarBase={1} legacyExportIndex={0} gridId="tax_rate_grid"
        basePath="/admin/tax/rate/index" rows={rows} columns={columns}
        rowKey={r => r.tax_calculation_rate_id}
        exportable exportFileName="tax_rates"
        exportPaths={{ csv: '/admin/tax/rate/exportCsv/', xml: '/admin/tax/rate/exportXml/' }}
        defaultSort={{ field: 'region_name', direction: 'asc' }} />
    </PageShell>
  )
}

export function TaxRules() {
  const { state, setState, addMessage } = useApp()
  const cfg = state?.taxConfig || {}

  const rows = useMemo(() => (cfg.rules || []).map(rule => {
    const calcs = (cfg.calculations || [])
      .filter(c => String(c.tax_calculation_rule_id) === String(rule.tax_calculation_rule_id))
    const className = id => (cfg.classes || []).find(c => String(c.class_id) === String(id))?.class_name || ''
    const rateCode = id => (cfg.rates || []).find(r => String(r.tax_calculation_rate_id) === String(id))?.code || ''
    return {
      ...rule,
      customer_tax_class: [...new Set(calcs.map(c => className(c.customer_tax_class_id)))].join(', '),
      product_tax_class: [...new Set(calcs.map(c => className(c.product_tax_class_id)))].join(', '),
      tax_rate: [...new Set(calcs.map(c => rateCode(c.tax_calculation_rate_id)))].join(', '),
    }
  }), [cfg])

  const columns = [
    {
      id: 'code', label: 'Name', filterType: 'text', searchValue: r => r.code,
      render: r => <AdminLink to={`/admin/tax/rule/edit/rule/${r.tax_calculation_rule_id}/`}>{r.code}</AdminLink>,
      exportValue: r => r.code,
    },
    /* Round 10 — on the source the first two are `<select>`s keyed by tax-class
       id, and the Tax Rate filter's name is `tax_rates_codes`. */
    {
      id: 'customer_tax_class', label: 'Customer Tax Class', filterType: 'select',
      filterName: 'customer_tax_classes', sortable: false,
      options: [{ value: '3', label: 'Retail Customer' }],
      filterValue: r => (r.customer_tax_class === 'Retail Customer' ? '3' : ''),
    },
    {
      id: 'product_tax_class', label: 'Product Tax Class', filterType: 'select',
      filterName: 'product_tax_classes', sortable: false,
      options: [{ value: '0', label: 'None' }, { value: '2', label: 'Taxable Goods' }],
      filterValue: r => ({ None: '0', 'Taxable Goods': '2' }[r.product_tax_class] ?? ''),
    },
    /* DIFF-R102 — these three are `no-link` on the source: filterable but not
       sortable, because each is an aggregate over `tax_calculation` rather than
       a column of `tax_calculation_rule`. */
    { id: 'tax_rate', label: 'Tax Rate', filterType: 'text', filterName: 'tax_rates_codes', sortable: false },
    { id: 'priority', label: 'Priority', filterType: 'text', sortValue: r => Number(r.priority) },
    { id: 'calculate_subtotal', label: 'Subtotal Only', filterType: 'text' },
    { id: 'position', label: 'Sort Order', filterType: 'text', sortValue: r => Number(r.position) },
  ]

  const actions = (
    <AdminLink to="/admin/tax/rule/new/" className="action-default scalable primary" id="add"
      data-ui-id="adminhtml-block-tax-rule-container-add-button">
      <span>Add New Tax Rule</span>
    </AdminLink>
  )

  return (
    <PageShell title="Tax Rules" actions={actions}>
      {/* Round 10. LEGACY on the source; no massaction bar and no Export there. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="taxRuleGrid"
        basePath="/admin/tax/rule/index" rows={rows} columns={columns}
        rowKey={r => r.tax_calculation_rule_id}
        exportable={false} exportFileName="tax_rules" />
    </PageShell>
  )
}

const REGION_IDS = Object.fromEntries(Object.entries(REGION_CODES).map(([id, code]) => [code, Number(id)]))

/** Split one CSV line, honouring the `""`-escaped quoting the export writes. */
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(v => v.trim())
}

/**
 * Import and Export Tax Rates (119). Export builds the source's CSV
 * ("Code","Country","State","Zip/Post Code","Rate","Zip/Post is Range",…) from
 * the seeded rates.
 *
 * PIPELINE-021: import used to print the source's `The tax rate has been
 * imported.` and add no rate — a success message with an empty state footprint.
 * It now really parses the picked file (FileReader, no network) in the same
 * column order Export writes, and upserts `taxConfig.rates` on `Code`, which is
 * what Magento's importer keys on. A file it cannot parse reports the source's
 * own error instead of claiming a success.
 */
export function TaxImportExport() {
  const { state, setState, addMessage } = useApp()
  const rates = state?.taxConfig?.rates || []

  function importRates() {
    const el = document.getElementById('import_rates_file')
    const file = el && el.files && el.files[0]
    if (!file) {
      addMessage('Invalid file upload attempt.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => addMessage('Invalid file upload attempt.', 'error')
    reader.onload = () => {
      const lines = String(reader.result || '').split(/\r?\n/).filter(l => l.trim() !== '')
      const head = lines.length ? splitCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '')) : []
      if (head[0] !== 'Code') {
        addMessage('Invalid file upload attempt. Invalid file format.', 'error')
        return
      }
      const parsed = []
      for (const line of lines.slice(1)) {
        const [code, country, stateCode, postcode, rate, zipIsRange, zipFrom, zipTo] = splitCsvLine(line)
        if (!code || rate === undefined || rate === '' || Number.isNaN(Number(rate))) continue
        parsed.push({
          code,
          tax_country_id: (country || 'US').slice(0, 2).toUpperCase(),
          tax_region_id: REGION_IDS[stateCode] ?? 0,
          tax_postcode: postcode || '*',
          rate: Number(rate),
          zip_is_range: zipIsRange ? Number(zipIsRange) : null,
          zip_from: zipFrom ? Number(zipFrom) : null,
          zip_to: zipTo ? Number(zipTo) : null,
        })
      }
      if (!parsed.length) {
        addMessage('Invalid file upload attempt. No valid rates were found in the file.', 'error')
        return
      }
      setState(prev => {
        const existing = prev.taxConfig?.rates || []
        let nextId = existing.reduce((m, r) => Math.max(m, Number(r.tax_calculation_rate_id) || 0), 0)
        const byCode = new Map(existing.map(r => [r.code, r]))
        for (const p of parsed) {
          const prevRow = byCode.get(p.code)
          byCode.set(p.code, prevRow
            ? { ...prevRow, ...p }
            : { tax_calculation_rate_id: ++nextId, ...p })
        }
        return { ...prev, taxConfig: { ...prev.taxConfig, rates: [...byCode.values()] } }
      })
      addMessage('The tax rate has been imported.')
    }
    reader.readAsText(file)
  }

  function exportRates() {
    const head = ['Code', 'Country', 'State', 'Zip/Post Code', 'Rate', 'Zip/Post is Range', 'Range From', 'Range To']
    const lines = [head.join(',')]
    for (const r of rates) {
      lines.push([
        r.code, r.tax_country_id, REGION_CODES[r.tax_region_id] || '*', r.tax_postcode,
        Number(r.rate).toFixed(4), r.zip_is_range ?? '', r.zip_from ?? '', r.zip_to ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tax_rates.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <PageShell title="Import and Export Tax Rates">
      <fieldset className="admin__fieldset">
        <legend className="admin__legend"><span>Import Tax Rates</span></legend>
        <div className="admin__field">
          <label className="admin__field-label" htmlFor="import_rates_file"><span>Import Tax Rates</span></label>
          <div className="admin__field-control">
            <input id="import_rates_file" name="import_rates_file" type="file" accept=".csv"
              className="admin__control-file" />
          </div>
        </div>
        <div className="admin__field">
          <div className="admin__field-control">
            <button type="button" className="action-default scalable" data-ui-id="widget-button-0" onClick={importRates}>
              <span>Import Tax Rates</span>
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset className="admin__fieldset">
        <legend className="admin__legend"><span>Export Tax Rates</span></legend>
        <div className="admin__field">
          <div className="admin__field-control">
            <button type="button" className="action-default scalable" data-ui-id="widget-button-1" onClick={exportRates}>
              <span>Export Tax Rates</span>
            </button>
          </div>
        </div>
      </fieldset>
    </PageShell>
  )
}
