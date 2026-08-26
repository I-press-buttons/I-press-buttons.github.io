# i-press-buttons.github.io

The source of my personal homepage, live at
**<https://i-press-buttons.github.io>**.

A space-themed, single-page list of the things I have built. Plain HTML and CSS —
no build step, no dependencies, no JavaScript, and no external requests. GitHub
Pages serves the files in this repo exactly as they are, so a push is a deploy.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page. Every planet, the rocket and the asteroids are inline SVG. |
| `styles.css` | The starfield, the layout and the animations. |
| `favicon.svg` | The tab icon. |
| `.nojekyll` | Stops Pages running the files through Jekyll. |

## Working on it locally

Open `index.html` in a browser. That is the entire toolchain — there is nothing
to install and nothing to run.

## Adding a project

Copy an existing `<article class="planet-card">` block in `index.html`, paste it
into `.fleet`, and change four things:

1. `<h3>` — the project name.
2. `.blurb` — one or two sentences on what it does.
3. `.stack` — what it is built with, separated by `·`.
4. `.links` — an `<a class="link primary">` per destination. For a project with
   no public repo, use `<span class="link muted">Source is private</span>`
   instead of a dead link.

Then give it its own planet: inside that card's `<svg>`, change the two
`<stop>` colours in the `radialGradient` and rename both the gradient's `id`
and the `clipPath` id (ids must be unique across the page, and the `fill`/
`clip-path` references must match the new names). Everything else — the
banding, the craters, the bob — follows the new colours automatically.

Commit and push to `main`; Pages redeploys within a minute or two.
