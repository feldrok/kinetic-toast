# Package exports plan

Kinetic Toast currently exposes a React-first API from the package root and a shared CSS file from `kinetic-toast/styles.css`. As the project moves toward a framework-agnostic core with React, Vue, vanilla, and other adapters, package exports should make those boundaries explicit.

This document proposes the public export shape and migration path. It does not change `package.json`; implementation should happen in follow-up PRs.

## Goals

- Preserve the current root import for existing React users during `0.x`.
- Introduce explicit adapter subpaths so new code can choose the correct runtime intentionally.
- Keep framework-neutral code importable without pulling React, React DOM, Motion, or adapter renderers.
- Keep CSS import stable at `kinetic-toast/styles.css`.
- Leave room for Vue and vanilla adapters without publishing empty or misleading exports before they exist.

## Current shape

Today the package exposes:

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "default": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  }
}
```

The root currently means React:

```ts
import { kinetic, Toaster } from "kinetic-toast";
import "kinetic-toast/styles.css";
```

That should continue to work while the package is in `0.x`.

## Target export model

When the core/runtime split exists, the package should move toward explicit subpaths:

```ts
import { createKineticRuntime } from "kinetic-toast/core";
import { kinetic, Toaster } from "kinetic-toast/react";
import "kinetic-toast/styles.css";
```

Future adapters can add:

```ts
import { kinetic, KineticToaster } from "kinetic-toast/vue";
import { createKineticElement } from "kinetic-toast/vanilla";
```

Do not publish `./vue` or `./vanilla` exports until those adapters exist and are tested.

## Proposed staged export map

### Stage 1: current package, safer metadata

Keep the root and CSS exports exactly as users expect:

```json
{
  "exports": {
    ".": { /* current React entry */ },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["*.css", "**/*.css"]
}
```

This is compatible with the current source layout.

### Stage 2: add explicit React subpath

After source files are organized into adapter entries, add `./react` while keeping the root as a compatibility alias:

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/react/index.d.mts",
        "default": "./dist/react/index.mjs"
      },
      "require": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react/index.js"
      },
      "default": "./dist/react/index.js"
    },
    "./react": {
      "import": {
        "types": "./dist/react/index.d.mts",
        "default": "./dist/react/index.mjs"
      },
      "require": {
        "types": "./dist/react/index.d.ts",
        "default": "./dist/react/index.js"
      },
      "default": "./dist/react/index.js"
    },
    "./styles.css": "./dist/styles.css"
  }
}
```

At this stage, docs should prefer `kinetic-toast/react` for new React projects while noting that the root remains supported.

### Stage 3: add framework-neutral core subpath

Once the runtime has no React imports, expose it through `./core`:

```json
{
  "exports": {
    "./core": {
      "import": {
        "types": "./dist/core/index.d.mts",
        "default": "./dist/core/index.mjs"
      },
      "require": {
        "types": "./dist/core/index.d.ts",
        "default": "./dist/core/index.js"
      },
      "default": "./dist/core/index.js"
    }
  }
}
```

The core entry must not import React, React DOM, Motion, JSX runtime, or browser-only DOM code at module evaluation time.

### Stage 4: add implemented adapters only

Add future adapters only when they are real, documented, and validated:

```json
{
  "exports": {
    "./vue": {
      "import": {
        "types": "./dist/vue/index.d.mts",
        "default": "./dist/vue/index.mjs"
      },
      "default": "./dist/vue/index.mjs"
    },
    "./vanilla": {
      "import": {
        "types": "./dist/vanilla/index.d.mts",
        "default": "./dist/vanilla/index.mjs"
      },
      "require": {
        "types": "./dist/vanilla/index.d.ts",
        "default": "./dist/vanilla/index.js"
      },
      "default": "./dist/vanilla/index.js"
    }
  }
}
```

Vue can be ESM-only if that matches the adapter/tooling decision at implementation time. Do not assume CJS is required for every future adapter.

## Dependency policy

Current package dependencies are React-oriented:

- `react` and `react-dom` are peer dependencies.
- `motion` is a dependency used by the React renderer.

A framework-neutral core export should be lightweight. Importing `kinetic-toast/core` should not execute or require React-specific modules.

Potential policies:

1. Keep React peer dependencies at package level while the root remains React. This is simplest during `0.x`.
2. When non-React adapters become first-class, consider making adapter dependencies explicit in docs and package metadata. For example, Vue can be a peer dependency of the Vue adapter once `./vue` exists.
3. Keep `motion` usage adapter-local. If only the React adapter needs `motion/react`, core and vanilla should not import it.

## Build requirements

The build should emit one entry per public subpath:

```txt
dist/
  core/
    index.mjs
    index.js
    index.d.mts
    index.d.ts
  react/
    index.mjs
    index.js
    index.d.mts
    index.d.ts
  styles.css
```

Implementation should verify:

- `import("kinetic-toast/core")` does not load React.
- `import("kinetic-toast/react")` works in ESM consumers.
- `require("kinetic-toast/react")` works if CJS support is retained for React.
- `kinetic-toast/styles.css` remains packed and importable.
- `npm pack --dry-run` includes all exported files.

## Root export compatibility

For `0.x`, keep:

```ts
import { kinetic, Toaster } from "kinetic-toast";
```

as an alias to the React adapter.

A future breaking release can consider making the root export one of these:

1. React compatibility forever.
2. Core-only API.
3. A small entry that points users to explicit adapter paths.

Do not make this decision until Vue/vanilla usage exists. Explicit subpaths reduce pressure to repurpose the root quickly.

## CSS export

Keep CSS framework-neutral and stable:

```ts
import "kinetic-toast/styles.css";
```

Because all adapters should be able to reuse the same visual data attributes and CSS variables, `./styles.css` should not live under `./react`.

The existing Bunchee warning about `./styles.css` being declared in exports but missing as a source entry is tracked separately. Export expansion should not proceed until the build can emit and pack every subpath cleanly.

## Documentation migration

When `./react` exists:

- README quickstart can keep root imports for compatibility or switch to `kinetic-toast/react` for clarity.
- shadcn registry wrappers should import from the React adapter explicitly once available.
- Agent skill docs should prefer explicit adapter subpaths for new installs.
- Core docs should state that `./core` is for adapter authors and advanced integrations, not most React users.

## Relationship to other work

This plan depends on several related changes:

- A documented framework-agnostic core runtime boundary.
- A core-vs-adapter type split.
- A React adapter subscription layer over core snapshots.
- CSS side effects metadata so stylesheet imports are preserved by consumer bundlers.
- A warning-free build setup for the exported stylesheet.

## Decision summary

Kinetic Toast should keep the package root compatible with the current React API during `0.x`, add explicit adapter subpaths as implementation lands, and expose a framework-neutral `./core` only after it has no React, Motion, JSX, or DOM renderer dependencies. Future Vue and vanilla exports should be added only when those adapters are implemented and validated.
