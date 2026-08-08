/**
 * Session + lock state. PIN verification against PBKDF2 hashes; 5 failures
 * trigger a 60-second cooldown. Idle timeout re-locks the app.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../data/types'
import { verifyPin } from '../domain/pin'
import { touchLastLogin } from '../data/repository'
import { clientConfig } from '../config/client.config'

const MAX_ATTEMPTS = 5
const COOLDOWN_S = 60

interface AuthState {
  currentUser: User | null
  isOwner: boolean
  locked: boolean
  cooldownUntil: number | null
  attemptsLeft: number
  unlock: (user: User, pin: string) => Promise<boolean>
  unlockRecovered: (user: User) => void
  lock: () => void
}

const AuthContext = createContext<AuthState>(null as unknown as AuthState)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [failures, setFailures] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()

  const lock = useCallback(() => setCurrentUser(null), [])

  // Idle timeout → relock
  useEffect(() => {
    if (!currentUser) return
    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(lock, clientConfig.lockTimeoutMinutes * 60_000)
    }
    reset()
    const events = ['pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [currentUser, lock])

  const unlock = useCallback(
    async (user: User, pin: string): Promise<boolean> => {
      if (cooldownUntil && Date.now() < cooldownUntil) return false
      const ok = await verifyPin(pin, user.pinSalt, user.pinHash)
      if (ok) {
        setFailures(0)
        setCooldownUntil(null)
        setCurrentUser(user)
        void touchLastLogin(user.id)
        return true
      }
      const next = failures + 1
      setFailures(next)
      if (next >= MAX_ATTEMPTS) {
        setCooldownUntil(Date.now() + COOLDOWN_S * 1000)
        setFailures(0)
      }
      return false
    },
    [failures, cooldownUntil],
  )

  const unlockRecovered = useCallback((user: User) => {
    setFailures(0)
    setCooldownUntil(null)
    setCurrentUser(user)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isOwner: currentUser?.role === 'owner',
        locked: currentUser === null,
        cooldownUntil,
        attemptsLeft: MAX_ATTEMPTS - failures,
        unlock,
        unlockRecovered,
        lock,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
