// Custom properties set from components (declaration merging is the one allowed use of
// `interface` in this codebase). A plain `.ts` file is a module under `moduleDetection: force`,
// so this augments React's types instead of replacing them — no `export {}` marker needed.
declare module 'react' {
  interface CSSProperties {
    '--kit-accent-custom'?: string
  }
}
