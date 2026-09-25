import { CARD_COLORS, newItemId, type StepOf } from '@/entities/kit'

import { fieldId } from '../field-id'
import { CardColorField, ItemListEditor, RichTextField, TextField } from '../fields'
import { BlockEmojiField, SceneStateField } from './block-fields'
import { blankItemError, firstUnused, itemName } from './list-items'
import { nextSceneState } from './scene-states'
import type { BlockEditorProps } from './types'

type Stage = StepOf<'stage-slider'>['stages'][number]
type Hotspot = StepOf<'explore-hotspots'>['hotspots'][number]

function isBlank(value: string) {
  return value.trim().length === 0
}

export function InfoEditor({ step, onChange, issueFor }: BlockEditorProps<'info'>) {
  return (
    <div className="flex flex-col gap-5">
      <RichTextField
        id={fieldId(step.id, 'body')}
        label="Bilgi metni"
        value={step.body}
        onChange={(body) => onChange({ ...step, body })}
        max={2000}
        rows={6}
        error={issueFor('body')}
        description="Görselin altında gösterilir; cevap boşsa zorunludur. **kalın** vurgu ve satır sonu kullanılabilir."
      />
    </div>
  )
}

export function TapRevealEditor({ step, onChange, issueFor }: BlockEditorProps<'tap-reveal'>) {
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'tapLabel')}
        label="Dokunma yönergesi"
        value={step.tapLabel}
        onChange={(tapLabel) => onChange({ ...step, tapLabel })}
        max={40}
        required
        error={issueFor('tapLabel')}
        placeholder="ör. Tohuma dokun!"
        description="Dokunmadan önce sahnenin altında gösterilir; ekran okuyucular dokunma alanını bu adla okur."
      />
      <TextField
        id={fieldId(step.id, 'revealMessage')}
        label="Ortaya çıkan mesaj"
        value={step.revealMessage}
        onChange={(revealMessage) => onChange({ ...step, revealMessage })}
        max={160}
        multiline
        rows={2}
        required
        error={issueFor('revealMessage')}
        placeholder="ör. Filiz çıktı! 🌱"
        description="Sahneye dokununca konuşma balonunda gösterilir."
      />
    </div>
  )
}

export function StageSliderEditor({ step, onChange, issueFor }: BlockEditorProps<'stage-slider'>) {
  const stagesIssue = issueFor('stages')
  const createStage = (): Stage => ({
    id: newItemId('st'),
    label: '',
    emoji: '✨',
    state: nextSceneState(
      step.visual,
      step.stages.map((stage) => stage.state),
    ),
  })

  return (
    <div className="flex flex-col gap-5">
      <ItemListEditor
        id={fieldId(step.id, 'stages')}
        label="Evreler"
        description="Kaydırıcıda soldan sağa bu sırayla gösterilir."
        items={step.stages}
        onChange={(stages) => onChange({ ...step, stages })}
        min={2}
        max={6}
        create={createStage}
        addLabel="Evre ekle"
        error={stagesIssue}
        itemLabel={(stage, index) => itemName(stage.label, `Evre ${index + 1}`)}
        renderItem={(stage, update) => (
          <div className="flex flex-col gap-4">
            <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={fieldId(step.id, `stages-${stage.id}-label`)}
                label="Evre adı"
                value={stage.label}
                onChange={(label) => update({ ...stage, label })}
                max={30}
                required
                error={blankItemError(stagesIssue, stage.label, 'Evre adı gerekli.')}
                placeholder="ör. Çimlenme"
              />
              <BlockEmojiField
                id={fieldId(step.id, `stages-${stage.id}-emoji`)}
                value={stage.emoji}
                onChange={(emoji) => update({ ...stage, emoji })}
              />
            </div>
            <SceneStateField
              id={fieldId(step.id, `stages-${stage.id}-state`)}
              visual={step.visual}
              value={stage.state}
              onChange={(state) => update({ ...stage, state })}
              description="Bu evrede sahnenin göstereceği hâl."
            />
          </div>
        )}
      />
    </div>
  )
}

export function ExploreHotspotsEditor({
  step,
  onChange,
  issueFor,
}: BlockEditorProps<'explore-hotspots'>) {
  const hotspotsIssue = issueFor('hotspots')
  const createHotspot = (): Hotspot => ({
    id: newItemId('h'),
    label: '',
    icon: '✨',
    color:
      firstUnused(
        CARD_COLORS,
        step.hotspots.map((hotspot) => hotspot.color),
      ) ?? 'green',
    message: '',
    // `idle` is the scene at rest — a button should change something.
    state: nextSceneState(
      step.visual,
      step.hotspots.map((hotspot) => hotspot.state),
      ['idle'],
    ),
  })

  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'prompt')}
        label="Yönerge"
        value={step.prompt}
        onChange={(prompt) => onChange({ ...step, prompt })}
        max={80}
        placeholder="ör. Her butona dokun!"
        description="Bir butona dokunulana kadar konuşma balonunda gösterilir."
      />
      <ItemListEditor
        id={fieldId(step.id, 'hotspots')}
        label="Keşif butonları"
        description="Her buton sahnede bir hâli gösterir ve mesajını konuşma balonunda söyler."
        items={step.hotspots}
        onChange={(hotspots) => onChange({ ...step, hotspots })}
        min={2}
        max={6}
        create={createHotspot}
        addLabel="Buton ekle"
        error={hotspotsIssue}
        itemLabel={(hotspot, index) => itemName(hotspot.label, `Buton ${index + 1}`)}
        renderItem={(hotspot, update) => (
          <div className="flex flex-col gap-4">
            <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <TextField
                id={fieldId(step.id, `hotspots-${hotspot.id}-label`)}
                label="Buton adı"
                value={hotspot.label}
                onChange={(label) => update({ ...hotspot, label })}
                max={24}
                required
                error={blankItemError(hotspotsIssue, hotspot.label, 'Buton adı gerekli.')}
                placeholder="ör. Işık"
              />
              <BlockEmojiField
                id={fieldId(step.id, `hotspots-${hotspot.id}-icon`)}
                value={hotspot.icon}
                onChange={(icon) => update({ ...hotspot, icon })}
              />
            </div>
            <TextField
              id={fieldId(step.id, `hotspots-${hotspot.id}-message`)}
              label="Mesaj"
              value={hotspot.message}
              onChange={(message) => update({ ...hotspot, message })}
              max={160}
              multiline
              rows={2}
              required
              error={blankItemError(hotspotsIssue, hotspot.message, 'Mesaj gerekli.')}
              placeholder="ör. Işık besin üretimini sağlar."
              description="Butona dokununca konuşma balonunda gösterilir."
            />
            <CardColorField
              label="Buton rengi"
              value={hotspot.color}
              onChange={(color) => update({ ...hotspot, color })}
            />
            <SceneStateField
              id={fieldId(step.id, `hotspots-${hotspot.id}-state`)}
              visual={step.visual}
              value={hotspot.state}
              onChange={(state) => update({ ...hotspot, state })}
              description="Butona dokununca sahnenin göstereceği hâl."
            />
          </div>
        )}
      />
    </div>
  )
}

export function ToggleSceneEditor({ step, onChange, issueFor }: BlockEditorProps<'toggle-scene'>) {
  // The validator reports blank button texts on 'onLabel' ("Git" focuses it). Show the message
  // under the button that is actually blank, so a filled field is never marked invalid.
  const labelsIssue = issueFor('onLabel')
  const onlyOffBlank = isBlank(step.offLabel) && !isBlank(step.onLabel)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          id={fieldId(step.id, 'onLabel')}
          label="Açma düğmesi"
          value={step.onLabel}
          onChange={(onLabel) => onChange({ ...step, onLabel })}
          max={30}
          required
          error={onlyOffBlank ? undefined : labelsIssue}
          placeholder="ör. ☀️ Işığı aç!"
          description="Sahne kapalıyken düğmede yazar."
        />
        <TextField
          id={fieldId(step.id, 'offLabel')}
          label="Kapatma düğmesi"
          value={step.offLabel}
          onChange={(offLabel) => onChange({ ...step, offLabel })}
          max={30}
          required
          error={onlyOffBlank ? labelsIssue : undefined}
          placeholder="ör. 🌙 Işığı kapat"
          description="Sahne açıkken düğmede yazar."
        />
      </div>
      <TextField
        id={fieldId(step.id, 'onMessage')}
        label="Açıkken gösterilen mesaj"
        value={step.onMessage}
        onChange={(onMessage) => onChange({ ...step, onMessage })}
        max={160}
        multiline
        rows={2}
        placeholder="ör. ⭐ Besin pişiyor!"
        description="Sahne açılınca konuşma balonunda gösterilir."
      />
    </div>
  )
}

export function AnimatedSceneEditor({
  step,
  onChange,
  issueFor,
}: BlockEditorProps<'animated-scene'>) {
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id={fieldId(step.id, 'caption')}
        label="Animasyon açıklaması"
        value={step.caption}
        onChange={(caption) => onChange({ ...step, caption })}
        max={160}
        multiline
        rows={2}
        required
        error={issueFor('caption')}
        placeholder="ör. Damlalar kökten yapraklara taşınıyor!"
        description="Animasyon oynarken sahnenin altında gösterilir."
      />
      <TextField
        id={fieldId(step.id, 'staticCaption')}
        label="Durdurulunca gösterilen açıklama"
        value={step.staticCaption}
        onChange={(staticCaption) => onChange({ ...step, staticCaption })}
        max={160}
        multiline
        rows={2}
        placeholder="ör. Animasyon durdu. Devam etmek için Oynat’a dokun."
        description="Çocuk animasyonu durdurduğunda ya da cihazda hareket azaltma açıkken üstteki açıklamanın yerine gösterilir."
      />
    </div>
  )
}
