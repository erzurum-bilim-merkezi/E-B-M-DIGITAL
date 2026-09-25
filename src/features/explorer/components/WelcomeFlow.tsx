import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import {
  AVATAR_LABELS,
  checkNickname,
  formatRestoreCode,
  NICKNAME_MAX,
  NICKNAME_MESSAGES,
  type Avatar,
} from '@/entities/explorer'
import { errorMessage } from '@/shared/api/errors'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { AvatarPicker, KidButton, KidInput, KidPanel, Mascot, SpeechBubble } from '@/shared/ui/kid'

import { useRegisterExplorer } from '../api/queries'
import { useCenterDevice } from '../hooks/useCenterDevice'

type WelcomeFlowProps = {
  /** Where to continue after joining (QR entry). Skips the code screen: ≤ 3 taps to the card. */
  continueTo: string | null
  restoreHref: string
  privacyHref: string
  onDone: (target: string) => void
  /** Centre devices always show the code screen before continuing. */
  alwaysShowCode?: boolean
  /** Called when joining starts — the host must not redirect away while the code is shown. */
  onJoinStart?: () => void
}

type Step = 'name' | 'avatar' | 'welcome'

export function WelcomeFlow({
  continueTo,
  restoreHref,
  privacyHref,
  onDone,
  alwaysShowCode = false,
  onJoinStart,
}: WelcomeFlowProps) {
  const [step, setStep] = useState<Step>('name')
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState<Avatar>('indigo')
  const [problem, setProblem] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()
  const register = useRegisterExplorer()
  // Shared centre tablets must not offer the previous child's name (privacy); personal devices may.
  const centreDevice = useCenterDevice() !== null

  /** Each screen replaces the one whose button was pressed: its heading takes focus (2.4.3). */
  const goTo = (next: Step) => {
    setStep(next)
    focusAfterUpdate(headingRef)
  }

  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const issue = checkNickname(nickname)
    if (issue) {
      setProblem(NICKNAME_MESSAGES[issue])
      inputRef.current?.focus()
      return
    }
    setProblem(null)
    goTo('avatar')
  }

  const enter = () => {
    if (register.isPending) return
    onJoinStart?.()
    register.mutate(
      { nickname, avatar },
      {
        onSuccess: () => {
          if (continueTo && !alwaysShowCode) onDone(continueTo)
          else goTo('welcome')
        },
        onError: (error) => {
          setProblem(errorMessage(error))
          goTo('name')
        },
      },
    )
  }

  if (step === 'welcome' && register.data) {
    const { explorer, restoreCode } = register.data
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <Mascot
          color={explorer.avatar}
          pose="celebrate"
          className="kid-ambient size-40 [animation:kid-float_3s_ease-in-out_infinite]"
        />
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-[clamp(2rem,8vw,2.8rem)] leading-tight font-bold outline-none"
        >
          Hoş geldin {explorer.nickname}!
        </h1>
        <p className="text-xl font-medium text-kid-fg-soft">
          Artık bir Kâşif üyesisin. Bilim Merkezi seni bekliyor! 🚀
        </p>
        <KidPanel className="flex w-full flex-col gap-2">
          <p className="text-lg font-semibold">🔑 Kâşif kodun</p>
          <p className="font-mono text-3xl font-bold tracking-wider" data-testid="restore-code">
            {formatRestoreCode(restoreCode)}
          </p>
          <p className="text-base text-kid-fg-soft">
            Başka bir cihazda kaldığın yerden devam etmek için bu kodu kullan. Kâşif kartında her
            zaman görebilirsin.
          </p>
        </KidPanel>
        <KidButton
          variant="primary"
          size="xl"
          className="w-full"
          onClick={() => onDone(continueTo ?? '/')}
        >
          Bilim Merkezine gir ➜
        </KidButton>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-end gap-3">
        <Mascot
          color={step === 'avatar' ? avatar : 'indigo'}
          pose={step === 'name' ? 'hello' : 'thinking'}
          className="size-28 shrink-0 sm:size-32"
        />
        <SpeechBubble className="mb-4 flex-1">
          {step === 'name'
            ? 'Merhaba! Ben Kâşif. Senin adın ne?'
            : `Harika ${nickname.trim()}! Hangi Kâşif sensin?`}
        </SpeechBubble>
      </div>

      {step === 'name' ? (
        <form noValidate onSubmit={submitName} className="flex flex-col gap-4">
          <h1 ref={headingRef} tabIndex={-1} className="sr-only">
            Kâşif’e hoş geldin
          </h1>
          <label htmlFor="kasif-nickname" className="text-xl font-bold">
            Adın
          </label>
          <KidInput
            ref={inputRef}
            id="kasif-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={NICKNAME_MAX + 5}
            autoComplete={centreDevice ? 'off' : 'nickname'}
            autoCapitalize="words"
            enterKeyHint="next"
            aria-invalid={problem ? true : undefined}
            aria-describedby="kasif-nickname-hint kasif-nickname-error"
            placeholder="ör. Ayşe"
          />
          <p id="kasif-nickname-hint" className="-mt-2 text-base text-kid-fg-soft">
            Takma ad da olur 🙂
          </p>
          <p
            id="kasif-nickname-error"
            role="alert"
            className="-mt-2 min-h-7 text-lg font-semibold text-kid-danger"
          >
            {problem}
          </p>
          <KidButton type="submit" size="xl">
            Devam ➜
          </KidButton>
          <div className="flex flex-col items-center gap-3 pt-2 text-lg">
            <Link
              to={restoreHref}
              className="kid-focus rounded-lg font-semibold text-kid-link underline underline-offset-4"
            >
              🔑 Kâşif kodum var
            </Link>
            <Link
              to={privacyHref}
              className="kid-focus rounded-lg text-base text-kid-fg-soft underline underline-offset-4"
            >
              Aydınlatma metni
            </Link>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-center text-2xl font-bold outline-none"
          >
            Avatarını seç
          </h1>
          <AvatarPicker
            value={avatar}
            onChange={setAvatar}
            labels={AVATAR_LABELS}
            legend="Avatarını seç"
          />
          {/* aria-disabled while joining: the button just pressed keeps focus. */}
          <KidButton
            size="xl"
            onClick={enter}
            aria-disabled={register.isPending}
            aria-busy={register.isPending}
          >
            {register.isPending ? 'Hazırlanıyor…' : '🚀 Bilim Merkezine Gir'}
          </KidButton>
          <KidButton variant="ghost" onClick={() => goTo('name')}>
            ← Adımı değiştir
          </KidButton>
        </div>
      )}
    </div>
  )
}
