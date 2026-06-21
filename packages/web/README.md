# @openhop/web

> Pre-built static assets for the [OpenHop](https://github.com/naorsabag/openhop) web UI — animated data-flow renderer (PIXI.js).

This is an internal package consumed by the [`openhop`](https://www.npmjs.com/package/openhop) CLI. **You don't need to install it directly** — `openhop serve` and `openhop demo` serve these assets for you on `http://localhost:8788`.

The package contains a built Vite bundle (HTML + JS + sprites) that:

- Subscribes to the OpenHop API for a flow's contents
- Renders nodes as pixel-art sprites
- Animates data pixels traveling between nodes
- Supports drill-down into sub-flows
- Reads flows from URL fragments for the static GitHub Pages deploy
- Optional GA4 on GitHub Pages only (`GA_MEASUREMENT_ID` repo secret → `pages.yml`); local dev and CLI deploys never load it

## Documentation

Full documentation:
**[github.com/naorsabag/openhop](https://github.com/naorsabag/openhop)**

## License

MIT © Naor Sabag
