import { ArrowDown, ArrowUp, Bold, Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'

import { CARD_COLORS, type CardColor } from '@/entities/kit'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { cn } from '@/shared/lib/cn'
import { handleRovingKeys, rovingTabIndex } from '@/shared/lib/roving-focus'
import {
  Button,
  CharCount,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Switch,
  Textarea,
} from '@/shared/ui'

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  max: number
  description?: string
  error?: string | undefined
  required?: boolean
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
}

export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  description,
  error,
  required,
  placeholder,
  multiline,
  rows = 3,
  className,
}: TextFieldProps) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      required={required}
      aside={<CharCount value={value} max={max} />}
      className={className}
    >
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          maxLength={max}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

/** Plain textarea + "Kalın" button: the only markup content supports is `**bold**` + newlines. */
export function RichTextField({
  id,
  label,
  value,
  onChange,
  max,
  description,
  error,
  required,
  rows = 4,
}: Omit<TextFieldProps, 'multiline'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const bold = () => {
    const element = ref.current
    if (!element) return
    const { selectionStart: start, selectionEnd: end } = element
    const selected = value.slice(start, end) || 'kalın metin'
    const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`
    if (next.length > max) return
    onChange(next)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + 2, start + 2 + selected.length)
    })
  }
  const help = description ?? '**kalın** vurgu ve satır sonu kullanılabilir.'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
        <CharCount value={value} max={max} />
      </div>
      <p id={`${id}-description`} className="-mt-0.5 text-xs text-fg-muted">
        {help}
      </p>
      <div
        className={cn(
          'rounded-md bg-surface shadow-xs ring-1 ring-control-border ring-inset focus-within:ring-2 focus-within:ring-ring',
          error && 'ring-2 ring-danger',
        )}
      >
        <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
          <Button variant="ghost" size="icon-sm" aria-label="Seçili metni kalın yap" onClick={bold}>
            <Bold aria-hidden="true" />
          </Button>
        </div>
        <textarea
          ref={ref}
          id={id}
          value={value}
          rows={rows}
          maxLength={max}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-description${error ? ` ${id}-error` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          className="block w-full resize-y rounded-b-md bg-transparent px-3 py-2 text-sm leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const QUICK_EMOJIS = [
  '🌱',
  '🌿',
  '🥬',
  '🌰',
  '🌻',
  '🌸',
  '🌳',
  '🍎',
  '🥕',
  '🌾',
  '☀️',
  '🌙',
  '⭐',
  '🪐',
  '🚀',
  '🌍',
  '💧',
  '🌧️',
  '❄️',
  '🌬️',
  '🌡️',
  '🔥',
  '⚡',
  '🔋',
  '💡',
  '🧲',
  '🔬',
  '🧪',
  '⚗️',
  '🔭',
  '🧬',
  '🧠',
  '❤️',
  '👁️',
  '👂',
  '✋',
  '🦴',
  '🐝',
  '🦋',
  '🐞',
  '🐟',
  '🐦',
  '🐾',
  '🥚',
  '🏡',
  '🎵',
  '🎨',
  '🧩',
  '❓',
  '✅',
  '🎉',
  '🏅',
  '🏆',
  '📘',
  '🔢',
  '🔗',
  '⚖️',
  '🎬',
  '👆',
  '👀',
  '🤔',
  '😄',
  '🧑‍🌾',
  '🧑‍🔬',
] as const

export function EmojiField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          maxLength={16}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value.trim())}
          className="w-24 text-center text-lg"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" aria-label={`${label}: emoji seç`}>
              Seç
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <div
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- emoji grid picker: native <select>/<datalist> cannot render a grid of emoji buttons
              role="listbox"
              tabIndex={-1}
              aria-label="Emojiler"
              className="grid grid-cols-8 gap-1"
              onKeyDown={(event) => handleRovingKeys(event, { selector: '[role="option"]' })}
            >
              {QUICK_EMOJIS.map((emoji, index) => (
                <button
                  key={emoji}
                  type="button"
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- option of the emoji grid listbox above
                  role="option"
                  aria-selected={value === emoji}
                  tabIndex={rovingTabIndex(
                    index,
                    QUICK_EMOJIS.findIndex((candidate) => candidate === value),
                  )}
                  onClick={() => onChange(emoji)}
                  className={cn(
                    'grid size-8 place-items-center rounded-md text-lg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-ring',
                    value === emoji && 'bg-primary-subtle',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const CARD_COLOR_LABELS: Record<CardColor, string> = {
  green: 'Yeşil',
  lime: 'Açık yeşil',
  orange: 'Turuncu',
  yellow: 'Sarı',
  sky: 'Mavi',
  purple: 'Mor',
  pink: 'Pembe',
  indigo: 'Çivit',
}

/** Card color swatches (the Kâşif card palette, AA with its text color). */
export function CardColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: CardColor
  onChange: (value: CardColor) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      <div className="kasif-swatches flex flex-wrap gap-2">
        {CARD_COLORS.map((color) => (
          <label key={color} className="relative cursor-pointer" title={CARD_COLOR_LABELS[color]}>
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="peer sr-only"
            />
            <span
              data-card-color={color}
              className="kid-color-card block size-8 rounded-full shadow-none ring-2 ring-transparent ring-offset-2 ring-offset-surface peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring"
            />
            <span className="sr-only">{CARD_COLOR_LABELS[color]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className="text-xs text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={description ? `${id}-description` : undefined}
      />
    </div>
  )
}

/** Integer input with an optional unit. Its id comes from `Field` (render-prop mode). */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  description,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  description?: string
  suffix?: string
}) {
  // The input is wrapped with its unit, so Field hands its label/description wiring to the input
  // itself; the unit ("dk", "sn") joins the description so screen readers announce it too.
  return (
    <Field label={label} description={description}>
      {(control) => {
        const suffixId = suffix ? `${control.id}-suffix` : undefined
        const describedBy =
          [control['aria-describedby'], suffixId].filter(Boolean).join(' ') || undefined
        return (
          <div className="flex items-center gap-2">
            <Input
              {...control}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={value}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))))
              }}
              className="w-24 tabular"
            />
            {suffix && (
              <span id={suffixId} className="text-sm text-fg-muted">
                {suffix}
              </span>
            )}
          </div>
        )
      }}
    </Field>
  )
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  description,
}: {
  id: string
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  description?: string
}) {
  return (
    <Field label={label} description={description}>
      <Select
        id={id}
        value={value}
        onChange={(event) => {
          const option = options.find((candidate) => candidate.value === event.target.value)
          if (option) onChange(option.value)
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}

const NBSP = String.fromCharCode(0xa0)

function move<T>(items: readonly T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

type ItemKeys<T> = { items: readonly T[]; keys: readonly string[]; next: number }

function hasStringId(item: unknown): item is { id: string } {
  return typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string'
}

/**
 * React keys for list items. Items with an `id` use it; others (plain strings) get generated
 * keys that follow them through the moves, edits and deletes made in the editor. A list replaced
 * from outside reuses the keys of identical items, in order, and new items get fresh keys.
 */
function trackItemKeys<T>(previous: ItemKeys<T>, items: readonly T[]): ItemKeys<T> {
  const pool = previous.items.map((item, index) => ({ item, key: previous.keys[index] }))
  let next = previous.next
  const keys = items.map((item) => {
    if (hasStringId(item)) return item.id
    const match = pool.findIndex((entry) => Object.is(entry.item, item))
    const reused = match === -1 ? undefined : pool.splice(match, 1)[0]?.key
    if (reused !== undefined) return reused
    next += 1
    return `item-${next}`
  })
  return { items, keys, next }
}

/**
 * Generic array editor (options, stages, pairs …): add/remove/reorder with keyboard-friendly
 * buttons and the schema's min/max limits.
 */
export function ItemListEditor<T>({
  id,
  label,
  description,
  items,
  onChange,
  min = 0,
  max,
  create,
  itemLabel,
  renderItem,
  addLabel = 'Ekle',
  error,
}: {
  id: string
  label: string
  description?: string
  items: readonly T[]
  onChange: (items: T[]) => void
  min?: number
  max: number
  create: () => T
  itemLabel: (item: T, index: number) => string
  renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode
  addLabel?: string
  error?: string | undefined
}) {
  // Stable keys: an item's fields (and their local state) move and disappear with the item.
  const [trackedKeys, setTrackedKeys] = useState(() =>
    trackItemKeys<T>({ items: [], keys: [], next: 0 }, items),
  )
  let itemKeys = trackedKeys
  if (trackedKeys.items !== items) {
    // Items replaced from outside (undo, AI, import): adjust while rendering, not in an effect.
    itemKeys = trackItemKeys(trackedKeys, items)
    setTrackedKeys(itemKeys)
  }
  const rows = items.map((item, index) => ({
    item,
    key: hasStringId(item) ? item.id : (itemKeys.keys[index] ?? `item-${itemKeys.next + index}`),
  }))

  const commit = (nextItems: T[], keys: readonly string[], next = itemKeys.next) => {
    setTrackedKeys({ items: nextItems, keys, next })
    onChange(nextItems)
  }

  // Moves and deletes re-render the list: keep focus on a control and say what happened
  // (WCAG 2.4.3, 4.1.3).
  const focusAfterUpdate = useFocusAfterUpdate()
  const addButton = useRef<HTMLButtonElement>(null)
  const [announcement, setAnnouncement] = useState('')
  /** Polite live region; a repeated message still changes the text, so it is read again. */
  const announce = (message: string) =>
    setAnnouncement((previous) => (previous === message ? message + NBSP : message))
  const rowId = (key: string, part: 'title' | 'delete') => `${id}-${key}-${part}`
  const canRemove = items.length > min

  const moveItem = (index: number, to: number, pressed: HTMLElement) => {
    const item = items[index]
    if (item === undefined) return
    const name = itemLabel(item, index)
    if (to < 0) {
      announce(`“${name}” zaten ilk sırada.`)
      return
    }
    if (to >= items.length) {
      announce(`“${name}” zaten son sırada.`)
      return
    }
    // The row moves in the DOM, which drops focus: keep it on the arrow just pressed.
    focusAfterUpdate(() => pressed)
    commit(move(items, index, to), move(itemKeys.keys, index, to))
    announce(`“${name}” ${to + 1}. sıraya taşındı.`)
  }

  const removeItem = (index: number) => {
    const item = items[index]
    if (item === undefined || !canRemove) return
    const name = itemLabel(item, index)
    // Focus goes to the next row's delete button, else the previous one's, else "add".
    const neighbour = rows[index + 1] ?? rows[index - 1]
    focusAfterUpdate(() =>
      neighbour ? document.getElementById(rowId(neighbour.key, 'delete')) : addButton.current,
    )
    commit(
      items.filter((_, itemIndex) => itemIndex !== index),
      itemKeys.keys.filter((_, keyIndex) => keyIndex !== index),
    )
    announce(`“${name}” silindi.`)
  }

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-3 outline-none"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2 text-sm font-medium text-fg">
        <span>{label}</span>
        <span className="text-xs font-normal text-fg-subtle tabular">
          {items.length} / {max}
        </span>
      </legend>
      {description && <p className="-mt-2 text-xs text-fg-muted">{description}</p>}
      <ol className="flex flex-col gap-3">
        {rows.map(({ item, key }, index) => {
          const name = itemLabel(item, index)
          const first = index === 0
          const last = index === items.length - 1
          return (
            <li key={key} className="rounded-lg border border-border bg-surface-muted/40 p-3">
              {/* A group per row, so its fields are heard with the row's name ("2. Tohum").
                  Named by the title span, not a <legend>: the title shares a line with its
                  buttons. Inside the <li>, so the list keeps its listitem semantics. */}
              <fieldset aria-labelledby={rowId(key, 'title')} className="min-w-0">
                <div className="mb-2 flex items-center gap-1">
                  <span
                    id={rowId(key, 'title')}
                    className="flex-1 truncate text-xs font-medium text-fg-muted"
                  >
                    {index + 1}. {name}
                  </span>
                  {/* aria-disabled, not disabled: an arrow just pressed keeps focus at the ends. */}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${name} yukarı taşı`}
                    aria-disabled={first || undefined}
                    onClick={(event) => moveItem(index, index - 1, event.currentTarget)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${name} aşağı taşı`}
                    aria-disabled={last || undefined}
                    onClick={(event) => moveItem(index, index + 1, event.currentTarget)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  {/* aria-disabled too: focus may land here after a delete that reaches `min`. */}
                  <Button
                    id={rowId(key, 'delete')}
                    variant="danger-ghost"
                    size="icon-sm"
                    aria-label={`${name} sil`}
                    aria-disabled={!canRemove || undefined}
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                {renderItem(
                  item,
                  (next) =>
                    commit(
                      items.map((existing, itemIndex) => (itemIndex === index ? next : existing)),
                      itemKeys.keys,
                    ),
                  index,
                )}
              </fieldset>
            </li>
          )
        })}
      </ol>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <Button
        ref={addButton}
        variant="secondary"
        size="sm"
        className="self-start"
        leadingIcon={<Plus aria-hidden="true" />}
        disabled={items.length >= max}
        onClick={() => {
          const next = itemKeys.next + 1
          commit([...items, create()], [...itemKeys.keys, `item-${next}`], next)
        }}
      >
        {addLabel}
      </Button>
      <output className="sr-only">{announcement}</output>
    </fieldset>
  )
}

/** List of short strings (objectives, materials, safety notes). */
export function StringListField({
  id,
  label,
  values,
  onChange,
  max,
  maxLength,
  placeholder,
  addLabel,
  error,
}: {
  id: string
  label: string
  values: readonly string[]
  onChange: (values: string[]) => void
  max: number
  maxLength: number
  placeholder?: string
  addLabel: string
  /** Publish issue of the list; blank lines are then marked invalid and point at it. */
  error?: string | undefined
}) {
  return (
    <ItemListEditor
      id={id}
      label={label}
      items={values}
      onChange={onChange}
      max={max}
      create={() => ''}
      addLabel={addLabel}
      error={error}
      itemLabel={(value, index) => value.trim() || `${index + 1}. satır`}
      renderItem={(value, update, index) => {
        const invalid = Boolean(error) && !value.trim()
        return (
          <Input
            aria-label={`${label} ${index + 1}`}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => update(event.target.value)}
          />
        )
      }}
    />
  )
}
