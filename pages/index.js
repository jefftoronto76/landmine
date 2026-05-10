import { useState, useRef, useCallback } from 'react'
import Head from 'next/head'
import { exportToCSV } from '../lib/export'

const VISIBLE_COLUMNS = [
  { key: 'title', label: 'Title', width: '220px' },
  { key: 'description', label: 'Description', width: '260px' },
  { key: 'image_url', label: 'Image', width: '80px' },
  { key: 'region', label: 'Region', width: '140px' },
  { key: 'resource-topic', label: 'Topic', width: '200px' },
  { key: 'resource-type', label: 'Type', width: '140px' },
  { key: 'language', label: 'Language', width: '90px' },
  { key: 'review_date', label: 'Review Date', width: '110px' },
  { key: 'outbound_link', label: 'Resource Link', width: '120px' },
]

export default function Home() {
  const [sitemapUrl, setSitemapUrl] = useState('https://meant2prevent.ca/sitemap-1.xml')
  const [status, setStatus] = useState('idle')
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
    setProgress({ done: 0, total: 0, current: '' })

    try {
      const res = await fetch('/api/parse-sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sitemapUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse sitemap')

      const allUrls = data.urls
      setProgress({ done: 0, total: allUrls.length, current: '' })
      setStatus('scraping')

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

  const isRunning = status === 'parsing' || status === 'scraping'

  return (
    <>
      <Head>
        <title>Meant2Prevent — Resource Index</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header-inner">
            <div className="header-left">
              <div className="logo-mark">M2P</div>
              <div className="header-titles">
                <span className="app-name">Resource Index</span>
                <span className="app-sub">Sitemap scraper for meant2prevent.ca</span>
              </div>
            </div>
            {rows.length > 0 && (
              <button className="btn btn-export" onClick={() => exportToCSV(rows)}>
                ↓ Export CSV ({rows.length} pages)
              </button>
            )}
          </div>
        </header>

        <div className="main-content">
          <div className="input-card">
            <label className="input-label">Sitemap URL</label>
            <div className="input-row">
              <input
                className="url-input"
                type="text"
                value={sitemapUrl}
                onChange={e => setSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                disabled={isRunning}
                onKeyDown={e => e.key === 'Enter' && !isRunning && start()}
              />
              {!isRunning ? (
                <button className="btn btn-start" onClick={start}>
                  Index Pages
                </button>
              ) : (
                <button className="btn btn-stop" onClick={stop}>
                  Stop
                </button>
              )}
            </div>

            {(isRunning || status === 'done') && (
              <div className="progress-section">
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="progress-info">
                  {status === 'parsing' && <span className="status-text parsing">Parsing sitemap…</span>}
                  {status === 'scraping' && (
                    <>
                      <span className="status-text scraping">{progress.done} of {progress.total} pages indexed</span>
                      <span className="pct-badge">{pct}%</span>
                    </>
                  )}
                  {status === 'done' && (
                    <span className="status-text done">✓ Done — {rows.length} pages indexed</span>
                  )}
                </div>
                {status === 'scraping' && progress.current && (
                  <div className="current-url">
                    {progress.current.replace(/https?:\/\/[^\/]+\//, '').replace(/\/$/, '')}
                  </div>
                )}
              </div>
            )}

            {error && <div className="error-msg">⚠ {error}</div>}
          </div>

          {rows.length > 0 && (
            <div className="results-card">
              <div className="results-toolbar">
                <input
                  className="filter-input"
                  type="text"
                  placeholder="🔍  Filter results…"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
                <span className="result-count">{filteredRows.length} results</span>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="th-num">#</th>
                      {VISIBLE_COLUMNS.map(col => (
                        <th key={col.key} style={{ minWidth: col.width }}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => (
                      <tr key={row.url} className={row.error ? 'row-error' : ''}>
                        <td className="cell-num">{i + 1}</td>
                        {VISIBLE_COLUMNS.map(col => (
                          <td key={col.key}>
                            {col.key === 'title' ? (
                              <a href={row.url} target="_blank" rel="noopener noreferrer" className="title-link">
                                {row.title || <span className="empty">—</span>}
                              </a>
                            ) : col.key === 'outbound_link' ? (
                              row.outbound_link
                                ? <a href={row.outbound_link} target="_blank" rel="noopener noreferrer" className="view-link">View ↗</a>
                                : <span className="empty">—</span>
                            ) : col.key === 'resource-topic' ? (
                              row['resource-topic']
                                ? <div className="tag-list">{row['resource-topic'].split(' | ').map(t => <span key={t} className="tag">{t}</span>)}</div>
                                : <span className="empty">—</span>
                            ) : col.key === 'resource-type' ? (
                              row['resource-type']
                                ? <span className="type-badge">{row['resource-type'].split(' | ')[0]}</span>
                                : <span className="empty">—</span>
                           ) : col.key === 'image_url' ? (
                  row.image_url
                    ? <a href={row.image_url} target="_blank" rel="noopener noreferrer"><img src={row.image_url} style={{width:'40px',height:'40px',objectFit:'cover',borderRadius:'4px'}} /></a>
                    : <span className="empty">—</span>
                ) : (
                  <span title={row[col.key]}>{row[col.key] || <span className="empty">—</span>}</span>
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

          {status === 'idle' && (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>Ready to index</h3>
              <p>Enter a sitemap URL above and click <strong>Index Pages</strong> to begin.<br />Results will appear here in real time as each page is processed.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .header {
          background: var(--teal);
          box-shadow: 0 2px 8px rgba(42,172,226,0.3);
        }
        .header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo-mark {
          background: white;
          color: var(--teal);
          font-family: var(--heading);
          font-weight: 800;
          font-size: 13px;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 0.05em;
        }
        .header-titles { display: flex; flex-direction: column; }
        .app-name {
          font-family: var(--heading);
          font-weight: 700;
          font-size: 16px;
          color: white;
          line-height: 1.2;
        }
        .app-sub { font-size: 11px; color: rgba(255,255,255,0.75); }
        .btn {
          font-family: var(--heading);
          font-weight: 700;
          font-size: 13px;
          border: none;
          cursor: pointer;
          border-radius: 8px;
          padding: 10px 20px;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .btn-start { background: var(--teal); color: white; flex-shrink: 0; }
        .btn-start:hover { background: var(--teal-dark); }
        .btn-stop { background: white; color: var(--danger); border: 1.5px solid var(--danger); flex-shrink: 0; }
        .btn-stop:hover { background: var(--danger); color: white; }
        .btn-export { background: white; color: var(--teal); font-size: 13px; padding: 8px 16px; }
        .btn-export:hover { background: var(--teal-light); }
        .main-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
          width: 100%;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .input-card {
          background: var(--surface);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .input-label {
          font-family: var(--heading);
          font-weight: 700;
          font-size: 13px;
          color: var(--text);
        }
        .input-row { display: flex; gap: 10px; }
        .url-input {
          flex: 1;
          background: var(--bg);
          border: 1.5px solid var(--border);
          color: var(--text);
          font-family: var(--sans);
          font-size: 14px;
          padding: 10px 14px;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.15s;
        }
        .url-input:focus { border-color: var(--teal); }
        .url-input:disabled { opacity: 0.6; }
        .url-input::placeholder { color: var(--text-dim); }
        .progress-section { display: flex; flex-direction: column; gap: 8px; }
        .progress-bar-track { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: var(--teal); border-radius: 3px; transition: width 0.3s ease; }
        .progress-info { display: flex; align-items: center; gap: 10px; }
        .status-text { font-size: 13px; font-family: var(--heading); font-weight: 600; }
        .status-text.parsing { color: var(--text-muted); }
        .status-text.scraping { color: var(--teal-dark); }
        .status-text.done { color: var(--success); }
        .pct-badge {
          background: var(--teal-light);
          color: var(--teal-dark);
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          font-family: var(--heading);
        }
        .current-url { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .error-msg { font-size: 13px; color: var(--danger); background: #fef2f2; border: 1px solid #fecaca; padding: 10px 14px; border-radius: 8px; }
        .results-card {
          background: var(--surface);
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          border: 1px solid var(--border);
          overflow: hidden;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .results-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
        }
        .filter-input {
          background: white;
          border: 1.5px solid var(--border);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 7px 12px;
          border-radius: 8px;
          outline: none;
          width: 280px;
        }
        .filter-input:focus { border-color: var(--teal); }
        .filter-input::placeholder { color: var(--text-dim); }
        .result-count { font-size: 12px; color: var(--text-muted); margin-left: auto; font-family: var(--heading); font-weight: 600; }
        .table-wrap { overflow: auto; flex: 1; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .data-table thead { position: sticky; top: 0; z-index: 10; background: var(--surface2); }
        .data-table th {
          font-family: var(--heading);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
          text-align: left;
          padding: 10px 14px;
          border-bottom: 2px solid var(--border);
          white-space: nowrap;
        }
        .th-num { width: 40px; }
        .data-table td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          max-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .data-table tr:hover td { background: var(--teal-light); }
        .row-error td { opacity: 0.4; }
        .cell-num { font-size: 11px; color: var(--text-dim); text-align: right; font-family: var(--heading); }
        .title-link { color: var(--text); font-weight: 600; }
        .title-link:hover { color: var(--teal); }
        .view-link { color: var(--teal); font-weight: 600; font-size: 12px; }
        .view-link:hover { text-decoration: underline; }
        .empty { color: var(--text-dim); }
        .tag-list { display: flex; flex-wrap: wrap; gap: 4px; white-space: normal; }
        .tag { background: var(--teal-light); color: var(--teal-dark); font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 20px; white-space: nowrap; }
        .type-badge { background: var(--coral-light); color: var(--coral); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
        .empty-state {
          background: var(--surface);
          border-radius: 12px;
          border: 1px solid var(--border);
          padding: 60px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .empty-icon { font-size: 40px; }
        .empty-state h3 { font-family: var(--heading); font-weight: 700; font-size: 18px; color: var(--text); }
        .empty-state p { font-size: 14px; color: var(--text-muted); line-height: 1.7; }
      `}</style>
    </>
  )
}
