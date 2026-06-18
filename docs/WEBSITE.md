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

## GitHub Pages

The Pages workflow builds `apps/site` and uploads `apps/site/dist`.

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
3. Set the site base path to `/` in the Pages build environment.
4. Add a `CNAME` file to the Pages artifact or configure the domain in GitHub
   Pages settings.

Do not add the custom domain until DNS ownership and GitHub Pages settings are
ready, otherwise the project URL is safer for immediate publishing.
