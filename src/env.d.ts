// Build-time constants injected by vite.config.ts (`define`). Read them
// only through src/shared/qa/config.ts, which guards for their absence
// (unit tests run without Vite's define step).

/** True in the tester build (`pnpm run build`), false in the Chrome Web
 * Store build (`pnpm run build:store`). */
declare const __AIRE_QA__: boolean
/** Short commit SHA of the build, or "local" for a developer's own build. */
declare const __AIRE_BUILD_ID__: string
