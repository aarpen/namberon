'use client'

import { useState, useEffect, useRef, use } from 'react';
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const SERVICES = {
  haircut:       { label: 'Haircut',         price: 80,  duration: 20 },
  shave:         { label: 'Shave',           price: 50,  duration: 15 },
  beard_trim:    { label: 'Beard trim',      price: 60,  duration: 15 },
  haircut_shave: { label: 'Haircut + Shave', price: 120, duration: 30 },
  champi:        { label: 'Champi',          price: 80,  duration: 20 },
  facial:        { label: 'Facial',          price: 150, duration: 40 },
  hair_color:    { label: 'Hair color',      price: 200, duration: 45 },
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 520
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch (e) {}
}

export default function QueuePage({ params }) {
  const { id } = use(params);

  const [entry, setEntry] = useState(null)
  const [ahead, setAhead] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const prevStatus = useRef(null)

  // Refresh ahead list
  async function refreshAhead(shopId, tokenNumber) {
    const res = await fetch(`/api/queue/state?shop_id=${shopId}`)
    const data = await res.json()
    if (data.waiting) {
      const aheadEntries = [...(data.serving ? [data.serving] : []), ...data.waiting]
        .filter(e => e.token_number < tokenNumber)
      setAhead(aheadEntries)
    }
  }

  // Initial load via API route
  useEffect(() => {
    if (!id) return

    fetch(`/api/queue/entry?id=${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setNotFound(true); return }
        setEntry(data.entry)
        setAhead(data.ahead || [])
        prevStatus.current = data.entry.status
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // Real-time subscription via Supabase
  useEffect(() => {
    if (!entry) return

    const channel = supabase
      .channel(`queue-${entry.shop_id}-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue_entries',
          filter: `shop_id=eq.${entry.shop_id}`,
        },
        async (payload) => {
          const updated = payload.new

          // Our own entry updated
          if (updated.id === id) {
            setEntry(updated)
            if (prevStatus.current !== 'serving' && updated.status === 'serving') {
              beep()
              setTimeout(beep, 900)
            }
            prevStatus.current = updated.status
          }

          // Refresh ahead list on any queue change
          await refreshAhead(entry.shop_id, entry.token_number)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [entry, id])

  // ── Render states ──

  if (loading) return (
    <div style={styles.centered}>
      <div className="spinner" />
    </div>
  )

  if (notFound) return (
    <div style={styles.centered}>
      <p style={styles.errorMsg}>Token not found. Please rejoin the queue.</p>
    </div>
  )

  const tokenStr = `N-${String(entry.token_number).padStart(2, '0')}`
  const waitMinutes = ahead.reduce((sum, e) => sum + (e.service_duration || 0), 0)
  const isServing = entry.status === 'serving'
  const isDone = entry.status === 'done' || entry.status === 'skipped'
  const isWaiting = entry.status === 'waiting'
  const svc = SERVICES[entry.service]

  return (
    <>
      <style>{css}</style>

      <header style={styles.header}>
        <div style={styles.brand}>Namber<span style={styles.brandAccent}>One</span></div>
        {isServing && <div style={styles.nowBadge}>Your turn!</div>}
        {isWaiting && <div style={styles.waitingBadge}>Waiting</div>}
        {isDone && <div style={styles.doneBadge}>Done</div>}
      </header>

      <main style={styles.main}>

        <div style={{
          ...styles.tokenCircle,
          ...(isServing ? styles.tokenCircleServing : {}),
          ...(isDone ? styles.tokenCircleDone : {}),
        }} className={isServing ? 'token-pulse' : ''}>
          <span style={styles.tokenSmall}>your token</span>
          <span style={styles.tokenNumber}>{tokenStr}</span>
        </div>

        {isServing && (
          <div style={styles.servingAlert}>
            Aapka number aa gaya! Barber ke paas jao.
          </div>
        )}

        {isDone && (
          <div style={styles.doneMsg}>
            {entry.status === 'done' ? 'Service complete. Shukriya!' : 'Aapka token skip ho gaya.'}
          </div>
        )}

        <div style={styles.detailsCard}>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Name</span>
            <span style={styles.detailVal}>{entry.customer_name}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Service</span>
            <span style={styles.detailVal}>{svc?.label} — ₹{entry.service_price}</span>
          </div>
          {isWaiting && (
            <>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Position</span>
                <span style={styles.detailVal}>{ahead.length + 1} in queue</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailKey}>Est. wait</span>
                <span style={styles.detailVal}>~{waitMinutes} min</span>
              </div>
            </>
          )}
          {isServing && (
            <div style={styles.detailRow}>
              <span style={styles.detailKey}>Status</span>
              <span style={{ ...styles.detailVal, color: '#1a6b3a' }}>Being served now</span>
            </div>
          )}
        </div>

        {isWaiting && ahead.length > 0 && (
          <div style={styles.aheadSection}>
            <p style={styles.aheadTitle}>{ahead.length} log aage hain</p>
            <div style={styles.aheadList}>
              {ahead.map((a) => (
                <div key={a.id} style={styles.aheadRow}>
                  <span style={styles.aheadToken}>
                    N-{String(a.token_number).padStart(2, '0')}
                  </span>
                  <span style={styles.aheadStatus}>
                    {a.status === 'serving' ? 'Being served' : `~${a.service_duration} min`}
                  </span>
                </div>
              ))}
              <div style={{ ...styles.aheadRow, background: '#fdf3dc', borderRadius: 8 }}>
                <span style={{ ...styles.aheadToken, color: '#7a4e04', fontWeight: 700 }}>
                  {tokenStr}
                </span>
                <span style={{ ...styles.aheadStatus, color: '#c9820a' }}>You</span>
              </div>
            </div>
          </div>
        )}

        {isWaiting && (
          <p style={styles.hint}>
            Tab open rakhna. Jab aapka number aayega, yeh page alert karega aur beep bajega.
          </p>
        )}

      </main>
    </>
  )
}

const styles = {
  centered: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#faf6f0',
  },
  errorMsg: { fontFamily: 'DM Sans, sans-serif', color: '#b53a2a', fontSize: 15 },
  header: {
    padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid #e8dcc8',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#faf6f0',
  },
  brand: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800,
    fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#1a1207',
  },
  brandAccent: { color: '#c9820a' },
  nowBadge: {
    fontSize: '0.78rem', fontWeight: 500, color: '#1a6b3a',
    background: '#eaf5ee', padding: '4px 10px', borderRadius: 100,
    border: '1px solid #c0dd97', fontFamily: 'DM Sans, sans-serif',
  },
  waitingBadge: {
    fontSize: '0.78rem', fontWeight: 500, color: '#7a4e04',
    background: '#fdf3dc', padding: '4px 10px', borderRadius: 100,
    border: '1px solid #f0d080', fontFamily: 'DM Sans, sans-serif',
  },
  doneBadge: {
    fontSize: '0.78rem', fontWeight: 500, color: '#6b5e47',
    background: '#f2ead8', padding: '4px 10px', borderRadius: 100,
    border: '1px solid #e8dcc8', fontFamily: 'DM Sans, sans-serif',
  },
  main: {
    padding: '2rem 1.5rem 3rem', maxWidth: 480,
    width: '100%', margin: '0 auto', fontFamily: 'DM Sans, sans-serif',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  tokenCircle: {
    width: 150, height: 150, borderRadius: '50%', background: '#1a1207',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', marginBottom: '1.75rem',
  },
  tokenCircleServing: { background: '#1a6b3a' },
  tokenCircleDone: { background: '#888780' },
  tokenSmall: {
    fontSize: '0.68rem', color: '#c4b49a', textTransform: 'uppercase',
    letterSpacing: '0.1em', marginBottom: 2,
  },
  tokenNumber: {
    fontFamily: 'Syne, sans-serif', fontSize: '2.8rem',
    fontWeight: 800, color: '#faf6f0', letterSpacing: '-0.03em', lineHeight: 1,
  },
  servingAlert: {
    background: '#eaf5ee', border: '1px solid #c0dd97', borderRadius: 10,
    padding: '0.9rem 1.1rem', fontSize: '0.95rem', color: '#1a6b3a',
    fontWeight: 500, textAlign: 'center', marginBottom: '1.5rem', width: '100%',
  },
  doneMsg: {
    background: '#f2ead8', border: '1px solid #e8dcc8', borderRadius: 10,
    padding: '0.9rem 1.1rem', fontSize: '0.9rem', color: '#6b5e47',
    textAlign: 'center', marginBottom: '1.5rem', width: '100%',
  },
  detailsCard: {
    width: '100%', background: '#f2ead8', border: '1px solid #e8dcc8',
    borderRadius: 14, overflow: 'hidden', marginBottom: '1.5rem',
  },
  detailRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.8rem 1.1rem', fontSize: '0.88rem',
    borderBottom: '1px solid #e8dcc8',
  },
  detailKey: { color: '#6b5e47' },
  detailVal: {
    fontWeight: 500, color: '#1a1207',
    fontFamily: 'Syne, sans-serif', fontSize: '0.9rem',
  },
  aheadSection: { width: '100%', marginBottom: '1.5rem' },
  aheadTitle: {
    fontSize: '0.78rem', fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#6b5e47', marginBottom: '0.6rem',
  },
  aheadList: { display: 'flex', flexDirection: 'column', gap: 4 },
  aheadRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '0.6rem 0.9rem',
  },
  aheadToken: {
    fontFamily: 'Syne, sans-serif', fontSize: '0.9rem',
    fontWeight: 500, color: '#1a1207',
  },
  aheadStatus: { fontSize: '0.8rem', color: '#6b5e47' },
  hint: {
    fontSize: '0.8rem', color: '#c4b49a', lineHeight: 1.6,
    textAlign: 'center', maxWidth: 280,
  },
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
  body { margin: 0; background: #faf6f0; }
  .spinner { width: 28px; height: 28px; border: 2.5px solid #e8dcc8; border-top-color: #1a1207; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(26,107,58,0.4); } 70% { box-shadow: 0 0 0 20px rgba(26,107,58,0); } 100% { box-shadow: 0 0 0 0 rgba(26,107,58,0); } }
  .token-pulse { animation: pulse-ring 1.5s ease-out infinite; }
`
