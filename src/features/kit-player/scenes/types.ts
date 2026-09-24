/** Props every library scene receives from the kit player (states: see `SCENE_CATALOG`). */
export type SceneProps = {
  /** One of the scene's states from SCENE_CATALOG (emoji-stage accepts any state). */
  state: string
  /** WCAG 2.2.2 pause or kit motion "minimal": render the static frame, no animation. */
  paused: boolean
  /** OS/explorer reduced motion: no looping or entrance animation (state changes may still cross-fade instantly). */
  reducedMotion: boolean
  /** Accessible name (the card title). */
  title: string
  /** emoji-stage: the emoji to show big (stage emoji or card icon). */
  emoji?: string
  className?: string
}
