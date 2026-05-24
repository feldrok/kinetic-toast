---
name: kinetic-toast
# Trigger this skill when an agent is asked to install, set up, migrate, or use Kinetic Toast in a React, Next.js, Vite, or shadcn/ui project.
description: Set up and use Kinetic Toast, an opinionated physics-based React toast component/library. Use when the user asks to install kinetic-toast, add the shadcn registry item, wire up Toaster, call kinetic.success/error/promise/action, configure styles, or troubleshoot setup.
---

# Kinetic Toast setup

Kinetic Toast can be installed either from npm or from the shadcn/ui registry. Prefer the shadcn registry item for shadcn projects: it installs a Sonner-style `@ui/kinetic-toast.tsx` wrapper plus editable colocated source.

## Choose installation path

1. **shadcn Sonner-style source install (preferred for shadcn projects)**
   - If `components.json` exists, use the current package runner.
   - Run:
     ```bash
     bunx --bun shadcn@latest add https://raw.githubusercontent.com/feldrok/kinetic-toast/main/public/r/kinetic-toast.json
     ```
   - If the project uses npm/pnpm/yarn, substitute `npx shadcn@latest`, `pnpm dlx shadcn@latest`, or `yarn dlx shadcn@latest`.
   - Import from the generated shadcn UI target, usually:
     ```tsx
     import { Toaster, kinetic } from "@/components/ui/kinetic-toast"
     ```
   - The wrapper imports colocated CSS for the common Sonner-like setup.

2. **npm package install**
   - Use after `kinetic-toast` is published to npm.
   - Install `kinetic-toast`.
   - Import CSS once in the app shell/global entry:
     ```tsx
     import "kinetic-toast/styles.css"
     import { Toaster, kinetic } from "kinetic-toast"
     ```

## Wire it up

Render one `<Toaster />` in a persistent client app shell/root layout/provider.

```tsx
<Toaster position="top-right" theme="system" closeButton navigation />
```

Then call from client code:

```tsx
kinetic.success({ title: "Saved", description: "Your changes are live." })
kinetic.error({ title: "Failed", description: "Try again." })
kinetic.info({ title: "Heads up" })
kinetic.action({
  title: "Undo?",
  description: "The item was archived.",
  button: { title: "Undo", onClick: () => {} },
})

await kinetic.promise(save(), {
  loading: { title: "Saving" },
  success: { title: "Saved" },
  error: { title: "Could not save" },
})
```

## Framework notes

- Components that call `kinetic.*` must be client components in React Server Component frameworks.
- For the registry item, the generated `@ui/kinetic-toast.tsx` wrapper imports colocated CSS from `@ui/kinetic-toast/styles.css`.
- The wrapper maps shadcn tokens (`--popover`, `--popover-foreground`) onto `--kinetic-toast-fill` / `--kinetic-toast-fg` / `--kinetic-toast-fg-muted`. Whatever toggles `.dark` on `html` or `body` (next-themes, Tailwind class mode, vanilla state) flips the toast surface — no JS theme dep required. If the host has no `--popover` token, kinetic's own `:root` / `.dark` defaults take over via `var(--popover, var(--_kinetic-toast-fill-default))` fallbacks. Theme tokens must live on `html` or `body`; the toast portals to `document.body`, so a section-scoped `.dark` deep in the page won't reach it. Passing an explicit `theme` prop on `<Toaster>` makes the wrapper step out of the way and the prop win.
- If a Next.js Pages Router app rejects first-party global CSS outside `_app`, move the wrapper CSS import to `pages/_app.tsx`.
- Keep `<Toaster />` mounted once; duplicate toasters can duplicate timers/state.
- If TypeScript aliases differ, never hardcode paths. Read `components.json` or run `shadcn info --json` and use the configured UI alias.

## Options

Common `Toaster` props:
- `position`: `top-left | top-center | top-right | bottom-left | bottom-center | bottom-right`
- `theme`: `light | dark | system`
- `closeButton`: show dismiss controls
- `navigation`: enable stack navigation
- `maxAge`: wall-clock cap on how long toasts stay in the `<` `>` history (default 60000ms, `null` to disable)
- `options`: default toast options

Common toast options:
- `title`, `description`, `type`, `duration`, `maxAge`, `position`, `icon`, `fill`, `roundness`, `autopilot`, `button`, `styles`
- `maxAge` is independent of `duration` and ignores hover-pause; pass `null` to keep an individual toast pinned indefinitely. `kinetic.promise` loading state passes `maxAge: null` automatically.

## Verification

After setup, verify:
1. `motion` is installed.
2. The generated `components/ui/kinetic-toast.tsx` wrapper and `components/ui/kinetic-toast/` source directory exist.
3. A single `<Toaster />` is rendered in a client boundary.
4. Triggering `kinetic.success({ title: "Hello" })` displays a toast.
