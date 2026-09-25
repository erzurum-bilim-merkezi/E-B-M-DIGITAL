import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  emojiSchema,
  LIBRARY_ICON_META,
  searchLibraryIcons,
  type CardColor,
  type KitIcon as KitIconValue,
} from '@/entities/kit'
import { AiIconGenerator, useAiEnabled } from '@/features/ai-studio'
import { KitIcon } from '@/features/kit-player'
import { mediaManyQueryOptions, prepareAndUpload } from '@/features/media-library'
import { errorMessage } from '@/shared/api/errors'
import { cn } from '@/shared/lib/cn'
import { handleRovingKeys, rovingTabIndex } from '@/shared/lib/roving-focus'
import {
  Alert,
  Button,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui'

const EMOJI_SETS: { label: string; keywords: string; emojis: readonly string[] }[] = [
  {
    label: 'Bitkiler',
    keywords: 'bitki tohum çiçek ağaç yaprak marul sebze meyve',
    emojis: [
      '🌱',
      '🌿',
      '🍀',
      '🌾',
      '🌻',
      '🌸',
      '🌷',
      '🌳',
      '🌲',
      '🍃',
      '🥬',
      '🥕',
      '🌽',
      '🍎',
      '🍓',
      '🌰',
      '🍄',
      '🪴',
    ],
  },
  {
    label: 'Hava ve su',
    keywords: 'hava su güneş yağmur kar bulut rüzgar sıcaklık',
    emojis: ['☀️', '🌤️', '☁️', '🌧️', '⛈️', '❄️', '🌬️', '💧', '🌊', '🌡️', '🔥', '🌈', '🌙', '⭐'],
  },
  {
    label: 'Uzay',
    keywords: 'uzay gezegen yıldız roket dünya ay astronot güneş mars galaksi',
    emojis: [
      '🚀',
      '🪐',
      '🌍',
      '🌎',
      '🌕',
      '🌙',
      '🌑',
      '☀️',
      '🔴',
      '⭐',
      '🌟',
      '☄️',
      '🌌',
      '🛰️',
      '🔭',
      '👩‍🚀',
      '🧑‍🚀',
      '👽',
      '✨',
    ],
  },
  {
    label: 'Bilim',
    keywords: 'bilim deney mikroskop mıknatıs elektrik atom dna',
    emojis: [
      '🔬',
      '🧪',
      '⚗️',
      '🧫',
      '🧬',
      '⚛️',
      '🧲',
      '⚡',
      '🔋',
      '💡',
      '🔌',
      '⚙️',
      '🤖',
      '🧠',
      '🦴',
      '❤️',
      '👁️',
      '👂',
    ],
  },
  {
    label: 'Hayvanlar',
    keywords: 'hayvan böcek arı kelebek kuş balık',
    emojis: ['🐝', '🦋', '🐞', '🐛', '🐜', '🐟', '🐠', '🐢', '🐦', '🦉', '🐸', '🐾', '🥚', '🐄'],
  },
  {
    label: 'Oyun',
    keywords: 'oyun soru kupa rozet müzik sanat',
    emojis: [
      '❓',
      '💭',
      '🎯',
      '🧩',
      '🎲',
      '🎨',
      '🎵',
      '🏆',
      '🏅',
      '🎉',
      '👆',
      '👀',
      '🤔',
      '😄',
      '🔢',
      '🔗',
    ],
  },
]

/** A single emoji (pictographic, no spaces) — the schema alone would also accept plain words. */
function isSingleEmoji(value: string) {
  return emojiSchema.safeParse(value).success && /\p{Extended_Pictographic}/u.test(value)
}

/** Any emoji the sets lack (🔴, 💍 …), typed or pasted from the system emoji keyboard. */
function CustomEmojiField({ onPick }: { onPick: (emoji: string) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    const emoji = text.trim()
    if (!isSingleEmoji(emoji)) {
      setError('Tek bir emoji yazın ya da yapıştırın.')
      return
    }
    onPick(emoji)
  }
  return (
    <Field label="Başka bir emoji" error={error ?? undefined}>
      {(control) => (
        <div className="flex gap-2">
          <Input
            {...control}
            value={text}
            maxLength={16}
            placeholder="ör. 💍"
            className="w-24 text-center text-lg"
            onChange={(event) => {
              setText(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              // The picker sits inside the editor: Enter must not submit an outer form.
              if (event.key !== 'Enter') return
              event.preventDefault()
              apply()
            }}
          />
          <Button variant="secondary" onClick={apply}>
            Kullan
          </Button>
        </div>
      )}
    </Field>
  )
}

type IconPickerFieldProps = {
  id: string
  label: string
  value: KitIconValue
  onChange: (icon: KitIconValue) => void
  tint?: CardColor | undefined
}

/** Card/kit icon picker (F7.5): emoji · science icons · upload (square crop) · AI. */
export function IconPickerField({ id, label, value, onChange, tint }: IconPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const aiEnabled = useAiEnabled()
  const mediaAsset = useQuery(
    mediaManyQueryOptions(value.kind === 'media' ? [value.media.assetId] : []),
  )
  const resolvedValue: KitIconValue =
    value.kind === 'media'
      ? {
          kind: 'media',
          media: {
            ...value.media,
            ...(mediaAsset.data?.[0] ? { url: mediaAsset.data[0].url } : {}),
          },
        }
      : value

  const needle = query.trim().toLocaleLowerCase('tr')
  const emojiSets = useMemo(
    () =>
      needle
        ? EMOJI_SETS.filter(
            (set) =>
              set.label.toLocaleLowerCase('tr').includes(needle) || set.keywords.includes(needle),
          )
        : EMOJI_SETS,
    [needle],
  )
  const icons = useMemo(() => searchLibraryIcons(query), [query])

  const pick = (icon: KitIconValue) => {
    onChange(icon)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-current`}
            className="flex h-12 items-center gap-3 rounded-md bg-surface px-3 text-left shadow-xs ring-1 ring-control-border ring-inset hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span
              data-card-color={tint}
              className={cn(
                'grid size-8 place-items-center rounded-lg text-lg',
                tint ? 'kid-color-card shadow-none' : 'bg-surface-muted',
              )}
            >
              <KitIcon icon={resolvedValue} />
            </span>
            <span id={`${id}-current`} className="flex-1 truncate text-sm text-fg-muted">
              {value.kind === 'emoji'
                ? `Emoji ${value.value}`
                : value.kind === 'library'
                  ? `Bilim ikonu: ${LIBRARY_ICON_META[value.id].label}`
                  : 'Yüklenen ikon'}
            </span>
            <span className="text-xs font-medium text-link">Değiştir</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,26rem)] p-0">
          <Tabs defaultValue="emoji">
            <div className="flex flex-col gap-2 border-b border-border p-3 pb-0">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
                />
                <Input
                  aria-label="İkon ara"
                  placeholder="Ara: tohum, mıknatıs, uzay…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                />
              </div>
              <TabsList aria-label="İkon türü" className="border-b-0">
                <TabsTrigger value="emoji">Emoji</TabsTrigger>
                <TabsTrigger value="library">Bilim ikonları</TabsTrigger>
                <TabsTrigger value="upload">Yükle</TabsTrigger>
                {aiEnabled && <TabsTrigger value="ai">Yapay zekâ</TabsTrigger>}
              </TabsList>
            </div>
            <TabsContent value="emoji" className="max-h-72 overflow-y-auto p-3">
              {emojiSets.map((set) => (
                <div key={set.label} className="mb-3">
                  <p className="mb-1.5 text-xs font-medium text-fg-subtle">{set.label}</p>
                  <div
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- emoji grid picker: native <select>/<datalist> cannot render a grid of emoji buttons
                    role="listbox"
                    tabIndex={-1}
                    aria-label={set.label}
                    className="grid grid-cols-9 gap-1"
                    onKeyDown={(event) => handleRovingKeys(event, { selector: '[role="option"]' })}
                  >
                    {set.emojis.map((emoji, index) => (
                      <button
                        key={emoji}
                        type="button"
                        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- option of the emoji grid listbox above
                        role="option"
                        aria-selected={value.kind === 'emoji' && value.value === emoji}
                        tabIndex={rovingTabIndex(
                          index,
                          value.kind === 'emoji' ? set.emojis.indexOf(value.value) : -1,
                        )}
                        onClick={() => pick({ kind: 'emoji', value: emoji })}
                        className="grid size-9 place-items-center rounded-md text-xl hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-primary-subtle"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {emojiSets.length === 0 && (
                <p className="mb-3 text-sm text-fg-muted">
                  Eşleşen grup yok. Aşağıya emojiyi yazın ya da “Bilim ikonları” sekmesine bakın.
                </p>
              )}
              <CustomEmojiField onPick={(emoji) => pick({ kind: 'emoji', value: emoji })} />
            </TabsContent>
            <TabsContent value="library" className="max-h-72 overflow-y-auto p-3">
              <div
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- icon grid picker: native <select>/<datalist> cannot render SVG icon buttons
                role="listbox"
                tabIndex={-1}
                aria-label="Bilim ikonları"
                className="grid grid-cols-6 gap-1.5"
                onKeyDown={(event) => handleRovingKeys(event, { selector: '[role="option"]' })}
              >
                {icons.map((iconId, index) => (
                  <button
                    key={iconId}
                    type="button"
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- option of the icon grid listbox above
                    role="option"
                    aria-selected={value.kind === 'library' && value.id === iconId}
                    tabIndex={rovingTabIndex(
                      index,
                      value.kind === 'library' ? icons.indexOf(value.id) : -1,
                    )}
                    title={LIBRARY_ICON_META[iconId].label}
                    onClick={() => pick({ kind: 'library', id: iconId })}
                    data-card-color={tint ?? 'indigo'}
                    className="kid-color-card grid aspect-square place-items-center rounded-lg text-xl shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:ring-2 aria-selected:ring-fg"
                  >
                    <KitIcon
                      icon={{ kind: 'library', id: iconId }}
                      label={LIBRARY_ICON_META[iconId].label}
                    />
                  </button>
                ))}
              </div>
              {icons.length === 0 && <p className="text-sm text-fg-muted">Eşleşen ikon yok.</p>}
            </TabsContent>
            <TabsContent value="upload" className="flex flex-col gap-3 p-3">
              <p className="text-sm text-fg-muted">
                PNG/JPEG/WebP; kare olarak kırpılır ve küçültülür (≤ 200 kB).
              </p>
              {uploadError && <Alert variant="danger">{uploadError}</Alert>}
              <Field label="İkon dosyası">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  className="h-auto py-2"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    setUploading(true)
                    setUploadError(null)
                    void prepareAndUpload({ file, kind: 'icon', alt: label })
                      .then((asset) =>
                        pick({ kind: 'media', media: { assetId: asset.id, alt: asset.alt } }),
                      )
                      .catch((error: unknown) =>
                        setUploadError(
                          error instanceof Error ? error.message : errorMessage(error),
                        ),
                      )
                      .finally(() => setUploading(false))
                  }}
                />
              </Field>
              {uploading && <output className="block text-sm text-fg-muted">Yükleniyor…</output>}
            </TabsContent>
            {aiEnabled && (
              <TabsContent value="ai" className="p-3">
                <AiIconGenerator
                  onPicked={(asset) =>
                    pick({ kind: 'media', media: { assetId: asset.id, alt: asset.alt } })
                  }
                />
              </TabsContent>
            )}
          </Tabs>
          <div className="flex justify-end border-t border-border p-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Kapat
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
