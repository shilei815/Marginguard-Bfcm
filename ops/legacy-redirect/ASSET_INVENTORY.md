# Source-reproduced asset inventory

Approved application base: `69f91e492e371dc4ca23f0d9b3d0c3c847e98696`.
This inventory comes from a local locked-toolchain production build, **not a live
crawl or a list of every deployment ever served by the legacy project**.

| Path | Approved build | Redirect expectation |
| --- | --- | --- |
| `/` | `dist/index.html` exists | Evergreen `/`; hosted 200 still requires validation. |
| `/demo-skus.csv` | Present, original synthetic copy | Same path on evergreen site. |
| `/robots.txt` | Present, evergreen sitemap reference | Same path, then verify response body. |
| `/sitemap.xml` | Present, evergreen root location | Same path, then verify response body. |
| `/assets/index-B15tvVQn.js` | Present, 345,832 bytes | Same immutable filename; verify hosted asset and type. |
| `/assets/index-DsaqiVWi.css` | Present, 27,726 bytes | Same immutable filename; verify hosted asset and type. |
| `/assets/example.js` | **Absent** — deliberate test example | Redirect path can be correct while destination returns 404. No existence promise. |
| Other historical hashed assets | **Unknown / not inventoried live** | May be absent on the new host. Must inventory actual shared/cached legacy paths before approval. |

Runtime `src/` (excluding test-only changes), `public/` and lockfile match the
initial `7f34343` app; the migration adds metadata/build tooling, not a new app
bundle. The reproduced current bundle names above also match the previously
recorded initial-release build. This is not proof of every historical deployment's
asset list, or that the latest live deployment is that exact artifact.

Before activation, the owner must inspect retained legacy deployment artifacts
and known shared links. Record required missing assets and either arrange a
separately approved selective immutable-asset retention on the new project or
explicitly accept specific expired-asset exceptions. Do not copy the full app
into this redirect package. Do not rewrite unknown asset paths to `/`: returning
HTML for a JavaScript/CSS request can break cached pages and conceal the failure.
Do not claim all old hashed URLs will work simply because the redirect returns
301. A material unresolved shared-link exception is a release hold.

The local browser model intentionally returns 404 for `assets/example.js` after
preserving the path. No live asset-availability test was performed here.
