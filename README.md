# i-press-buttons.github.io

The source of my personal homepage, live at
**<https://i-press-buttons.github.io>**.

A space-themed, single-page list of the things I have built. Plain HTML, CSS and
two small scripts — no build step, no dependencies, and no external requests.
GitHub Pages serves the files in this repo exactly as they are, so a push is a
deploy.

The flat list is the default. A **3D view** switch in the top corner turns the
same cards into a star map: each project is a planet with its name above it,
and a small ship flies between them. A project's description only appears once
the ship has arrived. One press of an arrow key, a tap on the on-screen arrows
or a click on a planet sends the ship on a short flight, and Enter opens the
project it is parked at. The choice of view is remembered per browser. With
reduced motion set in the OS, the ship arrives straight away instead of flying.
Without JavaScript the switch never appears and the page is the flat list.

Above the list, **Networking** and **Games** tabs show one category at a time,
in both views. The last tab picked is remembered too. Without JavaScript the
tabs never appear and every project shows.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page. Every planet, the rocket and the asteroids are inline SVG. |
| `styles.css` | The starfield, the layout, the animations and the 3D view. |
| `tabs.js` | The Networking / Games tabs. They read each card's `data-category`. |
| `view3d.js` | The 3D view switch, the star map and the ship. It reads the cards from the page. |
| `favicon.svg` | The tab icon. |
| `.nojekyll` | Stops Pages running the files through Jekyll. |

## Working on it locally

Open `index.html` in a browser. That is the entire toolchain — there is nothing
to install and nothing to run.

## Adding a project

Copy an existing `<article class="planet-card" data-category="…">` block in
`index.html`, paste it into `.fleet`, set `data-category` to the tab it belongs
under (`networking` or `games`), and change four things:

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

The 3D view picks the new card up on its own; there is nothing else to edit.

Commit and push to `main`; Pages redeploys within a minute or two.
