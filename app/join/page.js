'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const SERVICES = {
  haircut:       { label: 'Haircut',         price: 80,  duration: 20 },
  shave:         { label: 'Shave',           price: 50,  duration: 15 },
  beard_trim:    { label: 'Beard trim',      price: 60,  duration: 15 },
  haircut_shave: { label: 'Haircut + Shave', price: 120, duration: 30 },
  champi:        { label: 'Champi',          price: 80,  duration: 20 },
  facial:        { label: 'Facial',          price: 150, duration: 40 },
  hair_color:    { label: 'Hair color',      price: 200, duration: 45 },
}

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const shopId = searchParams.get('shop')

  const [shopInfo, setShopInfo] = useState(null)
  const [queueState, setQueueState] = useState({ waitingCount: 0, totalWaitMinutes: 0, serving: null })
  const [loadingShop, setLoadingShop] = useState(true)
  const [shopError, setShopError] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [service, setService] = useState('')

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Fetch shop info + queue state on load
  useEffect(() => {
    if (!shopId) {
      setShopError(true)
      setLoadingShop(false)
      return
    }

    fetch(`/api/queue/state?shop_id=${shopId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setShopError(true); return }
        setShopInfo(data.shop)
        setQueueState({
          waitingCount: data.waitingCount,
          totalWaitMinutes: data.totalWaitMinutes,
          serving: data.serving,
        })
      })
      .catch(() => setShopError(true))
      .finally(() => setLoadingShop(false))
  }, [shopId])

  function validate() {
    const e = {}
    if (!name.trim() || name.trim().length < 2) e.name = 'Please enter your name'
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a valid 10-digit mobile number'
    if (!service) e.service = 'Please select a service'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleJoin() {
    if (!validate()) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          customer_name: name.trim(),
          mobile: phone,
          service,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrors({ submit: data.error || 'Something went wrong. Try again.' })
        return
      }

      // Redirect to the customer's live token page
      router.push(`/queue/${data.entry.id}`)

    } catch (err) {
      setErrors({ submit: 'Network error. Check your connection.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Estimated wait for selected service
  const selectedWait = service
    ? queueState.totalWaitMinutes + SERVICES[service].duration
    : null

  // ── Render states ──

  if (loadingShop) return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
    </div>
  )

  if (shopError || !shopId) return (
    <div style={styles.centered}>
      <p style={styles.errorMsg}>Invalid link. Please scan the QR code again.</p>
    </div>
  )

  return (
    <>
      <style>{css}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.brand}>Namber<span style={styles.brandAccent}>One</span></div>
        <div style={styles.shopBadge}>{shopInfo?.shop_name}</div>
      </header>

      {/* Live queue strip */}
      <div style={styles.strip}>
        <div style={styles.stripItem}>
          <div className="dot" />
          <span style={styles.stripLabel}>Now serving</span>
          <span style={styles.stripValue}>
            {queueState.serving ? `N-${String(queueState.serving.token_number).padStart(2,'0')}` : '—'}
          </span>
        </div>
        <div style={styles.stripItem}>
          <span style={styles.stripLabel}>Waiting</span>
          <span style={styles.stripValue}>{queueState.waitingCount} log</span>
        </div>
        <div style={styles.stripItem}>
          <span style={styles.stripLabel}>~</span>
          <span style={styles.stripValue}>{queueState.totalWaitMinutes} min</span>
        </div>
      </div>

      {/* Main form */}
      <main style={styles.main}>
        <h1 style={styles.heading}>Apna number<br />lo, baith jao</h1>
        <p style={styles.sub}>Fill in your details, we'll call you when ready.</p>

        {/* Name */}
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Your name</label>
          <input
            style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
            type="text"
            placeholder="e.g. Ravi Kumar"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: null })) }}
            autoComplete="given-name"
          />
          {errors.name && <div style={styles.fieldError}>{errors.name}</div>}
        </div>

        {/* Phone */}
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Mobile number</label>
          <div style={{ ...styles.phoneWrap, ...(errors.phone ? styles.phoneWrapError : {}) }}>
            <div style={styles.phonePrefix}>+91</div>
            <input
              style={styles.phoneInput}
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              maxLength={10}
              value={phone}
              onChange={e => {
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                setErrors(p => ({ ...p, phone: null }))
              }}
            />
          </div>
          {errors.phone && <div style={styles.fieldError}>{errors.phone}</div>}
        </div>

        {/* Services */}
        <label style={styles.fieldLabel}>Select service</label>
        <div style={styles.servicesGrid}>
          {Object.entries(SERVICES).map(([key, svc]) => (
            <label key={key} style={styles.serviceCard} className="service-card">
              <input
                type="radio"
                name="service"
                value={key}
                checked={service === key}
                onChange={() => { setService(key); setErrors(p => ({ ...p, service: null })) }}
                style={{ display: 'none' }}
              />
              <div style={{
                ...styles.serviceInner,
                ...(service === key ? styles.serviceInnerSelected : {})
              }}>
                <span style={{
                  ...styles.serviceName,
                  ...(service === key ? styles.serviceNameSelected : {})
                }}>{svc.label}</span>
                <div style={styles.serviceMeta}>
                  <span style={{
                    ...styles.servicePrice,
                    ...(service === key ? styles.servicePriceSelected : {})
                  }}>₹{svc.price}</span>
                  <span style={styles.serviceTime}>{svc.duration} min</span>
                </div>
              </div>
            </label>
          ))}
        </div>
        {errors.service && <div style={{ ...styles.fieldError, marginBottom: '1rem' }}>{errors.service}</div>}

        {/* Wait estimate */}
        {selectedWait && (
          <div style={styles.waitBar}>
            <span style={styles.waitLabel}>Your estimated wait</span>
            <span style={styles.waitValue}>~{selectedWait} min</span>
          </div>
        )}

        {/* Submit error */}
        {errors.submit && (
          <div style={styles.submitError}>{errors.submit}</div>
        )}

        {/* Join button */}
        <button
          style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}
          onClick={handleJoin}
          disabled={submitting}
        >
          {submitting ? <div style={styles.btnSpinner} className="btn-spin" /> : 'Join queue'}
        </button>
      </main>
    </>
  )
}

// ── Styles ──
const styles = {
  centered: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#faf6f0',
  },
  spinner: {
    width: 28, height: 28, border: '2.5px solid #e8dcc8',
    borderTopColor: '#1a1207', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  errorMsg: { fontFamily: 'DM Sans, sans-serif', color: '#b53a2a', fontSize: 15 },

  header: {
    padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid #e8dcc8',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#faf6f0',
  },
  brand: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem',
    letterSpacing: '-0.02em', color: '#1a1207',
  },
  brandAccent: { color: '#c9820a' },
  shopBadge: {
    fontSize: '0.8rem', fontWeight: 500, color: '#6b5e47',
    background: '#f2ead8', padding: '4px 10px', borderRadius: 100,
    border: '1px solid #e8dcc8', fontFamily: 'DM Sans, sans-serif',
  },

  strip: {
    background: '#1a1207', color: '#faf6f0',
    padding: '0.65rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
    fontSize: '0.82rem', fontFamily: 'DM Sans, sans-serif',
  },
  stripItem: { display: 'flex', alignItems: 'center', gap: 6 },
  stripLabel: { opacity: 0.55 },
  stripValue: { fontWeight: 500, fontFamily: 'Syne, sans-serif' },

  main: {
    flex: 1, padding: '2rem 1.5rem 3rem',
    maxWidth: 480, width: '100%', margin: '0 auto',
    fontFamily: 'DM Sans, sans-serif',
  },
  heading: {
    fontFamily: 'Syne, sans-serif', fontWeight: 700,
    fontSize: 'clamp(1.6rem, 5vw, 2rem)', letterSpacing: '-0.03em',
    lineHeight: 1.15, marginBottom: '0.35rem', color: '#1a1207',
  },
  sub: { fontSize: '0.9rem', color: '#6b5e47', marginBottom: '2rem' },

  field: { marginBottom: '1.25rem' },
  fieldLabel: {
    display: 'block', fontSize: '0.78rem', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: '#6b5e47', marginBottom: '0.45rem',
  },
  input: {
    width: '100%', height: 48, background: '#fff',
    border: '1.5px solid #e8dcc8', borderRadius: 10,
    padding: '0 1rem', fontFamily: 'DM Sans, sans-serif',
    fontSize: '1rem', color: '#1a1207', outline: 'none',
    boxSizing: 'border-box',
  },
  inputError: { borderColor: '#b53a2a', background: '#fdf0ee' },
  fieldError: { fontSize: '0.78rem', color: '#b53a2a', marginTop: '0.3rem' },

  phoneWrap: {
    display: 'flex', border: '1.5px solid #e8dcc8',
    borderRadius: 10, overflow: 'hidden', background: '#fff',
  },
  phoneWrapError: { borderColor: '#b53a2a', background: '#fdf0ee' },
  phonePrefix: {
    padding: '0 0.9rem', height: 48, display: 'flex', alignItems: 'center',
    fontSize: '0.95rem', color: '#6b5e47', fontWeight: 500,
    borderRight: '1.5px solid #e8dcc8', background: '#f2ead8',
    whiteSpace: 'nowrap',
  },
  phoneInput: {
    border: 'none', outline: 'none', height: 46, background: 'transparent',
    fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#1a1207',
    padding: '0 1rem', flex: 1, width: '100%',
  },

  servicesGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 8, marginBottom: '0.5rem',
  },
  serviceCard: { cursor: 'pointer' },
  serviceInner: {
    display: 'flex', flexDirection: 'column',
    padding: '0.75rem 0.9rem', border: '1.5px solid #e8dcc8',
    borderRadius: 10, background: '#fff', cursor: 'pointer',
    transition: 'border-color 0.12s ease, background 0.12s ease',
    userSelect: 'none',
  },
  serviceInnerSelected: { borderColor: '#c9820a', background: '#fdf3dc' },
  serviceName: { fontSize: '0.88rem', fontWeight: 500, color: '#1a1207', marginBottom: 4, lineHeight: 1.2 },
  serviceNameSelected: { color: '#7a4e04' },
  serviceMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  servicePrice: { fontFamily: 'Syne, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#1a1207' },
  servicePriceSelected: { color: '#7a4e04' },
  serviceTime: { fontSize: '0.72rem', color: '#c4b49a' },

  waitBar: {
    background: '#f2ead8', border: '1px solid #e8dcc8', borderRadius: 10,
    padding: '0.9rem 1rem', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '1.5rem',
  },
  waitLabel: { fontSize: '0.82rem', color: '#6b5e47' },
  waitValue: { fontFamily: 'Syne, sans-serif', fontSize: '1.05rem', fontWeight: 700, color: '#1a1207' },

  submitError: {
    background: '#fdf0ee', border: '1px solid #f5c4b3', borderRadius: 8,
    padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#b53a2a',
    marginBottom: '1rem',
  },

  btn: {
    width: '100%', height: 52, background: '#1a1207', color: '#faf6f0',
    border: 'none', borderRadius: 10, fontFamily: 'Syne, sans-serif',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  btnSpinner: {
    width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
  },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
  body { margin: 0; background: #faf6f0; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #5cdd8b; animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-spin { animation: spin 0.7s linear infinite; }
`
