<div align="center">
  <h1>Kinetic Toast</h1>
  <p>An opinionated, physics-based toast notification library for React.</p>
</div>

Kinetic Toast gives you morphing, physics-driven notifications with a small imperative API, TypeScript types, and a namespaced CSS surface.

## Features

- Physics-inspired morphing animations powered by Motion
- Toast helpers for success, error, warning, info, and action states
- Promise lifecycle toasts
- Multiple positions and custom viewport offsets
- Optional light, dark, or system theming
- Optional close button for manual dismissal
- Optional navigation controls for multiple active toasts
- TypeScript types included

## Installation

Choose the setup that matches your project.

### shadcn/ui

For shadcn/ui projects, use the registry item. It follows the same basic pattern as shadcn Sonner: add a UI component, render `<Toaster />`, then call the toast helper from client code.

```bash
npx shadcn@latest add https://raw.githubusercontent.com/feldrok/kinetic-toast/main/public/r/kinetic-toast.json
# or
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/feldrok/kinetic-toast/main/public/r/kinetic-toast.json
# or
bunx --bun shadcn@latest add https://raw.githubusercontent.com/feldrok/kinetic-toast/main/public/r/kinetic-toast.json
```

Render `<Toaster />` once in your app shell:

```tsx
import { Toaster } from "@/components/ui/kinetic-toast";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

Use `kinetic` from client code:

```tsx
"use client";

import { kinetic } from "@/components/ui/kinetic-toast";

kinetic.success({ title: "Saved" });
```

The registry installs a Sonner-style `components/ui/kinetic-toast.tsx` wrapper plus editable source under `components/ui/kinetic-toast/`. The wrapper imports colocated CSS, so the common setup is one `shadcn add` command plus one `<Toaster />`.

The wrapper also maps your shadcn theme tokens (`--popover`, `--popover-foreground`) onto kinetic's surface variables, so toasts inherit the host app theme automatically. Whatever toggles dark mode in your app — `next-themes`, Tailwind's class mode, your own state — also flips the toast surface. No JS theme dependency.

### npm

Once the package is published, install it from npm:

```bash
npm install kinetic-toast
# or
pnpm add kinetic-toast
# or
bun add kinetic-toast
```

Import the stylesheet once in your app root:

```tsx
import "kinetic-toast/styles.css";
```

Then import from the package:

```tsx
import { kinetic, Toaster } from "kinetic-toast";
```

## Quick start

```tsx
import "kinetic-toast/styles.css";
import { kinetic, Toaster } from "kinetic-toast";

export default function App() {
  return (
    <>
      <Toaster position="top-right" />

      <button
        type="button"
        onClick={() =>
          kinetic.success({
            title: "Saved",
            description: "Your changes were saved successfully.",
          })
        }
      >
        Show toast
      </button>
    </>
  );
}
```

## Toaster

Render one `Toaster` near the root of your app.

```tsx
<Toaster
  position="top-right"
  offset={16}
  theme="system"
  closeButton
  navigation
/>
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `position` | `KineticPosition` | `top-right` | Default toast position. |
| `offset` | `number \| string \| { top?, right?, bottom?, left? }` | — | Viewport offset. Numbers are treated as pixels. |
| `theme` | `light \| dark \| system` | — | Applies default fills and description colors. |
| `options` | `Partial<KineticOptions>` | — | Default options merged into every toast. |
| `closeButton` | `boolean` | `false` | Shows an accessible close button on each toast. |
| `navigation` | `boolean` | `false` | Shows previous/next controls when multiple live toasts share a position. |

## Toast API

```tsx
kinetic.show({ title: "Hello" });
kinetic.success({ title: "Saved" });
kinetic.error({ title: "Something went wrong" });
kinetic.warning({ title: "Heads up" });
kinetic.info({ title: "FYI" });
kinetic.action({
  title: "Continue",
  button: {
    title: "Open",
    onClick: () => {},
  },
});
```

Each call returns a toast id:

```tsx
const id = kinetic.info({ title: "Uploading", duration: null });
kinetic.dismiss(id);
```

Pass an explicit `id` to update or replace an existing toast. Without an explicit `id`, each toast gets a unique id, so multiple toasts can be shown at the same time.

```tsx
kinetic.info({ id: "sync", title: "Syncing", duration: null });
kinetic.success({ id: "sync", title: "Synced" });
```

Clear all toasts, or only a single position:

```tsx
kinetic.clear();
kinetic.clear("top-right");
```

## Promise toasts

```tsx
await kinetic.promise(saveProfile(), {
  loading: {
    title: "Saving profile",
  },
  success: {
    title: "Profile saved",
  },
  error: {
    title: "Save failed",
    description: "Please try again.",
  },
});
```

You can derive success, error, or action options from the resolved value or thrown error:

```tsx
await kinetic.promise(fetchUser(), {
  loading: { title: "Loading user" },
  success: (user) => ({ title: `Loaded ${user.name}` }),
  error: (error) => ({
    title: "Could not load user",
    description: String(error),
  }),
});
```

## Toast options

`KineticOptions` is the React adapter option type. The package also exports `CoreKineticOptions` for framework-neutral fields shared by future adapters.

```ts
type KineticOptions = {
  id?: string;
  title?: string;
  description?: React.ReactNode | string;
  type?: "success" | "loading" | "error" | "warning" | "info" | "action";
  position?: KineticPosition;
  duration?: number | null;
  icon?: React.ReactNode | null;
  fill?: string;
  roundness?: number;
  autopilot?: boolean | { expand?: number; collapse?: number };
  performanceMode?: "quality" | "minimal";
  effects?: {
    gooey?: boolean;
    blur?: boolean;
  };
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
};
```

### Visual performance controls

Use `performanceMode: "minimal"` to disable the SVG gooey filter and header blur for a toast. Use `effects` for finer control:

```tsx
kinetic.info({
  title: "Lightweight",
  performanceMode: "minimal",
});

kinetic.success({
  title: "No blur",
  effects: { blur: false },
});
```

## Styling

Kinetic Toast uses `data-kinetic-*` attributes and `--kinetic-*` CSS variables internally.

You can customize defaults globally:

```css
:root {
  --kinetic-width: 360px;
  --kinetic-height: 42px;
  --kinetic-duration: 600ms;
}
```

### Theming

Kinetic Toast follows the host app theme via three CSS variables:

- `--kinetic-toast-fill` — the SVG surface color
- `--kinetic-toast-fg` — primary text and icon color (used by the toast root via `currentColor`, so the close button and nav chevrons follow)
- `--kinetic-toast-fg-muted` — description text

Defaults invert when a `.dark` ancestor is present, so any theme manager that toggles `.dark` on `<html>` (next-themes, Tailwind's class mode, your own state) will flip the toast surface automatically. Override at any level:

```css
:root {
  --kinetic-toast-fill: hsl(var(--popover));
  --kinetic-toast-fg: hsl(var(--popover-foreground));
  --kinetic-toast-fg-muted: color-mix(
    in oklab,
    hsl(var(--popover-foreground)) 60%,
    transparent
  );
}
```

The shadcn registry wrapper already does this mapping for you. If you want to force a single theme regardless of the host, pass `theme="light" | "dark" | "system"` to `<Toaster />` — the wrapper detects an explicit `theme` and steps out of the way so the prop wins.

**Portal constraint:** the toast renders into `document.body`, so theme tokens must be reachable from `html` or `body`. A `.dark` class scoped to a single section deeper in the page won't reach the toast — set theme tokens at the document level.

You can also pass class names per toast:

```tsx
kinetic.success({
  title: "Custom",
  styles: {
    title: "my-title",
    description: "my-description",
    badge: "my-badge",
    button: "my-button",
  },
});
```

## Development

```bash
bun install
bun run build
npm pack --dry-run
```

### Registry development

```bash
bun run registry:validate
bun run registry:build
bun run registry:check
```

### Performance harnesses

See [`benchmarks/README.md`](benchmarks/README.md) for local stress harnesses used to profile burst rendering, promise transitions, navigation, and visual performance modes.

`registry.json` is the source registry. `public/r` is the static registry output produced by `shadcn build`. The `kinetic-toast` item installs a Sonner-style `@ui/kinetic-toast.tsx` wrapper plus editable source under `@ui/kinetic-toast/`.

### Agent skill

This repo includes `skills/kinetic-toast/SKILL.md`, a concise setup guide an agent can use so requests like “set up Kinetic Toast in this app” follow the preferred shadcn registry flow, client-boundary requirements, and framework-specific CSS notes.

### Architecture notes

See [`docs/framework-agnostic-core.md`](docs/framework-agnostic-core.md) for the proposed long-term split between a framework-neutral toast runtime and React, Vue, vanilla, or other framework adapters. See [`docs/react-adapter-performance.md`](docs/react-adapter-performance.md) for the React adapter memoization and React Compiler policy.

## License

MIT
