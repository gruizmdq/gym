import { disableRestPush, enableRestPush, usePushState } from '../../push/start'
import { useAccount } from '../../sync/status'

// Settings › Entrenamiento: the push at the end of the rest, turned on and off per device.
export function RestAlertRow() {
  const { device, working, error } = usePushState()
  const { email } = useAccount()

  if (device === 'unsupported') {
    return (
      <div className="flex min-h-[52px] flex-col justify-center border-line border-b px-4 py-2.5 last:border-b-0">
        <span>Aviso de fin de descanso</span>
        <span className="text-foot text-ink-3">Instalá la app en inicio para activarlo.</span>
      </div>
    )
  }

  const on = device === 'on'
  const note = working
    ? working === 'enabling'
      ? 'Activando…'
      : 'Desactivando…'
    : (error ??
      (device === 'blocked'
        ? 'Lo bloqueaste: activalo en Ajustes del iPhone › Notificaciones › Gym.'
        : !email && !on
          ? 'Entrá con tu cuenta para activarlo.'
          : null))
  const disabled =
    device === 'loading' || device === 'blocked' || working !== null || (!email && !on)

  return (
    <div className="flex min-h-[52px] items-center gap-3 border-line border-b px-4 py-2.5 last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span id="rest-alert">Aviso de fin de descanso</span>
        {note && (
          <span className={`text-foot ${error && !working ? 'text-warn' : 'text-ink-3'}`}>
            {note}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="rest-alert"
        disabled={disabled}
        onClick={() => void (on ? disableRestPush() : enableRestPush())}
        // The switch is drawn at iOS's size; the touch area is 44 pt tall.
        className="flex h-11 shrink-0 items-center disabled:opacity-50"
      >
        <span
          className={`relative h-[31px] w-[51px] rounded-full transition-colors ${on ? 'bg-accent' : 'bg-line-strong'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-float transition-transform ${on ? 'translate-x-5' : ''}`}
          />
        </span>
      </button>
    </div>
  )
}
