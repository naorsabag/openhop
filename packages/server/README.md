# @openhop/server

> Fastify API server for [OpenHop](https://github.com/naorsabag/openhop) — stores and serves data-flow definitions.

This is an internal package consumed by the [`openhop`](https://www.npmjs.com/package/openhop) CLI. **You don't need to install it directly** — `openhop serve` and `openhop demo` boot it for you.

If you do want it standalone (custom integration, embedding the renderer in your own service):

```bash
npm install @openhop/server
```

```ts
import { buildApp } from "@openhop/server"

const app = await buildApp()
await app.listen({ port: 8787, host: "0.0.0.0" })
```

## Routes

- `GET /health` — readiness probe
- `GET /api/flows` — list
- `POST /api/flows` — create from YAML
- `GET /api/flows/:id` — fetch
- `PATCH /api/flows/:id` — apply patch operations
- `DELETE /api/flows/:id` — remove
- Swagger docs at `GET /docs`

## Documentation

Full documentation, schema reference, and the OpenHop story:
**[github.com/naorsabag/openhop](https://github.com/naorsabag/openhop)**

## License

MIT © Naor Sabag
