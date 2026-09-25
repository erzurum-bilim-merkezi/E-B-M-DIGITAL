import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Upload, X } from 'lucide-react'
import { useState } from 'react'

import type { MediaRef } from '@/entities/kit'
import type { MediaAsset, MediaKind } from '@/entities/studio'
import { Button, Dialog, DialogContent } from '@/shared/ui'

import { mediaManyQueryOptions } from '../api/queries'
import { AssetThumb, MediaLibrary, UploadDialog } from './MediaLibrary'

type MediaFieldProps = {
  id: string
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}

function toRef(asset: MediaAsset): MediaRef {
  return { assetId: asset.id, alt: asset.alt }
}

function MediaField({
  id,
  label,
  value,
  onChange,
  kinds,
  accept,
  admin = false,
}: MediaFieldProps & {
  kinds: readonly MediaKind[]
  accept: 'image' | 'audio' | 'captions'
  admin?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const selected = useQuery(mediaManyQueryOptions(value ? [value.assetId] : []))
  const asset = selected.data?.find((candidate) => candidate.id === value?.assetId)

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-fg">
        {label}
      </span>
      <div
        id={id}
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {asset ? (
          <>
            <AssetThumb asset={asset} className="size-14 shrink-0 rounded-md" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{asset.name}</span>
              <span className="truncate text-xs text-fg-muted">{asset.alt}</span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${label}: kaldır`}
              onClick={() => onChange(undefined)}
            >
              <X aria-hidden="true" />
            </Button>
          </>
        ) : (
          <span className="flex-1 px-1 text-sm text-fg-subtle">
            {value ? 'Dosya bulunamadı' : 'Seçilmedi'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<FolderOpen aria-hidden="true" />}
          onClick={() => setPickerOpen(true)}
        >
          Kütüphaneden seç
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Upload aria-hidden="true" />}
          onClick={() => setUploadOpen(true)}
        >
          Yükle
        </Button>
      </div>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent title={`${label} seç`} size="xl">
          <MediaLibrary
            admin={admin}
            kinds={kinds}
            onPick={(picked) => {
              onChange(toRef(picked))
              setPickerOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        accept={accept}
        onUploaded={(uploaded) => onChange(toRef(uploaded))}
      />
    </div>
  )
}

export function ImageField(props: MediaFieldProps) {
  return <MediaField {...props} kinds={['image', 'ai-scene', 'icon']} accept="image" />
}

export function AudioField(props: MediaFieldProps) {
  return <MediaField {...props} kinds={['audio']} accept="audio" />
}

export function CaptionsField(props: MediaFieldProps) {
  return <MediaField {...props} kinds={['captions']} accept="captions" />
}
