# Performance harnesses

These harnesses are manual profiling targets for local development. They are intentionally small and dependency-light so adapter-specific scenarios can share the same test ideas.

## React stress harness

Build the package, serve the repository root, then open the React stress page:

```bash
bun run build
python3 -m http.server 4173
open http://localhost:4173/benchmarks/react-stress.html
```

Use browser performance tools to compare:

- burst rendering with many toasts
- promise state transitions
- navigation stack behavior
- close/clear behavior
- default visual effects vs. `performanceMode: "minimal"`

Future Vue and vanilla harnesses should reuse the same scenarios so adapter overhead and shared runtime behavior can be compared consistently.
