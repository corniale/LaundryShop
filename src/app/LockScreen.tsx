/** PIN pad lock screen with user picker, cooldown, and recovery path. */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import type { User } from '../data/types'
import { useAuth } from './AuthContext'
import { t } from '../i18n/strings'
import { hashPin, generateSalt, validPinFormat, verifyPin } from '../domain/pin'
import { updateUser } from '../data/repository'

export function LockScreen() {
  const { unlock, unlockRecovered, cooldownUntil, attemptsLeft } = useAuth()
  const users = useLiveQuery(() => db.users.filter((u) => u.active).toArray(), []) ?? []
  const appMeta = useLiveQuery(() => db.appMeta.get('app'), [])
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPin, setNewPin] = useState('')
  const [recoveredUser, setRecoveredUser] = useState<User | null>(null)

  useEffect(() => {
    if (users.length === 1 && !selected) setSelected(users[0])
  }, [users, selected])

  useEffect(() => {
    if (!cooldownUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const coolingDown = cooldownUntil !== null && now < cooldownUntil
  const secondsLeft = coolingDown ? Math.ceil((cooldownUntil - now) / 1000) : 0

  const owner = useMemo(() => users.find((u) => u.role === 'owner'), [users])

  async function submitPin(fullPin: string) {
    if (!selected || coolingDown) return
    const ok = await unlock(selected, fullPin)
    if (!ok) {
      setError(t('lock.wrong'))
      setPin('')
    }
  }

  function press(digit: string) {
    if (coolingDown) return
    setError(null)
    const next = pin + digit
    setPin(next)
    if (next.length >= 6) void submitPin(next)
  }

  async function tryRecovery() {
    if (!owner?.recoveryHash || !owner.recoverySalt) return
    const normalized = recoveryCode.trim().toUpperCase()
    const ok = await verifyPin(normalized, owner.recoverySalt, owner.recoveryHash)
    if (!ok) {
      setError(t('lock.recoveryWrong'))
      return
    }
    setRecoveredUser(owner)
    setError(null)
  }

  async function setRecoveredPin() {
    if (!recoveredUser || !validPinFormat(newPin)) return
    const salt = generateSalt()
    const hash = await hashPin(newPin, salt)
    await updateUser(recoveredUser.id, { pinSalt: salt, pinHash: hash }, recoveredUser.id)
    unlockRecovered({ ...recoveredUser, pinSalt: salt, pinHash: hash })
  }

  if (recoveryMode) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-wash p-6">
        <h1 className="font-display text-lg font-bold">{t('lock.recovery')}</h1>
        {!recoveredUser ? (
          <>
            <input
              className="min-h-touch w-full max-w-xs rounded-input border border-line bg-surface px-3 py-2.5 text-center font-mono uppercase"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoFocus
            />
            {error && <p className="text-sm text-danger-700">{error}</p>}
            <button
              className="min-h-touch w-full max-w-xs rounded-input bg-primary-600 py-3 font-semibold text-surface"
              onClick={() => void tryRecovery()}
            >
              {t('common.confirm')}
            </button>
          </>
        ) : (
          <>
            <p className="text-ink-muted">{t('lock.newPin')}</p>
            <input
              className="min-h-touch w-full max-w-xs rounded-input border border-line bg-surface px-3 py-2.5 text-center font-mono"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              autoFocus
            />
            <button
              className="min-h-touch w-full max-w-xs rounded-input bg-primary-600 py-3 font-semibold text-surface disabled:opacity-40"
              disabled={!validPinFormat(newPin)}
              onClick={() => void setRecoveredPin()}
            >
              {t('common.save')}
            </button>
          </>
        )}
        <button className="min-h-touch text-sm text-ink-muted" onClick={() => setRecoveryMode(false)}>
          {t('common.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-wash p-6 pb-safe">
      <div className="text-center">
        <h1 className="font-display text-xl font-bold text-primary-800">
          {appMeta?.demoMode ? 'Bubbles Laundry Shop' : ''}
        </h1>
        <p className="mt-1 text-ink-muted">{selected ? t('lock.title') : t('lock.who')}</p>
      </div>

      {!selected || users.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setSelected(u)
                setPin('')
                setError(null)
              }}
              className={`min-h-touch rounded-pill border px-5 py-2.5 font-medium ${
                selected?.id === u.id
                  ? 'border-primary-600 bg-primary-600 text-surface'
                  : 'border-line bg-surface text-ink'
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      ) : null}

      {selected && (
        <>
          {/* Four dots (the minimum PIN); a fifth/sixth appears only as typed */}
          <div className="flex gap-2" aria-label="PIN">
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-pill ${i < pin.length ? 'bg-primary-600' : 'bg-line'}`}
              />
            ))}
          </div>

          {coolingDown ? (
            <p className="text-sm text-danger-700">{t('lock.cooldown', { n: secondsLeft })}</p>
          ) : error ? (
            <p className="text-sm text-danger-700">
              {error} ({attemptsLeft})
            </p>
          ) : (
            <p className="text-sm text-transparent">·</p>
          )}

          <div className="grid w-full max-w-[280px] grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) =>
              key === '' ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  disabled={coolingDown}
                  onClick={() =>
                    key === '⌫' ? setPin((p) => p.slice(0, -1)) : press(key)
                  }
                  className="min-h-touch rounded-card bg-surface py-4 font-mono text-lg shadow-card active:bg-primary-100 disabled:opacity-40"
                >
                  {key}
                </button>
              ),
            )}
          </div>

          {pin.length >= 4 && !coolingDown && (
            <button
              className="min-h-touch w-full max-w-[280px] rounded-input bg-primary-600 py-3 font-semibold text-surface"
              onClick={() => void submitPin(pin)}
            >
              {t('common.confirm')}
            </button>
          )}
        </>
      )}

      {appMeta?.demoMode && (
        <p className="text-center text-xs text-ink-muted">Demo: Admin PIN 1234 · Jenny PIN 5678</p>
      )}

      {owner?.recoveryHash && (
        <button className="min-h-touch text-sm text-primary-600" onClick={() => setRecoveryMode(true)}>
          {t('lock.forgot')}
        </button>
      )}
    </div>
  )
}
