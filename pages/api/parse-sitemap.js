export const config = {
  api: { responseLimit: false },
  maxDuration: 300,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; landmine-scraper/1.0)' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const xml = await response.text()

    // Extract all <loc> tags
    const matches = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)]
    const urls = matches.map(m => m[1].trim())

    // Filter out obvious non-content pages
    const SKIP = ['contact', 'project-sponsorship', 'about-meant2prevent', 
                  'meant2prevent-kitchen', 'project-spotlights', 'mdtf-results-page',
                  'covid-19-resources-for-families']
    
    const filtered = urls.filter(u => {
      const slug = u.replace(/https?:\/\/[^\/]+\//, '').replace(/\/$/, '')
      if (!slug) return false // homepage
      if (SKIP.some(s => slug.includes(s))) return false
      return true
    })

    res.json({ urls: filtered, total: filtered.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
