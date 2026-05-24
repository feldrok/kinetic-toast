# Framework-agnostic core runtime

Kinetic Toast currently ships as a React library. The long-term goal is to keep the toast behavior portable so React, Vue, vanilla DOM, and other adapters can share one runtime instead of reimplementing lifecycle behavior per framework.

This document defines the target boundaries for that split. It is a design proposal; implementation should happen in follow-up PRs.

## Goals

- Keep toast state, lifecycle, timing, IDs, queue behavior, and subscriptions independent from React.
- Make React one adapter over the core runtime, not the owner of toast behavior.
- Leave room for future Vue and vanilla adapters without breaking the current React API during `0.x`.
- Keep shared public concepts consistent across adapters: states, positions, duration, autopilot, dismiss/update/clear, and promise transitions.
- Avoid framework render types, such as `ReactNode`, in the core runtime.

## Non-goals

- This PR does not implement the runtime split.
- This PR does not add Vue or vanilla adapters.
- This PR does not change package exports.
- This PR does not remove the current root React export.

## Proposed source layout

A future implementation can move toward this layout:

```txt
src/
  core/
    constants.ts
    ids.ts
    options.ts
    promise.ts
    store.ts
    timers.ts
    types.ts
    view-model.ts
  react/
    index.ts
    kinetic.tsx
    toast.tsx
    types.ts
  vanilla/
    index.ts          # future
  vue/
    index.ts          # future
  styles.css
  index.ts            # compatibility export during 0.x
```

The exact file names can change, but the dependency direction should not:

```txt
core -> no framework imports
react -> imports core + react/react-dom/motion
vue -> imports core + vue renderer/runtime
vanilla -> imports core + DOM helpers
```

## Core responsibilities

The core runtime should own framework-neutral behavior:

- ID generation.
- Toast records and immutable-ish snapshots.
- Store subscription and snapshot reads.
- `show`, `success`, `error`, `warning`, `info`, `action`, `promise`, `dismiss`, and `clear` behavior.
- Option merging and defaults.
- Duration, exit delay, autopilot delay normalization.
- Position assignment and update semantics.
- Pure viewport/view-model helpers for grouping, live-item filtering, and selected-toast derivation.
- Instance IDs for replacing/updating toasts safely.
- Promise transition behavior from loading to success/error/action.

The core runtime should expose a small external-store API:

```ts
export interface KineticStore<TToast> {
  getSnapshot(): readonly TToast[];
  subscribe(listener: () => void): () => void;
}
```

React can wrap this with `useSyncExternalStore`. Vue can subscribe from a composable. Vanilla can subscribe directly and patch the DOM.

## Initial extraction map

The current React implementation mixes several responsibilities in `src/toast.tsx`. A future extraction should move these pieces into core modules:

- `store`, listener management, and immutable snapshot reads.
- `generateId` and instance ID handling.
- `createToast`, `updateToast`, `dismissToast`, and `clear`.
- `resolveAutopilot`, `mergeOptions`, and `buildKineticItem`.
- Duration/removal timer bookkeeping that should behave the same in every adapter.
- Promise orchestration for `kinetic.promise`.

The current `src/kinetic.tsx` and `src/icons.tsx` should remain React-adapter code because they depend on JSX, refs, Motion, DOM measurement, pointer events, and React SVG components.

## Adapter responsibilities

Adapters should own framework-specific rendering and integration details.

### React adapter

React should own:

- `Toaster` component.
- Portal rendering with `createPortal`.
- `useSyncExternalStore` integration over the core store.
- `ReactNode` support for `description` and `icon`.
- React event handlers and refs.
- Motion integration via `motion/react`.
- React-only memoization decisions.

### Future Vue adapter

Vue should own:

- Vue component/composable API.
- Vue slot support for rich descriptions/icons/actions.
- Vue lifecycle subscription cleanup.
- Mapping shared core toast records into Vue-renderable state.

### Future vanilla adapter

Vanilla should own:

- DOM renderer or custom element API.
- DOM event wiring and cleanup.
- Template/render callback support for rich content.
- Direct subscription to the core store.

## Type boundaries

Core types should be framework-neutral. Today `KineticOptions` depends on `ReactNode`, which makes the public type React-bound.

A future split should introduce core types such as:

```ts
export type KineticState =
  | "success"
  | "loading"
  | "error"
  | "warning"
  | "info"
  | "action";

export type KineticPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CoreKineticOptions {
  id?: string;
  title?: string;
  type?: KineticState;
  position?: KineticPosition;
  duration?: number | null;
  fill?: string;
  roundness?: number;
  autopilot?: boolean | { expand?: number; collapse?: number };
}
```

React-specific options can extend the core shape:

```ts
export interface ReactKineticOptions extends CoreKineticOptions {
  description?: React.ReactNode;
  icon?: React.ReactNode | null;
  button?: {
    title: string;
    onClick: () => void;
  };
  styles?: {
    title?: string;
    description?: string;
    badge?: string;
    button?: string;
  };
}
```

Future adapters can define their own rich-content fields without changing core behavior.

## Render payloads and rich content

The core should not try to serialize or render framework-specific content. Rich payloads should either:

1. stay inside adapter-specific option types, or
2. be stored as opaque adapter payloads while the core only manages identity and lifecycle.

If opaque payloads are used, the core store can be generic:

```ts
export interface CoreToast<TPayload = unknown> extends CoreKineticOptions {
  id: string;
  instanceId: string;
  state?: KineticState;
  exiting?: boolean;
  payload?: TPayload;
  autoExpandDelayMs?: number;
  autoCollapseDelayMs?: number;
}
```

This keeps the runtime portable while allowing React/Vue/vanilla to keep their own content models.

## Timer ownership

Timer policy should be explicit before implementation:

- Core can own dismissal timers for consistent behavior across adapters.
- Adapters can notify the core when user interaction pauses/resumes timers.
- Render-only timers, such as animation cleanup or pointer interactions, should remain in adapters.

A possible core timer API:

```ts
interface KineticRuntime<TPayload> {
  store: KineticStore<CoreToast<TPayload>>;
  show(options: CoreCreateOptions<TPayload>): string;
  update(id: string, options: CoreCreateOptions<TPayload>): void;
  dismiss(id: string, instanceId?: string): void;
  clear(position?: KineticPosition): void;
  pause(): void;
  resume(): void;
}
```

The current React adapter pauses all dismissal timers on hover. That behavior can become `runtime.pause()` and `runtime.resume()` so future adapters behave the same.

## Package compatibility

A later package export PR should decide the final public paths. One likely shape is:

```json
{
  "exports": {
    ".": "./dist/react/index.js",
    "./react": "./dist/react/index.js",
    "./core": "./dist/core/index.js",
    "./styles.css": "./dist/styles.css"
  }
}
```

During `0.x`, the root export can continue to behave like the current React package to avoid surprising existing users. New framework-neutral APIs should live behind explicit subpath exports.

## Migration sequence

Recommended PR order:

1. Document this boundary proposal. This PR.
2. Plan package exports for core and adapters.
3. Split core option types from React render types.
4. Extract the core store/runtime without changing the public React API.
5. Adapt React `Toaster` to the core store with `useSyncExternalStore`.
6. Add optional adapter-agnostic visual performance controls.
7. Add Vue/vanilla adapters only after the core API stabilizes.

## Risks and constraints

- Extracting the store too early can accidentally freeze a bad cross-framework API. Keep the first extraction internal until the API shape is validated.
- `ReactNode` must not leak into core types or `./core` exports.
- The current `kinetic.promise` API should remain source-compatible for React users during the migration.
- Hover pause and navigation behavior should be modeled carefully so adapters can reproduce it without copying React internals.
- The root export should remain compatible until a documented breaking release.
- CSS selectors should remain data-attribute based where possible so non-React renderers can reuse `styles.css`.

## Decision summary

Kinetic Toast should evolve toward a framework-neutral runtime with adapter-specific renderers. The core should manage toast lifecycle and subscriptions; adapters should manage rendering, framework content types, event handlers, and animation integration. This keeps the current React package viable while making Vue and vanilla support realistic without duplicating behavior.
