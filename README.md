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

- Edit the Git workshop summary and session notes in `_data/git_workshop.yml`.
- The Meetings page uses `meeting-detail.js` for accessible tabs, chapter links, and notes search. The six-second intro is a preview, not a meeting recording.
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

## Meeting-page design reference

The Git workshop detail page adapts the player, About/Summary/Transcript tab structure,
chapter summaries, and searchable reading layout from Apple's
[Meet the Foundation Models framework session](https://developer.apple.com/videos/play/wwdc2025/286/).
RSSPRGM uses slide-based Session Notes in place of a transcript. Source captures and
local screenshots are private reference material under `.reference/video-page/`.

The Meetings catalogue is `/meetings.html`. Workshop detail pages live under
`meetings/` and opt into the catalogue with `meeting: true` and a `workshop` data key.
The Git session is `/meetings/git/`; the detail page links back to the catalogue.

## Glass controls

`glass-controls.js` progressively enhances native buttons and links with the local
Glass runtime in `vendor/glass/`. The previous SVG refraction, glow, and spring
implementation has been removed. Flat controls are the default, including when
JavaScript, WebGPU, shader-f16, or GPU initialization is unavailable.

Reduced motion/transparency, Save-Data, reported memory of 2 GB or less, and
a single reported CPU core skip the GPU bundle. These are conservative
hints, not a universal low-end-device flag. Software adapters, device loss and
runtime errors also fall back. The upstream renderer samples background images and registered surfaces.
`glass-canvas.js` registers the live hero canvas with the same GPU scene;
`hero-fluid-frame` updates its texture after painting, without per-frame readback.

Related hero actions share one GlassEffectContainer and one canvas. Other DOM
and video content is not captured.

Primary buttons (Join and Submit) use the package’s `setProminentWhite` GPU tint.
The shared base material uses the native `control-clear` parameters. No CSS
colour overlays are applied to glass. Submit’s platter fills its action row.

Bottom playback controls use the package’s `setupFlatFlexControls`: native flex
springs and continuous SDF union geometry rendered with a flat colour fill.
No glass, refraction, or blur is used for playback controls. The same relaxed
low-end gate skips GPU effects on 2 GB devices or a single reported CPU core;
4 GB and dual-core devices are eligible.

Rebuild the vendored runtime with `scripts/build-glass.sh` (Bun and the sibling
`glass` checkout required). JavaScript identifiers are mangled, shaders are
compacted, and source maps are omitted.

Slide placeholders are embedded 8×8 RGB averages. After changing slide JPEGs,
run `python3 scripts/build-slide-placeholders.py` (Pillow required).
