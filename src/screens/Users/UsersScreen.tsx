/** Users & Access — Owner-only. PIN management + audit log viewer. */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { User } from '../../data/types'
import { t } from '../../i18n/strings'
import { hashPin, generateSalt, validPinFormat } from '../../domain/pin'
import { addUser, updateUser } from '../../data/repository'
import { useAuth } from '../../app/AuthContext'
import { useToast } from '../../components/Toast'
import { Card, Button, Sheet, Field, Input, Chip } from '../../components/ui'
import { DataTable } from '../../components/DataTable'
import { fmtDateTime } from '../../app/format'

export function UsersScreen() {
  const toast = useToast()
  const { currentUser } = useAuth()
  const users = useLiveQuery(() => db.users.toArray(), []) ?? []
  const audit = useLiveQuery(() => db.auditEntries.orderBy('at').reverse().limit(300).toArray(), []) ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [pinTarget, setPinTarget] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', role: 'staff' as 'owner' | 'staff', pin: '', pin2: '' })
  const [auditUser, setAuditUser] = useState<string | null>(null)
  const [auditAction, setAuditAction] = useState<string | null>(null)

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])
  const actions = useMemo(() => [...new Set(audit.map((a) => a.action))], [audit])
  const filteredAudit = audit.filter(
    (a) => (!auditUser || a.byUserId === auditUser) && (!auditAction || a.action === auditAction),
  )

  async function saveUser() {
    if (!currentUser) return
    if (!form.name.trim() || !validPinFormat(form.pin)) return
    if (form.pin !== form.pin2) {
      toast({ message: t('users.pinMismatch') })
      return
    }
    const salt = generateSalt()
    const pinHash = await hashPin(form.pin, salt)
    await addUser({ name: form.name.trim(), role: form.role, pinHash, pinSalt: salt, active: true }, currentUser.id)
    toast({ message: t('users.saved') })
    setFormOpen(false)
    setForm({ name: '', role: 'staff', pin: '', pin2: '' })
  }

  async function changePin() {
    if (!currentUser || !pinTarget) return
    if (!validPinFormat(form.pin) || form.pin !== form.pin2) {
      toast({ message: t('users.pinMismatch') })
      return
    }
    const salt = generateSalt()
    const pinHash = await hashPin(form.pin, salt)
    await updateUser(pinTarget.id, { pinHash, pinSalt: salt }, currentUser.id)
    toast({ message: t('users.saved') })
    setPinTarget(null)
    setForm({ name: '', role: 'staff', pin: '', pin2: '' })
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg font-bold">{t('users.title')}</h1>
        <Button className="!py-2" onClick={() => setFormOpen(true)}>
          + {t('users.add')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <Card key={u.id} className={u.active ? '' : 'opacity-50'}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{u.name}</span>{' '}
                <span className="rounded-pill bg-wash px-2 py-0.5 text-xs font-medium text-ink-muted">
                  {t(`users.role.${u.role}` as 'users.role.owner')}
                </span>
                {u.lastLoginAt && <div className="text-xs text-ink-muted">Last: {fmtDateTime(u.lastLoginAt)}</div>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" className="!py-2 text-sm" onClick={() => setPinTarget(u)}>
                  {t('users.changePin')}
                </Button>
                {u.id !== currentUser?.id && (
                  <Button
                    variant="ghost"
                    className="!py-2 text-sm"
                    onClick={() => currentUser && void updateUser(u.id, { active: !u.active }, currentUser.id)}
                  >
                    {u.active ? t('users.deactivate') : t('users.activate')}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Audit log */}
      <Card>
        <h2 className="mb-2 font-display text-base font-semibold">{t('users.audit')}</h2>
        <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1">
          <Chip selected={auditUser === null} onClick={() => setAuditUser(null)} className="!py-1 text-xs">
            {t('orders.all')}
          </Chip>
          {users.map((u) => (
            <Chip key={u.id} selected={auditUser === u.id} onClick={() => setAuditUser(u.id)} className="!py-1 text-xs">
              {u.name}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1">
          <Chip selected={auditAction === null} onClick={() => setAuditAction(null)} className="!py-1 text-xs">
            {t('orders.all')}
          </Chip>
          {actions.map((a) => (
            <Chip key={a} selected={auditAction === a} onClick={() => setAuditAction(a)} className="!py-1 text-xs">
              {a}
            </Chip>
          ))}
        </div>
        <DataTable
          rows={filteredAudit}
          getRowKey={(a) => a.id}
          initialSortKey="at"
          emptyText={t('reports.empty')}
          columns={[
            {
              key: 'at',
              header: t('users.when'),
              sortValue: (a) => a.at,
              render: (a) => <span className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(a.at)}</span>,
            },
            {
              key: 'by',
              header: t('users.name'),
              sortValue: (a) => usersById.get(a.byUserId) ?? '',
              defaultDesc: false,
              render: (a) => usersById.get(a.byUserId) ?? '—',
            },
            {
              key: 'action',
              header: t('users.action'),
              sortValue: (a) => a.action,
              defaultDesc: false,
              render: (a) => <span className="text-xs text-ink-muted">{a.action}</span>,
            },
            {
              key: 'summary',
              header: t('users.details'),
              sortValue: (a) => a.summary.toLowerCase(),
              defaultDesc: false,
              render: (a) => a.summary,
            },
          ]}
          renderCard={(a) => (
            <>
              <div className="text-sm">{a.summary}</div>
              <div className="text-xs text-ink-muted">
                {usersById.get(a.byUserId) ?? '—'} · {fmtDateTime(a.at)} · {a.action}
              </div>
            </>
          )}
        />
      </Card>

      {/* Add user */}
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={t('users.add')}>
        <div className="flex flex-col gap-3">
          <Field label={t('users.name')}>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('users.role')}>
            <div className="flex gap-2">
              <Chip selected={form.role === 'staff'} onClick={() => setForm((f) => ({ ...f, role: 'staff' }))}>
                {t('users.role.staff')}
              </Chip>
              <Chip selected={form.role === 'owner'} onClick={() => setForm((f) => ({ ...f, role: 'owner' }))}>
                {t('users.role.owner')}
              </Chip>
            </div>
          </Field>
          <Field label={t('users.pin')}>
            <Input type="password" inputMode="numeric" className="font-mono" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
          </Field>
          <Field label={t('users.pinConfirm')}>
            <Input type="password" inputMode="numeric" className="font-mono" value={form.pin2} onChange={(e) => setForm((f) => ({ ...f, pin2: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
          </Field>
          <Button disabled={!form.name.trim() || !validPinFormat(form.pin)} onClick={() => void saveUser()}>
            {t('users.save')}
          </Button>
        </div>
      </Sheet>

      {/* Change PIN */}
      <Sheet open={pinTarget !== null} onClose={() => setPinTarget(null)} title={`${t('users.changePin')} — ${pinTarget?.name ?? ''}`}>
        <div className="flex flex-col gap-3">
          <Field label={t('users.pin')}>
            <Input type="password" inputMode="numeric" className="font-mono" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
          </Field>
          <Field label={t('users.pinConfirm')}>
            <Input type="password" inputMode="numeric" className="font-mono" value={form.pin2} onChange={(e) => setForm((f) => ({ ...f, pin2: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
          </Field>
          <Button disabled={!validPinFormat(form.pin)} onClick={() => void changePin()}>
            {t('common.save')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
