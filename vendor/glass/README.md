# Glass runtime

Bundled from the sibling `glass` repository at commit
`b3339c0` using Bun. Rebuild with `scripts/build-glass.sh`.
JavaScript identifiers, syntax and whitespace are minified; WGSL comments and
whitespace are removed. Public exports and shader bindings remain intact.
Source maps are omitted. Identifier mangling is not source-code protection.

The main runtime is 821,805 bytes; the standalone flat-control runtime is
37,654 bytes before transport compression. No demo assets or private icons are
included. The source repository is authoritative; do not edit these bundles.

The library samples CSS background images and registered glass surfaces, not arbitrary DOM or video pixels.

Includes local source changes adding `setProminentWhite` to GlassEffectContainer
and the renderer, using the existing GPU prominent tint pass and native ramp.
White uses the captured blue material’s maximum-channel response equally for
RGB, preserving its luminance response without adding a CSS tint layer. This
is a port-derived white material, not a separately captured UIKit white recipe.
