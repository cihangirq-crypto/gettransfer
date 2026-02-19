import { Router, type Request, type Response } from 'express'

const router = Router()

type PaymentMethod = {
  id: string
  customerId: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  holder: string
  default?: boolean
}

const store: Map<string, PaymentMethod[]> = new Map()

router.get('/:customerId', (req: Request, res: Response) => {
  const list = store.get(req.params.customerId) || []
  res.json({ success: true, data: list })
})

router.post('/:customerId', (req: Request, res: Response) => {
  const { brand, last4, expMonth, expYear, holder } = req.body || {}
  if (!brand || !last4 || !expMonth || !expYear || !holder) {
    res.status(400).json({ success: false, error: 'invalid_payload' }); return
  }
  const id = 'pm_' + Date.now()
  const pm: PaymentMethod = { id, customerId: req.params.customerId, brand, last4, expMonth, expYear, holder }
  const list = store.get(req.params.customerId) || []
  list.push(pm)
  store.set(req.params.customerId, list)
  res.json({ success: true, data: pm })
})

router.post('/:customerId/default/:id', (req: Request, res: Response) => {
  const list = store.get(req.params.customerId) || []
  if (list.length === 0) { res.status(404).json({ success: false, error: 'not_found' }); return }
  list.forEach(pm => pm.default = pm.id === req.params.id)
  store.set(req.params.customerId, list)
  res.json({ success: true })
})

router.delete('/:customerId/:id', (req: Request, res: Response) => {
  const list = store.get(req.params.customerId) || []
  const next = list.filter(pm => pm.id !== req.params.id)
  store.set(req.params.customerId, next)
  res.json({ success: true })
})

export default router
