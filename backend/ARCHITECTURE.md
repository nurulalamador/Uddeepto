# Backend source structure

The microservice deployment and the single-process deployment expose the same
`/api/v1/...` API. This reorganization applies only to `backend`; `backendSimple`
keeps its original source structure. Public endpoints, payloads, roles, database
schema and client configuration remain unchanged.

## Infrastructure

- `infrastructure/loadbalancer/src/server.js` starts the public entry point.
  `balancer.js` owns distribution, health checks, failover and WebSocket tunnels.
- `infrastructure/gateway/src/config.js` loads `.env`, gateway identity and targets.
  `app.js` applies security/CORS/rate limits. `routes/proxy.routes.js` forwards
  existing API prefixes and `/socket.io`; `server.js` starts and closes the server.
- Default local ports remain 4000 for the balancer, 4101/4102 for the gateways,
  and 4001 through 4010 for business services. Docker gateways use port 4000 in
  separate containers, as before.

## Business services

Each `services/<name>/src/` contains:

| Location | Responsibility |
| --- | --- |
| `server.js` | Start the HTTP server; attach sockets for frontend API |
| `app.js` | Build the Express application without binding a port |
| `routes/` | Declare URLs, HTTP methods, authentication and upload middleware |
| `controllers/` | Handle requests, coordinate data operations, send responses |
| `services/` | Reusable feature operations and business helpers |
| `validators/` | Request schemas |
| `middleware/` | Permission checks, account checks and upload guards |
| `config/` | Feature constants and filesystem defaults |

Only folders needed by a feature are present. Database access continues to use
parameterized SQL and the shared `query`/`tx` helpers in `packages/common/src/index.js`.
There is no new ORM or second database layer.

For example, `GET /api/v1/users/me` reaches the load balancer, one gateway, then
`services/users/src/routes/users.routes.js`. Authentication runs before
`getCurrentUser` in `controllers/users.controller.js`, which queries the existing
database and sends the same JSON response.

The frontend API adapter is divided into feature routes/controllers such as
`profile`, `courses`, `contests`, `jobs`, `communities`, `messages`, `admin`,
`notifications`, `ai`, `cv` and `search`. Specific admin routes remain ahead of
generic admin routes. The internal event route remains ahead of user authentication.
The outer `/me/...` routes in jobs and webinars remain ahead of their resource router.

## Single-process deployment

`backendSimple/src/server.js` still starts one HTTP server. `src/app.js` mounts
the original `src/modules/<name>.js` files. These modules retain their existing
single-file implementation and use `src/common.js`, sharing one database pool.
This deployment has not been refactored and remains independently deployable.

`src/modules/frontend.js` supplies authentication and room membership
callbacks to the root socket server. In the microservice deployment the equivalent
callbacks live at `services/frontend/src/realtime.js`.

The two deployments retain their existing filesystem defaults: the microservice
backend uses `backend/uploads`; the simple backend uses that folder when present
and otherwise falls back to `backendSimple/uploads`. `UPLOAD_DIR` still overrides both.

## Running and checking

From `backend`, use the same `npm install`, `npm run dev` and `npm start` commands.
Infrastructure workspace commands now use `-w infrastructure/gateway` and
`-w infrastructure/loadbalancer`.

- `npm run check`: syntax checks for backend JavaScript.
- `npm test`: the pre-refactor API contract, gateway forwarding and balancer tests.
- `npm run test:lb`: the existing balancer suite alone.
- From `backendSimple`, `npm test` checks the full API mount, auth and validation.
- From `frontend`, `node --test --test-concurrency=2 tests/*.test.js` runs the existing
  SQL/API integration and client helper tests. The test importer now follows the
  extracted module graph while injecting the same in-memory database adapters.
- Set `BACKEND_TEST_VARIANT=simple` to run those API integration fixtures against
  the original single-process modules. This setting belongs only to the test harness
  and does not change `backendSimple`.

`test/fixtures/api-contract.json` records 186 HTTP method/path/route-handler-count
entries from the original services, including health and generated resource routes.
Contract checks inspect both deployments. SQL integration tests cover permissions,
uploads, profiles, hiring, courses, contests, notifications and messaging.
The Socket.IO integration suite connects through the load balancer and two gateways.

Tests use isolated in-memory PostgreSQL adapters and local HTTP servers. They do not
run against the configured production database or an Android device.
