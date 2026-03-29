'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SERVICES = {
  haircut: { label: 'Haircut', price: 80, duration: 20 },
  shave: { label: 'Shave', price: 50, duration: 15 },
  beard_trim: { label: 'Beard Trim', price: 60, duration: 15 },
  champi: { label: 'Champi', price: 80, duration: 20 },
  haircut_shave: { label: 'Haircut + Shave', price: 120, duration: 30 },
  facial: { label: 'Facial', price: 150, duration: 40 },
  hair_color: { label: 'Hair Color', price: 200, duration: 45 },
};

export default function Dashboard({ params }) {
  const { secret } = use(params);
  const [shop, setShop] = useState(null);
  const [serving, setServing] = useState(null);
  const [waiting, setWaiting] = useState([]);
  const [done, setDone] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load shop via API
  useEffect(() => {
    async function init() {
      const res = await fetch(`/api/shop?secret_id=${secret}`);
      const data = await res.json();
      if (data.error) {
        setError('Invalid dashboard link.');
        setLoading(false);
        return;
      }
      setShop(data.shop);
      setLoading(false);
    }
    init();
  }, [secret]);

  // Load queue state + subscribe once shop is loaded
  useEffect(() => {
    if (!shop) return;

    async function fetchState() {
      const res = await fetch(`/api/queue/state?shop_id=${shop.id}`);
      const data = await res.json();
      if (!data.error) {
        setServing(data.serving);
        setWaiting(data.waiting || []);
        setDone(data.done || []);
      }
    }

    fetchState();

    const channel = supabase
      .channel(`dashboard-${shop.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_entries',
        filter: `shop_id=eq.${shop.id}`,
      }, () => fetchState())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [shop]);

 const handleAction = async (action) => {
  if (!shop) return;   // ← add this line
  setActionLoading(true);
  const res = await fetch('/api/queue/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shop.id, secret_id: secret, action }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (data.error) {
      showToast(data.error, 'error');
    } else {
      showToast(action === 'next' ? 'Next customer called!' : 'Token skipped.');
    }
  };

  const totalEarnings = done.reduce((sum, e) => {
    return sum + (SERVICES[e.service]?.price || 0);
  }, 0);

  if (loading) return (
    <div style={styles.loadingScreen}>
      <div style={styles.loadingDot} />
    </div>
  );

  if (error) return (
    <div style={styles.errorScreen}>
      <p style={styles.errorText}>{error}</p>
    </div>
  );

  const queueLength = waiting.length + (serving ? 1 : 0);

  return (
    <div style={styles.root}>
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === 'error' ? '#ef4444' : '#1a1a1a' }}>
          {toast.msg}
        </div>
      )}

      <header style={styles.header}>
        <div>
          <p style={styles.headerLabel}>OWNER DASHBOARD</p>
          <h1 style={styles.shopName}>{shop.shop_name}</h1>
        </div>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <span style={styles.statNum}>{done.length}</span>
            <span style={styles.statLabel}>Done</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNum}>₹{totalEarnings}</span>
            <span style={styles.statLabel}>Earned</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNum}>{queueLength}</span>
            <span style={styles.statLabel}>In Queue</span>
          </div>
        </div>
      </header>

      <section style={styles.currentSection}>
        <p style={styles.sectionLabel}>NOW SERVING</p>
        {serving ? (
          <div style={styles.servingCard}>
            <div style={styles.servingLeft}>
              <span style={styles.servingToken}>
                N-{String(serving.token_number).padStart(2, '0')}
              </span>
              <div>
                <p style={styles.servingName}>{serving.customer_name}</p>
                <p style={styles.servingService}>
                  {SERVICES[serving.service]?.label} — ₹{SERVICES[serving.service]?.price}
                </p>
              </div>
            </div>
            <div style={styles.actionButtons}>
              <button
                style={{ ...styles.btn, ...styles.btnSkip }}
                onClick={() => handleAction('skip')}
                disabled={actionLoading}
              >
                Skip
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnNext }}
                onClick={() => handleAction('next')}
                disabled={actionLoading}
              >
                {actionLoading ? '...' : 'Next →'}
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.emptyServing}>
            {waiting.length > 0 ? (
              <>
                <p style={styles.emptyText}>No one is being served yet.</p>
                <button
                  style={{ ...styles.btn, ...styles.btnNext, marginTop: 12 }}
                  onClick={() => handleAction('next')}
                  disabled={actionLoading}
                >
                  Call First Customer →
                </button>
              </>
            ) : (
              <p style={styles.emptyText}>Queue is empty. Waiting for customers.</p>
            )}
          </div>
        )}
      </section>

      <section style={styles.queueSection}>
        <p style={styles.sectionLabel}>WAITING — {waiting.length}</p>
        {waiting.length === 0 ? (
          <p style={styles.emptyText}>No one waiting.</p>
        ) : (
          <div style={styles.queueList}>
            {waiting.map((entry, i) => {
              const waitMins = waiting
                .slice(0, i)
                .reduce((s, e) => s + (SERVICES[e.service]?.duration || 20), 0)
                + (serving ? SERVICES[serving.service]?.duration || 20 : 0);
              return (
                <div key={entry.id} style={styles.queueRow}>
                  <div style={styles.queueLeft}>
                    <span style={styles.queueToken}>
                      N-{String(entry.token_number).padStart(2, '0')}
                    </span>
                    <div>
                      <p style={styles.queueName}>{entry.customer_name}</p>
                      <p style={styles.queueService}>{SERVICES[entry.service]?.label}</p>
                    </div>
                  </div>
                  <div style={styles.queueRight}>
                    <span style={styles.queueWait}>~{waitMins} min</span>
                    <span style={styles.queuePrice}>₹{SERVICES[entry.service]?.price}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section style={styles.doneSection}>
          <p style={styles.sectionLabel}>COMPLETED TODAY — {done.length}</p>
          <div style={styles.doneList}>
            {done.map((entry) => (
              <div key={entry.id} style={styles.doneRow}>
                <span style={styles.doneName}>{entry.customer_name}</span>
                <span style={styles.doneService}>{SERVICES[entry.service]?.label}</span>
                <span style={styles.donePrice}>₹{SERVICES[entry.service]?.price}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#f5f0e8',
    fontFamily: "'DM Mono', 'Courier New', monospace",
    paddingBottom: 60,
  },
  loadingScreen: {
    minHeight: '100vh',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#f5f0e8',
  },
  errorScreen: {
    minHeight: '100vh',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontFamily: "'DM Mono', monospace",
    fontSize: 16,
  },
  toast: {
    position: 'fixed',
    top: 20,
    right: 20,
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 8,
    fontFamily: "'DM Mono', monospace",
    fontSize: 14,
    zIndex: 999,
  },
  header: {
    background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    color: '#666',
    margin: '0 0 4px 0',
  },
  shopName: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
  },
  statsRow: { display: 'flex', gap: 16 },
  statBox: {
    background: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 64,
  },
  statNum: { fontSize: 20, fontWeight: 700, color: '#f5f0e8' },
  statLabel: { fontSize: 10, color: '#666', letterSpacing: '0.1em', marginTop: 2 },
  currentSection: { padding: '28px 24px 20px', borderBottom: '1px solid #1a1a1a' },
  sectionLabel: { fontSize: 10, letterSpacing: '0.15em', color: '#555', margin: '0 0 14px 0' },
  servingCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  servingLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  servingToken: { fontSize: 32, fontWeight: 700, color: '#f5f0e8', minWidth: 80 },
  servingName: { fontSize: 18, fontWeight: 600, margin: '0 0 2px 0' },
  servingService: { fontSize: 13, color: '#888', margin: 0 },
  actionButtons: { display: 'flex', gap: 10 },
  btn: {
    padding: '12px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
  },
  btnNext: { background: '#f5f0e8', color: '#0f0f0f' },
  btnSkip: { background: '#2a2a2a', color: '#888' },
  emptyServing: {
    background: '#1a1a1a',
    border: '1px dashed #2a2a2a',
    borderRadius: 12,
    padding: '24px 20px',
    textAlign: 'center',
  },
  emptyText: { color: '#555', fontSize: 14, margin: 0 },
  queueSection: { padding: '24px', borderBottom: '1px solid #1a1a1a' },
  queueList: { display: 'flex', flexDirection: 'column', gap: 8 },
  queueRow: {
    background: '#1a1a1a',
    border: '1px solid #222',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  queueToken: { fontSize: 18, fontWeight: 700, color: '#f5f0e8', minWidth: 52 },
  queueName: { fontSize: 15, fontWeight: 600, margin: '0 0 2px 0' },
  queueService: { fontSize: 12, color: '#666', margin: 0 },
  queueRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  queueWait: { fontSize: 13, color: '#888' },
  queuePrice: { fontSize: 13, color: '#f5f0e8', fontWeight: 600 },
  doneSection: { padding: '24px' },
  doneList: { display: 'flex', flexDirection: 'column', gap: 6 },
  doneRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#141414',
    borderRadius: 8,
    fontSize: 13,
  },
  doneName: { color: '#555', flex: 1 },
  doneService: { color: '#444', flex: 1, textAlign: 'center' },
  donePrice: { color: '#666', flex: 1, textAlign: 'right' },
};
