export const COLUMNS = [
  { key: 'url', label: 'URL' },
  { key: 'title', label: 'Title' },
  { key: 'image_url', label: 'Image URL' },
  { key: 'description', label: 'Description' },
  { key: 'region', label: 'Region' },
  { key: 'resource-topic', label: 'Resource Topic' },
  { key: 'resource-type', label: 'Resource Type' },
  { key: 'outbound_link', label: 'Outbound Link' },
  { key: 'language', label: 'Language' },
  { key: 'review_date', label: 'Review Date' },
  { key: 'author', label: 'Author' },
  { key: 'source', label: 'Source' },
  { key: 'funding_source', label: 'Funding Source' },
]

export function exportToCSV(rows, filename = 'landmine-export.csv') {
  const headers = COLUMNS.map(c => `"${c.label}"`).join(',')
  const lines = rows.map(row =>
    COLUMNS.map(c => {
      const val = (row[c.key] || '').toString().replace(/"/g, '""')
      return `"${val}"`
    }).join(',')
  )
  const csv = [headers, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
