import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import { exportToCSV, COLUMNS } from '../lib/export'

const VISIBLE_COLUMNS = [
  { key: 'title', label: 'Title', width: '220px' },
  { key: 'region', label: 'Region', width: '140px' },
  { key: 'resource-topic', label: 'Topic', width: '200px' },
  { key: 'resource-type', label: 'Type', width: '140px' },
  { key: 'language', label: 'Lang', width: '80px' },
  { key: 'review_date', label: 'Review Date', width: '110px' },
  { key: 'outbound_link', label: 'Outbound', width: '160px' },
]

export default function Home() {
  const [sitemapUrl, setSitemapUrl] = useState('https://meant2prevent.ca/sitemap-1.xml')
  const [status, setStatus] = useState('idle') // idle | parsing | scraping | done | error
  const [urls, setUrls] = useState([])
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const abortRef = useRef(false)

  const start = useCallback(async () => {
    if (!sitemapUrl.trim()) return
    abortRef.current = false
    setStatus('parsing')
    setError('')
    setRows([])
    setUrls([])
    setProgress({ done: 0, total: 0, current: '' })

    // Step 1: Parse sitemap
    try {
      const res = await fetch('/api/parse-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sitemapUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse sitemap')

      const allUrls = data.urls
      setUrls(allUrls)
      setProgress({ done: 0, total: allUrls.length, current: '' })
      setStatus('scraping')

      // Step 2: Scrape each page sequentially
      const results = []
      for (let i = 0; i < allUrls.length; i++) {
        if (abortRef.current) break
        const url = allUrls[i]
        setProgress({ done: i, total: allUrls.length, current: url })

        try {
          const r = await fetch('/api/scrape-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          })
          const row = await r.json()
          results.push(row)
          setRows([...results])
        } catch {
          results.push({ url, title: '[error]', error: true })
          setRows([...results])
        }

        // Small delay to be polite
        await new Promise(r => setTimeout(r, 300))
      }

      setProgress(p => ({ ...p, done: results.length, current: '' }))
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [sitemapUrl])

  const stop = () => { abortRef.current = true; setStatus('done') }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const filteredRows = rows.filter(row => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return Object.values(row).some(v => String(v).toLowerCase().includes(q))
  })

  const currentSlug = progress.current
    ? progress.current.replace(/https?:\/\/[^\/]+\//, '').replace(/\/$/, '')
    : ''

  return (
    <>
      <Head>
        <title>Landmine — Sitemap Scraper</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <span className="logo">◈ LANDMINE</span>
            <span className="tagline">sitemap intelligence</span>
          </div>
          {rows.length > 0 && (
            <div className="header-right">
              <button
                className="btn btn-export"
                onClick={() => exportToCSV(rows)}
              >
                ↓ Export CSV ({rows.length})
              </button>
            </div>
          )}
        </header>

        {/* Input bar */}
        <div className="input-bar">
          <div className="input-wrap">
            <label className="input-label">SITEMAP URL</label>
            <div className="input-row">
              <input
                className="url-input"
                type="text"
                value={sitemapUrl}
                onChange={e => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                disabled={status === 'parsing' || status === 'scraping'}
                onKeyDown={e => e.key === 'Enter' && start()}
              />
              {(status === 'idle' || status === 'done' || status === 'error') && (
                <button className="btn btn-start" onClick={start}>
                  ▶ RUN
                </button>
              )}
              {(status === 'parsing' || status === 'scraping') && (
                <button className="btn btn-stop" onClick={stop}>
                  ■ STOP
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {(status === 'parsing' || status === 'scraping' || status === 'done') && (
            <div className="progress-wrap">
              <div className="progress-meta">
                {status === 'parsing' && <span className="blink">Parsing sitemap...</span>}
                {status === 'scraping' && (
                  <>
                    <span className="progress-count">{progress.done} / {progress.total}</span>
                    <span className="progress-pct">{pct}%</span>
                    {currentSlug && <span className="progress-slug">↳ {currentSlug}</span>}
                  </>
                )}
                {status === 'done' && (
                  <span className="done-msg">✓ Complete — {rows.length} pages indexed</span>
                )}
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          {error && <div className="error-msg">✗ {error}</div>}
        </div>

        {/* Filter + table */}
        {rows.length > 0 && (
          <div className="table-section">
            <div className="table-toolbar">
              <input
                className="filter-input"
                type="text"
                placeholder="Filter results..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <span className="row-count">{filteredRows.length} rows</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>#</th>
                    {VISIBLE_COLUMNS.map(col => (
                      <th key={col.key} style={{ width: col.width }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={row.url} className={row.error ? 'row-error' : ''}>
                      <td className="cell-num">{i + 1}</td>
                      {VISIBLE_COLUMNS.map(col => (
                        <td key={col.key} className={`cell-${col.key}`}>
                          {col.key === 'title' ? (
                            <a href={row.url} target="_blank" rel="noopener noreferrer" className="title-link">
                              {row.title || <span className="empty">—</span>}
                            </a>
                          ) : col.key === 'outbound_link' ? (
                            row.outbound_link
                              ? <a href={row.outbound_link} target="_blank" rel="noopener noreferrer" className="outbound-link">↗ view</a>
                              : <span className="empty">—</span>
                          ) : (
                            row[col.key] || <span className="empty">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {status === 'idle' && (
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <p>Enter a sitemap URL and press RUN to begin indexing.</p>
            <p className="empty-sub">Results populate in real time as each page is scraped.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .header-left { display: flex; align-items: baseline; gap: 12px; }
        .logo {
          font-family: var(--mono);
          font-size: 15px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: 0.1em;
        }
        .tagline {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        /* Buttons */
        .btn {
          font-family: var(--mono);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: none;
          cursor: pointer;
          padding: 9px 18px;
          transition: all 0.15s;
        }
        .btn-start {
          background: var(--accent);
          color: #000;
          flex-shrink: 0;
        }
        .btn-start:hover { background: #fff; }
        .btn-stop {
          background: transparent;
          color: var(--danger);
          border: 1px solid var(--danger);
          flex-shrink: 0;
        }
        .btn-stop:hover { background: var(--danger); color: #000; }
        .btn-export {
          background: transparent;
          color: var(--accent);
          border: 1px solid var(--accent);
          padding: 7px 14px;
        }
        .btn-export:hover { background: var(--accent); color: #000; }

        /* Input bar */
        .input-bar {
          padding: 20px 24px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .input-wrap { display: flex; flex-direction: column; gap: 6px; }
        .input-label {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--text-muted);
        }
        .input-row { display: flex; gap: 8px; }
        .url-input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border-bright);
          color: var(--text);
          font-family: var(--mono);
          font-size: 13px;
          padding: 9px 12px;
          outline: none;
          transition: border-color 0.15s;
        }
        .url-input:focus { border-color: var(--accent); }
        .url-input:disabled { opacity: 0.5; }
        .url-input::placeholder { color: var(--text-muted); }

        /* Progress */
        .progress-wrap { display: flex; flex-direction: column; gap: 6px; }
        .progress-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          font-family: var(--mono);
          font-size: 11px;
        }
        .progress-count { color: var(--accent); font-weight: 700; }
        .progress-pct { color: var(--text-muted); }
        .progress-slug {
          color: var(--text-dim);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 400px;
        }
        .done-msg { color: var(--success); font-weight: 700; }
        .progress-bar-track {
          height: 2px;
          background: var(--border);
          width: 100%;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s ease;
        }

        .error-msg {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--danger);
          padding: 8px 12px;
          border: 1px solid var(--danger);
          background: rgba(255, 68, 68, 0.05);
        }

        /* Table section */
        .table-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .table-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
        }
        .filter-input {
          background: var(--bg);
          border: 1px solid var(--border-bright);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 6px 10px;
          outline: none;
          width: 280px;
        }
        .filter-input:focus { border-color: var(--accent); }
        .filter-input::placeholder { color: var(--text-muted); }
        .row-count {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .table-wrap {
          flex: 1;
          overflow: auto;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .data-table thead {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--surface2);
        }
        .data-table th {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-bright);
          white-space: nowrap;
          user-select: none;
        }
        .data-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
          max-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .data-table tr:hover td { background: var(--surface2); }
        .row-error td { opacity: 0.4; }

        .cell-num {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text-muted);
          text-align: right;
        }
        .title-link {
          color: var(--text);
          font-weight: 500;
        }
        .title-link:hover { color: var(--accent); }
        .outbound-link {
          color: var(--accent);
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.05em;
        }
        .outbound-link:hover { text-decoration: underline; }
        .empty { color: var(--text-muted); }

        /* Empty state */
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--text-muted);
          padding: 60px 24px;
        }
        .empty-icon {
          font-size: 48px;
          color: var(--border-bright);
          line-height: 1;
        }
        .empty-state p {
          font-family: var(--mono);
          font-size: 13px;
          text-align: center;
        }
        .empty-sub { font-size: 11px; color: var(--border-bright); }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .blink {
          animation: blink 1.2s ease-in-out infinite;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--accent);
        }
      `}</style>
    </>
  )
}
