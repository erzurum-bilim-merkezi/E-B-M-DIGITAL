import type { ReactNode } from 'react'

import { newItemId, type MediaRef, type StepOf } from '@/entities/kit'

import { fieldId } from '../field-id'
import { ItemListEditor, NumberField, StringListField, TextField } from '../fields'
import { useEditorServices } from '../editor-services'
import { blankItemError, itemName } from './list-items'
import type { BlockEditorProps } from './types'

type ExperimentItem = StepOf<'experiment'>['steps'][number]

function withImage(item: ExperimentItem, image: MediaRef | undefined): ExperimentItem {
  if (image) return { ...item, image }
  const copy = { ...item }
  delete copy.image
  return copy
}

/** A titled group inside the card — a heading to navigate by, not a landmark region. */
function EditorSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function ExperimentEditor({ step, onChange, issueFor }: BlockEditorProps<'experiment'>) {
  const { ImageField } = useEditorServices()
  const stepsIssue = issueFor('steps')

  return (
    <div className="flex flex-col gap-5">
      <EditorSection
        title="Hazırlık"
        description="Deneye başlamadan önce malzemeler ve güvenlik notları gösterilir."
      >
        <StringListField
          id={fieldId(step.id, 'materials')}
          label="Malzemeler"
          values={step.materials}
          onChange={(materials) => onChange({ ...step, materials })}
          max={15}
          maxLength={60}
          placeholder="ör. Şeffaf bardak"
          addLabel="Malzeme ekle"
          error={issueFor('materials')}
        />
        <StringListField
          id={fieldId(step.id, 'safety')}
          label="Güvenlik notları"
          values={step.safety}
          onChange={(safety) => onChange({ ...step, safety })}
          max={8}
          maxLength={120}
          placeholder="ör. Deneyi bir yetişkinle yap."
          addLabel="Güvenlik notu ekle"
          error={issueFor('safety')}
        />
      </EditorSection>

      <EditorSection
        title="Deney"
        description="Adımlar tek tek gösterilir; son adımdan sonra gözlem sorusu sorulur."
      >
        <ItemListEditor
          id={fieldId(step.id, 'steps')}
          label="Deney adımları"
          description="Sayaç çocuğu bekletmez; süreyi gösterip isterse beklemesine izin verir."
          items={step.steps}
          onChange={(steps) => onChange({ ...step, steps })}
          min={1}
          max={10}
          create={(): ExperimentItem => ({ id: newItemId('e'), text: '', timerSec: 0 })}
          addLabel="Adım ekle"
          error={stepsIssue}
          itemLabel={(item, index) => itemName(item.text, `Adım ${index + 1}`, 32)}
          renderItem={(item, update) => (
            <div className="flex flex-col gap-4">
              <TextField
                id={fieldId(step.id, `steps-${item.id}-text`)}
                label="Adım metni"
                value={item.text}
                onChange={(text) => update({ ...item, text })}
                max={200}
                multiline
                rows={2}
                required
                error={blankItemError(stepsIssue, item.text, 'Adım metni gerekli.')}
                placeholder="ör. Bardağa su doldur ve birkaç damla boya ekle."
              />
              <NumberField
                label="Sayaç"
                value={item.timerSec}
                onChange={(timerSec) => update({ ...item, timerSec })}
                min={0}
                max={600}
                suffix="saniye"
                description="0 = sayaç yok"
              />
              <ImageField
                id={fieldId(step.id, `steps-${item.id}-image`)}
                label="Adım görseli (isteğe bağlı)"
                value={item.image}
                onChange={(image) => update(withImage(item, image))}
              />
            </div>
          )}
        />
        <TextField
          id={fieldId(step.id, 'observationPrompt')}
          label="Gözlem sorusu"
          value={step.observationPrompt}
          onChange={(observationPrompt) => onChange({ ...step, observationPrompt })}
          max={200}
          multiline
          rows={2}
          placeholder="ör. Boyalı su yapraklara kadar çıktı mı? Neden?"
          description="Son adım bitince konuşma balonunda sorulur."
        />
      </EditorSection>
    </div>
  )
}
