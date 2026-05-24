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

## License

MIT
