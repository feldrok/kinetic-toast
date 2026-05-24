# React adapter performance policy

Kinetic Toast is moving toward a framework-neutral core with separate framework adapters. This document defines how the React adapter should use manual memoization in a React Compiler era while still supporting React 18+ applications that do not compile library or app code with React Compiler.

## Decision

Do not optimize the framework-neutral core around React-specific memoization. The core should expose small, stable snapshots and pure helpers. React-specific memoization belongs only in the React adapter.

In the React adapter, prefer structural performance first:

1. Keep state ownership narrow.
2. Keep transient values in refs when they do not need to render.
3. Derive cheap values directly during render.
4. Avoid creating large objects or arrays repeatedly when a better data model avoids it.
5. Use manual memoization only where it protects a real boundary or avoids meaningful work.

## React Compiler stance

React Compiler can automatically memoize values, functions, and components in apps that enable it. React's docs describe this as reducing the need for manual `useMemo`, `useCallback`, and `memo` calls.

However, Kinetic Toast is an open-source package. Consumers may use React 18, may not enable React Compiler, or may consume prebuilt package output that is not compiled as part of their app. The React adapter should therefore have good baseline behavior without depending on compiler optimization.

## When to use manual memoization

Manual memoization is appropriate when it has a clear purpose:

- Stabilizing props passed into a `memo`-wrapped component boundary.
- Stabilizing callbacks used by subscriptions, event listener setup, timers, or external APIs.
- Caching calculations that are measurably expensive or grow with toast count.
- Avoiding unnecessary animation target churn when object identity affects child rendering.
- Preserving correctness for hook dependencies where a stable reference is required.

Manual memoization should be avoided when it only wraps trivial work:

- Simple booleans or primitive expressions.
- Small string/number calculations.
- Tiny array operations unless profiling shows churn matters.
- Values that are not passed to memoized children, subscriptions, or effects.

## Current adapter guidance

The React adapter can keep targeted memoization around animation and child boundaries, such as stable animation target objects passed into Motion components or stable handlers passed to toast items.

For viewport derivation and stack navigation, prefer a clear render model first. A pure helper that groups toasts by position and computes selected/live/display state is better than scattering repeated filters through JSX. Memoize that helper's output only if profiling shows it matters or if it feeds memoized children that rely on stable identity.

## Framework-neutral core guidance

The core should not import React or expose React concepts such as:

- `useMemo`
- `useCallback`
- `memo`
- `ReactNode`
- JSX components
- React Compiler directives

Instead, the core should provide:

- A subscription API.
- Immutable-ish snapshots.
- Pure state transition helpers.
- Framework-neutral option and toast record types.

Adapters can then decide how to connect those primitives to their rendering model.

## Practical review checklist

When reviewing React adapter performance changes, ask:

1. Is this optimization for core behavior or React rendering? If it is React rendering, keep it in the React adapter.
2. Does this `useMemo` or `useCallback` protect a real boundary, or is it just wrapping cheap work?
3. Would a cleaner data model remove the need for memoization?
4. Does this still perform acceptably for React 18 consumers without React Compiler?
5. Does this make future Vue or vanilla adapters harder to implement?

## References

- React `useMemo` reference: https://react.dev/reference/react/useMemo
- React `useCallback` reference: https://react.dev/reference/react/useCallback
- React `memo` reference: https://react.dev/reference/react/memo
- React Compiler introduction: https://react.dev/learn/react-compiler/introduction
