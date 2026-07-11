# Richmond Secondary Programming Club

Source for [rssprgm.github.io](https://rssprgm.github.io), the Richmond
Secondary School Programming Club website.

## Local preview

The site is built with Jekyll and does not use a JavaScript package manager.
The tested local version is Jekyll 3.9.5.

```sh
gem install jekyll -v 3.9.5
./serve.sh
```

The preview is available at `http://localhost:4173`. Override the defaults with
`HOST`, `PORT`, or `JEKYLL_DESTINATION`. If Jekyll is not on `PATH`, set
`JEKYLL_BIN` to the executable.

## Checks

Run the existing Node tests and validate the Jekyll build before pushing:

```sh
node --test
for file in *.js; do node --check "$file"; done
jekyll build --strict_front_matter --destination /tmp/rssprgm-jekyll-build
```

The generated site must not contain `supabase`, `tests`, environment files, or
local reference material. `_config.yml` owns the publication boundary.

## Content

- Edit FAQ entries in `_data/faqs.yml`.
- Edit recommended tools in `_data/resources.yml` and place their icons in
  `assets/icons/resources`.
- Homepage projects and other editorial sections currently live in
  `index.html`.

## Supabase

The join form submits through Supabase Edge Functions. Install and authenticate
the Supabase CLI before changing the backend:

```sh
supabase login
supabase link --project-ref wwpxrfnpwwdgffvfomyn
supabase db push
supabase functions deploy join --use-api
supabase functions deploy submissions --use-api
```

The deployed `join` function requires these remote secrets:

- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `RATE_LIMIT_SALT`

These settings are optional:

- `TURNSTILE_ALLOWED_HOSTNAMES`
- `JOIN_RECENT_IP_LIMIT`

Set secret values through the Supabase dashboard or CLI. Never commit them.
Local `.env` files are ignored by Git and must remain untracked.

## Deployment

GitHub Pages remains the deployment authority. Pushing the default branch
triggers the repository's built-in Jekyll Pages workflow. Check the Actions tab
for build and deployment status.
