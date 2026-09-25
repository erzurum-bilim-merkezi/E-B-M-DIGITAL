import { fieldId } from '../field-id'
import { TextField } from '../fields'
import type { BlockEditorProps } from './types'

/** Texts around the video; the link and captions live in the card's visual area. */
export function VideoEditor({ step, onChange }: BlockEditorProps<'video'>) {
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'caption')}
        label="Video açıklaması"
        value={step.caption}
        onChange={(caption) => onChange({ ...step, caption })}
        max={160}
        multiline
        rows={2}
        placeholder="ör. Kısa bir animasyon film izle."
        description="Videonun altında gösterilir."
      />
      <TextField
        id={fieldId(step.id, 'questionAfter')}
        label="İzledikten sonra sorulacak soru"
        value={step.questionAfter}
        onChange={(questionAfter) => onChange({ ...step, questionAfter })}
        max={160}
        multiline
        rows={2}
        placeholder="ör. Filmde hangi hayvanları gördün?"
        description="Video izlenince konuşma balonunda sorulur."
      />
      <p className="text-xs text-fg-muted">
        Video bağlantısı ve altyazı ayarı “Görsel alan” bölümünde düzenlenir.
      </p>
    </div>
  )
}
