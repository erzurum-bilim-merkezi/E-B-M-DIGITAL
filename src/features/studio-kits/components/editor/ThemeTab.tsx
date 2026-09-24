import { Check, X } from 'lucide-react'
import { useState } from 'react'

import {
  ACCENT_MIN_CONTRAST,
  contrastRatio,
  isAccentAccessible,
  THEME_PRESET_LABELS,
  THEME_PRESETS,
  type KitDocument,
  type KitTheme,
} from '@/entities/kit'
import { cn } from '@/shared/lib/cn'
import { handleRovingKeys, rovingTabIndex } from '@/shared/lib/roving-focus'
import { Button, Card, CardHeader, Input, RadioGroup, RadioItem } from '@/shared/ui'

import { fieldId } from './field-id'
import { CardColorField, EmojiField, TextField } from './fields'

function ThemePreview({ theme, title, icon }: { theme: KitTheme; title: string; icon: string }) {
  return (
    <div
      className="kasif pointer-events-none overflow-hidden rounded-xl border border-border p-4"
      data-kit-theme={theme.preset}
      data-font={theme.font}
      data-motion={theme.motion}
      style={theme.accent ? { '--kit-accent-custom': theme.accent } : undefined}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          className={cn(
            'text-4xl',
            theme.motion === 'full' && 'kid-ambient [animation:kid-sway_3s_ease-in-out_infinite]',
          )}
        >
          {icon}
        </span>
        <p className="text-xl font-bold">{title || 'Kit adı'}</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <span
            data-card-color="green"
            className="kid-color-card rounded-2xl px-2 py-3 text-sm font-bold"
          >
            🌱 Kart 1
          </span>
          <span
            data-card-color="orange"
            className="kid-color-card rounded-2xl px-2 py-3 text-sm font-bold"
          >
            🏡 Kart 2
          </span>
        </div>
        <span className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-kid-accent text-base font-bold text-kid-accent-fg shadow-kid-3d-accent">
          Sıradaki kart ➜
        </span>
      </div>
    </div>
  )
}

export function ThemeTab({
  draft,
  update,
}: {
  draft: KitDocument
  update: (mutator: (current: KitDocument) => KitDocument) => void
}) {
  const theme = draft.theme
  const [accentInput, setAccentInput] = useState(theme.accent ?? '')
  const setTheme = (patch: Partial<KitTheme>) =>
    update((current) => ({ ...current, theme: { ...current.theme, ...patch } }))
  const hexValid = /^#[0-9a-fA-F]{6}$/.test(accentInput)
  const ratio = hexValid ? contrastRatio('#ffffff', accentInput) : null
  const accessible = hexValid && isAccentAccessible(accentInput)

  const applyAccent = (value: string) => {
    setAccentInput(value)
    // Below AA the color is not saved (F6.8); the preview shows the last accessible accent.
    if (/^#[0-9a-fA-F]{6}$/.test(value) && isAccentAccessible(value))
      setTheme({ accent: value.toLowerCase() })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="Tema"
            description="Gökyüzü tonu ve vurgu rengi. Kart renkleri her temada erişilebilir kalır."
          />
          <div
            role="radiogroup"
            tabIndex={-1}
            aria-label="Tema ön ayarı"
            className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5"
            onKeyDown={(event) =>
              handleRovingKeys(event, { selector: '[role="radio"]', activate: true })
            }
          >
            {THEME_PRESETS.map((preset, index) => (
              <button
                key={preset}
                type="button"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- theme swatch card radio (preview + label); a native radio input cannot hold this content
                role="radio"
                aria-checked={theme.preset === preset}
                tabIndex={rovingTabIndex(index, THEME_PRESETS.indexOf(theme.preset))}
                onClick={() => setTheme({ preset })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  theme.preset === preset
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:border-border-strong',
                )}
              >
                <span
                  className="kasif block h-14 w-full rounded-md"
                  data-kit-theme={preset}
                  aria-hidden="true"
                >
                  <span className="m-2 inline-block size-5 rounded-full bg-kid-accent" />
                </span>
                {THEME_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId('kit', 'theme.accent')} className="text-sm font-medium">
              Vurgu rengi (isteğe bağlı)
            </label>
            <p id="accent-help" className="text-xs text-fg-muted">
              Butonlarda beyaz yazıyla kullanılır; en az {ACCENT_MIN_CONTRAST}:1 kontrast gerekir.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                aria-label="Renk seçici"
                value={hexValid ? accentInput : '#5249d8'}
                onChange={(event) => applyAccent(event.target.value)}
                className="size-10 cursor-pointer rounded-md border border-border bg-surface p-1"
              />
              <Input
                id={fieldId('kit', 'theme.accent')}
                value={accentInput}
                placeholder="#5249D8"
                maxLength={7}
                aria-describedby="accent-help accent-status"
                aria-invalid={accentInput !== '' && !accessible ? true : undefined}
                onChange={(event) => applyAccent(event.target.value.trim())}
                className="w-32 font-mono uppercase"
              />
              {theme.accent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAccentInput('')
                    update((current) => {
                      const { accent: _removed, ...rest } = current.theme
                      return { ...current, theme: rest }
                    })
                  }}
                >
                  Ön ayar rengine dön
                </Button>
              )}
            </div>
            <output
              id="accent-status"
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                accessible ? 'text-success-fg' : 'text-danger-fg',
                !accentInput && 'sr-only',
              )}
            >
              {accentInput &&
                (hexValid ? (
                  accessible ? (
                    <>
                      <Check aria-hidden="true" className="size-3.5" /> Kontrast {ratio?.toFixed(2)}
                      :1 — uygun (AA)
                    </>
                  ) : (
                    <>
                      <X aria-hidden="true" className="size-3.5" /> Kontrast {ratio?.toFixed(2)}:1 —
                      yetersiz; kaydedilmedi
                    </>
                  )
                ) : (
                  'Renk #RRGGBB biçiminde olmalı.'
                ))}
            </output>
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">Yazı tipi</legend>
            <RadioGroup
              value={theme.font}
              onValueChange={(value) =>
                setTheme({ font: value === 'standard' ? 'standard' : 'playful' })
              }
              className="flex flex-col gap-3"
            >
              <RadioItem
                id="font-playful"
                value="playful"
                label="Oyunsu (Fredoka)"
                description="Yuvarlak hatlı, çocuklar için tasarlandı."
              />
              <RadioItem
                id="font-standard"
                value="standard"
                label="Standart"
                description="Cihazın sistem yazı tipi; okuma güçlüğü olanlar için sade."
              />
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">Hareket seviyesi</legend>
            <RadioGroup
              value={theme.motion}
              onValueChange={(value) =>
                setTheme({
                  motion: value === 'calm' ? 'calm' : value === 'minimal' ? 'minimal' : 'full',
                })
              }
              className="flex flex-col gap-3"
            >
              <RadioItem
                id="motion-full"
                value="full"
                label="Tam"
                description="Tüm animasyonlar ve konfeti."
              />
              <RadioItem
                id="motion-calm"
                value="calm"
                label="Sakin"
                description="Arka plandaki sürekli hareketler durur."
              />
              <RadioItem
                id="motion-minimal"
                value="minimal"
                label="Minimal"
                description="Animasyon yok; sahneler durağan kareyle gösterilir."
              />
            </RadioGroup>
          </fieldset>
        </Card>
      </div>
      <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <p className="text-sm font-medium text-fg">Canlı önizleme</p>
        <ThemePreview
          theme={theme}
          title={draft.title}
          icon={draft.icon.kind === 'emoji' ? draft.icon.value : '🧪'}
        />
      </div>
    </div>
  )
}

export function BadgeTab({
  draft,
  update,
  issueFor,
}: {
  draft: KitDocument
  update: (mutator: (current: KitDocument) => KitDocument) => void
  issueFor: (field: string) => string | undefined
}) {
  const badge = draft.badge
  const set = (patch: Partial<KitDocument['badge']>) =>
    update((current) => ({ ...current, badge: { ...current.badge, ...patch } }))
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="flex flex-col gap-5 p-5">
        <TextField
          id={fieldId('kit', 'badge.name')}
          label="Rozet adı"
          value={badge.name}
          onChange={(name) => set({ name })}
          max={30}
          required
          error={issueFor('badge.name')}
          placeholder="ör. Küçük Çiftçi"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <EmojiField
            id={fieldId('kit', 'badge.emoji')}
            label="Rozet simgesi"
            value={badge.emoji}
            onChange={(emoji) => set({ emoji: emoji || '🏅' })}
          />
          <CardColorField
            label="Rozet rengi"
            value={badge.color}
            onChange={(color) => set({ color })}
          />
        </div>
        <TextField
          id={fieldId('kit', 'badge.description')}
          label="Rozet açıklaması"
          value={badge.description}
          onChange={(description) => set({ description })}
          max={120}
          placeholder="Marul serasının tüm sırlarını keşfettin!"
        />
      </Card>
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-fg">Kâşif’te görünümü</p>
        <div
          className="kasif flex flex-col items-center gap-2 rounded-xl border border-border p-6 text-center"
          aria-hidden="true"
        >
          <span
            data-card-color={badge.color}
            className="kid-color-card grid size-24 place-items-center rounded-full text-5xl"
          >
            {badge.emoji}
          </span>
          <p className="text-xl font-bold">{badge.name || 'Rozet adı'}</p>
          <p className="text-sm text-kid-fg-soft">{badge.description}</p>
        </div>
      </div>
    </div>
  )
}
