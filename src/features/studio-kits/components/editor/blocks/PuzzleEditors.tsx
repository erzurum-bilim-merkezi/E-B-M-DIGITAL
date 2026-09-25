import { newItemId, type StepOf } from '@/entities/kit'

import { fieldId } from '../field-id'
import { ItemListEditor, TextField } from '../fields'
import { BlockEmojiField } from './block-fields'
import { blankItemError, itemName } from './list-items'
import type { BlockEditorProps } from './types'

type SequenceItem = StepOf<'sequence'>['items'][number]
type MatchingPair = StepOf<'matching'>['pairs'][number]

function pairName(pair: MatchingPair, index: number) {
  const left = pair.left.trim()
  const right = pair.right.trim()
  return itemName(left && right ? `${left} → ${right}` : left || right, `Eş ${index + 1}`)
}

export function SequenceEditor({ step, onChange, issueFor }: BlockEditorProps<'sequence'>) {
  const itemsIssue = issueFor('items')
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'prompt')}
        label="Yönerge"
        value={step.prompt}
        onChange={(prompt) => onChange({ ...step, prompt })}
        max={120}
        placeholder="ör. Marulun büyüme evrelerini sıraya diz."
        description="Kartların üstünde gösterilir."
      />
      <ItemListEditor
        id={fieldId(step.id, 'items')}
        label="Sıralama adımları"
        description="Doğru sırayla girin; Kâşif’te karışık gösterilir."
        items={step.items}
        onChange={(items) => onChange({ ...step, items })}
        min={3}
        max={8}
        create={(): SequenceItem => ({ id: newItemId('s'), label: '', icon: '✨' })}
        addLabel="Adım ekle"
        error={itemsIssue}
        itemLabel={(item, index) => itemName(item.label, `Adım ${index + 1}`)}
        renderItem={(item, update) => (
          <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <TextField
              id={fieldId(step.id, `items-${item.id}-label`)}
              label="Adım"
              value={item.label}
              onChange={(label) => update({ ...item, label })}
              max={40}
              required
              error={blankItemError(itemsIssue, item.label, 'Adım adı gerekli.')}
              placeholder="ör. Çimlenme"
            />
            <BlockEmojiField
              id={fieldId(step.id, `items-${item.id}-icon`)}
              value={item.icon}
              onChange={(icon) => update({ ...item, icon })}
            />
          </div>
        )}
      />
      <TextField
        id={fieldId(step.id, 'successMessage')}
        label="Başarı mesajı"
        value={step.successMessage}
        onChange={(successMessage) => onChange({ ...step, successMessage })}
        max={160}
        placeholder="ör. Sıralama doğru! 🎉"
        description="Sıra doğru olunca gösterilir."
      />
    </div>
  )
}

export function MatchingEditor({ step, onChange, issueFor }: BlockEditorProps<'matching'>) {
  const pairsIssue = issueFor('pairs')
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'prompt')}
        label="Yönerge"
        value={step.prompt}
        onChange={(prompt) => onChange({ ...step, prompt })}
        max={120}
        placeholder="ör. Her bölümü göreviyle eşleştir."
        description="İlk eşleştirmeye kadar konuşma balonunda gösterilir."
      />
      <ItemListEditor
        id={fieldId(step.id, 'pairs')}
        label="Eşler"
        description="Sağ taraftakiler Kâşif’te karışık sırayla gösterilir ve birbirinden farklı olmalı."
        items={step.pairs}
        onChange={(pairs) => onChange({ ...step, pairs })}
        min={2}
        max={5}
        create={(): MatchingPair => ({ id: newItemId('p'), left: '', right: '' })}
        addLabel="Eş ekle"
        error={pairsIssue}
        itemLabel={pairName}
        renderItem={(pair, update) => (
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <TextField
              id={fieldId(step.id, `pairs-${pair.id}-left`)}
              label="Sol kart"
              value={pair.left}
              onChange={(left) => update({ ...pair, left })}
              max={40}
              required
              error={blankItemError(pairsIssue, pair.left, 'Sol kart gerekli.')}
              placeholder="ör. Kök"
            />
            <TextField
              id={fieldId(step.id, `pairs-${pair.id}-right`)}
              label="Sağ kart (eşi)"
              value={pair.right}
              onChange={(right) => update({ ...pair, right })}
              max={40}
              required
              error={blankItemError(pairsIssue, pair.right, 'Sağ kart gerekli.')}
              placeholder="ör. Suyu emer"
            />
          </div>
        )}
      />
      <TextField
        id={fieldId(step.id, 'successMessage')}
        label="Başarı mesajı"
        value={step.successMessage}
        onChange={(successMessage) => onChange({ ...step, successMessage })}
        max={160}
        placeholder="ör. Tüm eşleri buldun! 🎉"
        description="Tüm eşler bulununca gösterilir."
      />
    </div>
  )
}
