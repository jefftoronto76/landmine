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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()

    const result = parsePage(html, url)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message, url })
  }
}

function parsePage(html, url) {
  const result = { url }

  // Title - h1 tag
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
  result.title = titleMatch ? stripTags(titleMatch[1]).trim() : ''

  // og:image for thumbnail
  const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
  result.image_url = ogImageMatch ? ogImageMatch[1] : ''

  // Categories from /category/ links - group by taxonomy
  const categories = {}
  const catRegex = /href="https?:\/\/[^\/]+\/category\/([^\/]+)\/[^"]*"[^>]*>([^<]+)<\/a>/g
  let m
  while ((m = catRegex.exec(html)) !== null) {
    const taxonomy = m[1].trim()
    const value = m[2].trim()
    if (!categories[taxonomy]) categories[taxonomy] = []
    if (!categories[taxonomy].includes(value)) {
      categories[taxonomy].push(value)
    }
  }
  // Flatten taxonomy groups into separate fields
  result.region = (categories['region'] || []).join(' | ')
  result['resource-topic'] = (categories['resource-topic'] || []).join(' | ')
  result['resource-type'] = (categories['resource-type'] || []).join(' | ')

  // Strip HTML for text extraction
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  // About the Project fields
  const fields = [
    [/Author:\s*([^\n]+?)(?=\s+Source:|\s+Language:|\s+Review date:|$)/i, 'author'],
    [/Source:\s*([^\n]+?)(?=\s+Language:|\s+Review date:|\s+Funding source:|$)/i, 'source'],
    [/Language:\s*([^\n]+?)(?=\s+Review date:|\s+Funding source:|$)/i, 'language'],
    [/Review date:\s*([^\n]+?)(?=\s+Funding source:|Disclaimer|$)/i, 'review_date'],
    [/Funding source:\s*([^\n]+?)(?=\s+Disclaimer|$)/i, 'funding_source'],
  ]
  for (const [pattern, key] of fields) {
    const match = text.match(pattern)
    result[key] = match ? match[1].trim().replace(/\s+/g, ' ') : ''
  }

  // Outbound link — the main "View Resource" / "Download" button
  const outboundMatch = html.match(
    /href="(https?:\/\/(?!meant2prevent\.ca)[^"]+)"[^>]*>\s*(?:View Resource|Register Here|Download Program|Download|View resource|Learn More|Click Here|View Toolkit)[^<]*<\/a>/i
  )
  result.outbound_link = outboundMatch ? outboundMatch[1] : ''

  return result
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '')
}
