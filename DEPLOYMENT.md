# Deploying your own instance

SuttaCentral.now is built so that a deployed fork needs only one file edited: [`src/constants/meta-data.ts`](src/constants/meta-data.ts).

It runs well with low traffic on a Cloudflare worker free tier. The suttacentral.net API's are on the Cloudflare network too, so requests are fast.

## 1. Edit `src/constants/meta-data.ts`

The comments in that file explain each field. It is the only file you should need to edit for your instance's identity, links and analytics.

## 2. Optionally replace the branding

The favicons and Open Graph images in `public/` are specific to SuttaCentral.now. Replace them if you want your own identity. If you use a different Open Graph image, update `ogImage` in the config too.

## 3. Build and deploy

```sh
pnpm i
pnpm build
npx wrangler deploy
```

Set the worker name in [`wrangler.jsonc`](wrangler.jsonc) if you need a name other than `suttacentral-ssr`.

[`.build.yml`](.build.yml) is my SourceHut CI, and Cloudflare account and mirror remotes. Replace it with your own or ignore it.

## 4. Sitemaps and robots

The sitemap files are generated from `siteMetaData.origin`:

```sh
pnpm build-sitemap
```

That script fetches every menu and suttaplex from SuttaCentral's API, and five whole dictionaries, so run it once for your origin and again only when you need fresh sitemap contents, which is almost never. The committed sitemaps and [`public/robots.txt`](public/robots.txt) still contain the SuttaCentral.now origin, so you probably also want to update the `Sitemap:` line in `robots.txt`.
