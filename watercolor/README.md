# Watercolor

Twenty original AI-generated watercolor references created with the built-in image generation tool. Bird names and markings are in birds.json; lessons are in lessons.js. Images live in assets/*.webp. Matching assets/*-outline.svg files are vector contour tracings extracted directly from each reference (bilateral smoothing, Canny boundaries, simplified paths), not independently redrawn birds. Palette swatches in palettes.json are sampled from each painting; names are descriptive screen-color guides, not pigment recipes.

## Shared generation prompt

Use case: scientific-educational. Create one beautiful watercolor bird study reference image of a {bird}: {markings}. Authentic hand-painted transparent watercolor on pure white paper, visible pigment granulation, delicate soft and crisp edges, restrained naturalistic field-guide proportions. Single entire bird in side three-quarter profile, perched on a simple short bare twig (waterbirds may stand), fully visible feet and tail, centered with generous 12% white margin. No labels, text, palette, border or extra birds. Clear clean silhouette and readable major feather divisions so an exact tracing can be derived. Square composition, highly detailed yet approachable for beginner painters.

## Behavior

Static HTML/CSS/JS, no dependencies at runtime. Search, region filters, direct bird hashes, reference/outline switch, downloads, two-page print guide and browser-local completion tracking. Progress is specific to this origin and browser. All artwork is illustration, not a photographic identification reference.
