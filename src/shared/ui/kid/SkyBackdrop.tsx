import { cn } from '@/shared/lib/cn'

const STARS = [
  [6, 8, 1.6],
  [14, 22, 1.2],
  [23, 12, 2],
  [31, 30, 1.1],
  [42, 6, 1.4],
  [48, 18, 1],
  [57, 9, 1.8],
  [64, 26, 1.2],
  [71, 14, 1.5],
  [79, 5, 1.1],
  [86, 20, 1.9],
  [93, 11, 1.3],
  [9, 42, 1.1],
  [20, 58, 1.4],
  [37, 48, 1],
  [53, 62, 1.3],
  [68, 44, 1.1],
  [83, 56, 1.5],
  [95, 38, 1],
  [4, 74, 1.2],
  [27, 84, 1.1],
  [61, 80, 1.4],
  [88, 88, 1.2],
] as const

/**
 * Decorative sky behind every Kâşif screen: drifting clouds by day, twinkling stars and a small
 * planet by night. Purely visual (aria-hidden) and paused by the motion settings.
 */
export function SkyBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
    >
      {/* Day: clouds (hidden in dark mode via the kid-night-only/-day-only helpers). */}
      <div className="kid-day-only">
        <div className="kid-ambient absolute top-[6%] left-0 h-10 w-32 [animation:kid-drift_55s_linear_infinite] rounded-full bg-white/75 blur-[1px] before:absolute before:-top-6 before:left-5 before:size-14 before:rounded-full before:bg-white/75 after:absolute after:-top-4 after:left-16 after:size-10 after:rounded-full after:bg-white/75" />
        <div className="kid-ambient absolute top-[16%] left-0 h-8 w-24 [animation:kid-drift_75s_linear_-30s_infinite] rounded-full bg-white/65 blur-[1px] before:absolute before:-top-5 before:left-4 before:size-11 before:rounded-full before:bg-white/65 after:absolute after:-top-3 after:left-12 after:size-8 after:rounded-full after:bg-white/65" />
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-kid-sun/25 blur-3xl" />
      </div>
      {/* Night: stars + planet. */}
      <div className="kid-night-only">
        {STARS.map(([x, y, r], index) => (
          <span
            key={`${x}-${y}`}
            className="kid-ambient absolute [animation:twinkle_5s_ease-in-out_infinite] rounded-full bg-white"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: r * 2,
              height: r * 2,
              animationDelay: `${(index % 7) * 0.7}s`,
              opacity: 0.55 + (index % 4) * 0.1,
            }}
          />
        ))}
        <div className="absolute -right-16 bottom-[12%] size-44 rounded-full bg-[radial-gradient(circle_at_35%_35%,var(--color-kid-teal),var(--color-kid-night)_70%)] opacity-40" />
        <div className="absolute top-[-10%] left-[-10%] size-96 rounded-full bg-kid-primary/25 blur-3xl" />
      </div>
    </div>
  )
}
