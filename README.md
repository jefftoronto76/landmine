# Landmine

Sitemap scraper — paste a sitemap URL, watch it index every page in real time, export to CSV.

## What it does

1. Fetches any XML sitemap
2. Scrapes each page for: title, image, region, resource topic, resource type, language, review date, author, source, funding source, outbound link
3. Shows results in a live-updating filterable table
4. One-click CSV export

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Select this repo, leave all defaults, click Deploy
4. Add your custom domain under Settings → Domains

## Custom domain (e.g. scraper.yourdomain.com)

In Vercel → Project → Settings → Domains, add your subdomain.
Vercel will give you a CNAME value to add in your DNS registrar.

## Notes

- Scrapes one page at a time with a 300ms delay to be polite to target servers
- Vercel Pro recommended for larger sitemaps (60s function timeout vs 10s on free)
- The scraper works on any site, not just meant2prevent.ca
- Category extraction works best on WordPress sites using `/category/taxonomy/value/` URL patterns
