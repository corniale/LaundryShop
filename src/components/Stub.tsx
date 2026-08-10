/**
 * Claim stub — print (58mm + A4), share as image (canvas → Web Share),
 * copy as text. All free and offline.
 */
import type { Order, Payment, Shop } from '../data/types'
import { formatCentavos } from '../domain/money'
import { paidCentavos, balanceCentavos } from '../domain/payments'
import { orderItemCount } from '../domain/orders'
import { fmtDateFull } from '../app/format'
import { t } from '../i18n/strings'
import { Button } from './ui'
import { useToast } from './Toast'

export function stubText(shop: Shop, order: Order, payments: Payment[], customerName: string): string {
  const paid = paidCentavos(payments)
  const balance = balanceCentavos(order.totalCentavos, payments)
  return [
    shop.name,
    shop.contact,
    '--------------------------',
    `${t('stub.orderCode')}: ${order.code}`,
    customerName,
    // One line per service, so the customer's copy shows what they paid for.
    ...order.lines.map((l) => `${l.serviceNameSnapshot} · ${l.kilos} kg`),
    orderItemCount(order) ? `${orderItemCount(order)} pcs — ${order.itemNotes ?? ''}` : '',
    '--------------------------',
    `${t('orders.total')}: ${formatCentavos(order.totalCentavos)}`,
    `${t('orders.paid')}: ${formatCentavos(paid)}`,
    `${t('orders.balance')}: ${formatCentavos(balance)}`,
    `${t('orders.promised')}: ${fmtDateFull(order.promisedAt)}`,
    '--------------------------',
    shop.receiptFooter ?? t('stub.footerDefault'),
  ]
    .filter(Boolean)
    .join('\n')
}

function drawStubCanvas(text: string): HTMLCanvasElement {
  const lines = text.split('\n')
  const scale = 2
  const width = 380
  const lineHeight = 26
  const pad = 24
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = (lines.length * lineHeight + pad * 2) * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  // Thermal paper is not themed, but the two values still come from
  // themes.css so no literal colour lives outside it (spec.md § Theming 1).
  const root = getComputedStyle(document.documentElement)
  ctx.fillStyle = root.getPropertyValue('--paper').trim()
  ctx.fillRect(0, 0, width, lines.length * lineHeight + pad * 2)
  ctx.fillStyle = root.getPropertyValue('--paper-ink').trim()
  lines.forEach((line, i) => {
    const isCode = line.startsWith(t('stub.orderCode'))
    ctx.font = isCode ? 'bold 20px monospace' : i === 0 ? 'bold 17px monospace' : '15px monospace'
    ctx.fillText(line, pad, pad + (i + 0.8) * lineHeight)
  })
  return canvas
}

export function StubActions({
  shop,
  order,
  payments,
  customerName,
}: {
  shop: Shop
  order: Order
  payments: Payment[]
  customerName: string
}) {
  const toast = useToast()
  const text = stubText(shop, order, payments, customerName)

  function printStub() {
    const area = document.createElement('div')
    area.id = 'print-area'
    area.innerHTML = `<pre class="stub" style="font-family:monospace;white-space:pre-wrap">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`
    document.body.appendChild(area)
    window.print()
    area.remove()
  }

  async function shareImage() {
    const canvas = drawStubCanvas(text)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], `${order.code}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: order.code })
      } catch {
        // user cancelled
      }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${order.code}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(text)
    toast({ message: t('stub.copied') })
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="secondary" onClick={printStub}>
        {t('stub.print')}
      </Button>
      <Button variant="secondary" onClick={() => void shareImage()}>
        {t('stub.shareImage')}
      </Button>
      <Button variant="secondary" onClick={() => void copyText()}>
        {t('stub.copyText')}
      </Button>
    </div>
  )
}

/** "Ready for pickup" message — template + share/sms. Owner sends from their own account. */
export function buildReadyMessage(shop: Shop, order: Order, payments: Payment[], customerName: string): string {
  const template = shop.readyMessageTemplate || t('message.readyTemplate')
  return template
    .replace('{name}', customerName)
    .replace('{code}', order.code)
    .replace('{total}', formatCentavos(order.totalCentavos))
    .replace('{balance}', formatCentavos(balanceCentavos(order.totalCentavos, payments)))
    .replace('{shop}', shop.name)
}

export async function sendReadyMessage(message: string, contact?: string): Promise<void> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message })
      return
    } catch {
      // fall through to sms
    }
  }
  if (contact) {
    window.location.href = `sms:${contact.replace(/\s/g, '')}?body=${encodeURIComponent(message)}`
  } else {
    await navigator.clipboard.writeText(message)
  }
}
