# FountLayer Website

The open-source project website lives in `apps/site` and builds as a static
Vite site for GitHub Pages.

## Local Development

```bash
pnpm --filter @fountlayer/site dev
```

Local URL:

```txt
http://127.0.0.1:4174
```

## Build

```bash
pnpm --filter @fountlayer/site build
```

The static artifact is written to:

```txt
apps/site/dist
```

## Smoke Check

After building, run:

```bash
pnpm smoke:site
```

The smoke check verifies the built HTML, project Pages asset base path, social
preview image, `robots.txt`, and `sitemap.xml`.

## SEO Assets

The site ships these static publishing assets from `apps/site/public`:

- `robots.txt`
- `sitemap.xml`
- `og-image.png`

The canonical URL and social preview metadata currently target the default
project Pages URL.

## GitHub Pages

The Pages workflow builds `apps/site`, runs `pnpm smoke:site`, and uploads
`apps/site/dist`.

Default project Pages URL:

```txt
https://HiClawBot.github.io/FountLayer/
```

The workflow sets:

```txt
SITE_BASE_PATH=/FountLayer/
```

This keeps asset paths correct for GitHub project Pages.

## Custom Domain

Recommended subdomain:

```txt
fountlayer.aifund.com
```

When DNS is ready:

1. Point `fountlayer.aifund.com` to the GitHub Pages target with a CNAME record.
2. Configure the repository Pages custom domain in GitHub settings.
3. Set `SITE_BASE_PATH=/` in `.github/workflows/pages.yml`.
4. Update `apps/site/index.html`, `apps/site/public/robots.txt`, and
   `apps/site/public/sitemap.xml` to use `https://fountlayer.aifund.com/`.
5. Add `apps/site/public/CNAME` with `fountlayer.aifund.com`, or configure the
   domain in GitHub Pages settings.

Do not add the custom domain until DNS ownership and GitHub Pages settings are
ready, otherwise the project URL is safer for immediate publishing.
