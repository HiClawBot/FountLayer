# FountLayer Website

The open-source project website lives in `apps/site` and builds as a static
Vite site for GitHub Pages.

## Local Development

```bash
pnpm --filter @fountlayer/site dev
```

Local URL:

```txt
http://127.0.0.1:3303
```

The website dev and preview scripts use strict ports. Keep website development
inside the project port range: dev on `3303`, preview on `3304`.

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
- `og-image.svg`

The canonical URL and social preview metadata currently target the default
project Pages URL.

## Brand Asset Handling

The website applies the brand identity with transparent SVG files:

```txt
apps/site/src/assets/fountlayer-mark.svg
apps/site/src/assets/fountlayer-lockup.svg
apps/site/public/og-image.svg
```

Do not place the visual identity inside raster boards with mismatched
background colors. Use transparent SVG assets for page decoration and preserve
their aspect ratio, palette, and geometry.

## Languages

The site has pure English and Chinese content modes. Keep each language's page
copy internally consistent: do not mix Chinese text into the English mode or
English marketing copy into the Chinese mode. Brand names, domains, file paths,
and source-code identifiers may remain literal when they are the object being
shown.

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

## First-Time Repository Settings

Before the first successful deployment, enable GitHub Pages for the repository:

1. Open repository settings, then Pages.
2. Set the Pages source to GitHub Actions.
3. Open the `github-pages` environment deployment settings.
4. Allow the branch that runs the Pages workflow.

Current allowed deployment branches:

```txt
main
codex/v0.5.0-beta
```

If the workflow fails with `Ensure GitHub Pages has been enabled`, the Pages
source is not enabled yet. If it fails with `Branch "..." is not allowed to
deploy to github-pages`, add that branch to the `github-pages` environment
deployment branch policy or deploy from `main`.

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
