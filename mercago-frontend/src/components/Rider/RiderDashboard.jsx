import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL, POLL_INTERVAL_MS } from '../../config'
import OrderCard from '../UI/OrderCard'
import EditProfileModal from '../UI/EditProfileModal'

export default function RiderDashboard({ currentUser, token, onLogout }) {
  const [riderTab, setRiderTab] = useState('available')
  
  const [availableOrders, setAvailableOrders] = useState([])
  const [myDeliveries, setMyDeliveries] = useState([])
  const [ledger, setLedger] = useState(null)    // { outstanding, max_abono, entries, total_advances, total_collections }
  const [abonoBlocked, setAbonoBlocked] = useState(false)
  const [abonoMsg, setAbonoMsg] = useState('')
  const [newMaxAbono, setNewMaxAbono] = useState('')
  const [savingAbono, setSavingAbono] = useState(false)
  const [riderLoading, setRiderLoading] = useState(false)
  const [riderMessage, setRiderMessage] = useState('')
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [user, setUser] = useState(currentUser)
  
  const prevAvailableCount = useRef(0)
  const pollRef = useRef(null)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const fetchAvailableOrders = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/orders`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      // Handle abono-blocked response (API returns object with abono_blocked flag)
      if (data.abono_blocked) {
        setAbonoBlocked(true)
        setAbonoMsg(data.message)
        setAvailableOrders([])
        return
      }
      setAbonoBlocked(false)
      setAbonoMsg('')
      const list = Array.isArray(data) ? data : []
      if (list.length > prevAvailableCount.current) {
        setNewOrderAlert(true)
        setTimeout(() => setNewOrderAlert(false), 4000)
      }
      prevAvailableCount.current = list.length
      setAvailableOrders(list)
    } catch { /* silent */ }
  }

  const fetchMyDeliveries = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/my-deliveries`, { headers: authHeaders })
      if (!res.ok) return
      const d = await res.json()
      setMyDeliveries(Array.isArray(d) ? d : [])
    } catch { /* silent */ }
  }

  const fetchLedger = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/ledger`, { headers: authHeaders })
      if (!res.ok) return
      setLedger(await res.json())
    } catch { /* silent */ }
  }

  const handleAcceptOrder = async (orderId) => {
    setRiderLoading(true); setRiderMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/orders/${orderId}/accept`, { method: 'POST', headers: authHeaders })
      const d = await res.json()
      setRiderMessage(res.ok ? `✅ ${d.message}` : `❌ ${d.message}`)
      if (res.ok) { setRiderTab('my-deliveries'); await Promise.all([fetchAvailableOrders(), fetchMyDeliveries()]) }
    } catch { setRiderMessage('❌ Unable to accept.') }
    finally { setRiderLoading(false) }
  }

  const handleDeclineOrder = async (orderId) => {
    setRiderLoading(true); setRiderMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/orders/${orderId}/decline`, { method: 'POST', headers: authHeaders })
      const d = await res.json()
      setRiderMessage(res.ok ? `⚠️ ${d.message}` : `❌ ${d.message}`)
      if (res.ok) await fetchAvailableOrders()
    } catch { setRiderMessage('❌ Unable to decline.') }
    finally { setRiderLoading(false) }
  }

  const handleCompleteDelivery = async (orderId) => {
    setRiderLoading(true); setRiderMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/orders/${orderId}/complete`, { method: 'POST', headers: authHeaders })
      const d = await res.json()
      setRiderMessage(res.ok ? `✅ ${d.message}` : `❌ ${d.message}`)
      if (res.ok) { await fetchMyDeliveries(); await fetchLedger() }
    } catch { setRiderMessage('❌ Unable to complete.') }
    finally { setRiderLoading(false) }
  }

  const handleSaveMaxAbono = async (e) => {
    e.preventDefault()
    setSavingAbono(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/rider/abono-settings`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ max_abono: parseFloat(newMaxAbono) }),
      })
      const d = await res.json()
      if (res.ok) {
        setUser(u => ({ ...u, max_abono: d.max_abono }))
        setNewMaxAbono('')
        await fetchLedger()
      }
    } catch { /* silent */ }
    finally { setSavingAbono(false) }
  }

  useEffect(() => {
    if (!token) return
    fetchAvailableOrders()
    fetchMyDeliveries()
    fetchLedger()
    pollRef.current = setInterval(fetchAvailableOrders, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [token])

  const outstanding = ledger?.outstanding ?? 0
  const maxAbono = ledger?.max_abono ?? user?.max_abono ?? 500

  return (
    <section>
      <div className="dashboard-head">
        <div>
          <h2>Rider Dashboard</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {user.first_name} {user.last_name} &bull; <em>rider</em>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-btn" onClick={() => setShowProfileModal(true)}>Edit Profile</button>
          <button type="button" className="secondary-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {showProfileModal && (
        <EditProfileModal
          currentUser={user}
          token={token}
          API_BASE_URL={API_BASE_URL}
          onClose={() => setShowProfileModal(false)}
          onUpdate={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {newOrderAlert && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontWeight: 600, color: '#92400e' }}>
          🔔 New order available!
        </div>
      )}

      {/* Abono Cap Warning Bar */}
      {abonoBlocked && (
        <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontWeight: 600 }}>
          🚫 {abonoMsg}
        </div>
      )}

      {riderMessage && (
        <p style={{ fontWeight: 'bold', marginBottom: '1rem', color: riderMessage.startsWith('✅') ? '#059669' : riderMessage.startsWith('⚠️') ? '#b45309' : '#ef4444' }}>
          {riderMessage}
        </p>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={riderTab === 'available' ? 'tab active' : 'tab'} type="button"
          onClick={() => { setRiderTab('available'); fetchAvailableOrders() }}>
          Available Orders {availableOrders.length > 0 ? `(${availableOrders.length})` : ''}
        </button>
        <button className={riderTab === 'my-deliveries' ? 'tab active' : 'tab'} type="button"
          onClick={() => { setRiderTab('my-deliveries'); fetchMyDeliveries() }}>
          My Deliveries
        </button>
        <button className={riderTab === 'abono' ? 'tab active' : 'tab'} type="button"
          onClick={() => { setRiderTab('abono'); fetchLedger() }}>
          💰 Abono
        </button>
      </div>

      {riderTab === 'available' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>🔄 Auto-refreshing every 5 seconds</p>
            <button type="button" className="secondary-btn" onClick={fetchAvailableOrders} disabled={riderLoading}>Refresh Now</button>
          </div>
          {abonoBlocked
            ? <p className="empty-note">⛔ Accept orders is blocked until you complete pending deliveries to reduce your Abono balance.</p>
            : availableOrders.length === 0
              ? <p className="empty-note">No available orders right now.</p>
              : availableOrders.map((order) => (
                <OrderCard key={order.order_id} order={order}
                  showActions="pending"
                  onAccept={handleAcceptOrder}
                  onDecline={handleDeclineOrder}
                />
              ))
          }
        </>
      )}

      {riderTab === 'my-deliveries' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>My Deliveries</h3>
            <button type="button" className="secondary-btn" onClick={fetchMyDeliveries}>Refresh</button>
          </div>
          {myDeliveries.length === 0
            ? <p className="empty-note">No deliveries yet.</p>
            : myDeliveries.map((order) => (
              <OrderCard key={order.order_id} order={order}
                showActions={order.delivery_status === 'ongoing' ? 'ongoing' : null}
                onComplete={handleCompleteDelivery}
              />
            ))}
        </>
      )}

      {riderTab === 'abono' && (
        <>
          {/* Balance Summary Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
            {[
              { label: 'Outstanding Balance', value: `₱${Number(outstanding).toFixed(2)}`, color: outstanding > 0 ? '#dc2626' : '#059669', bg: outstanding > 0 ? '#fef2f2' : '#f0fdf4', icon: '💸' },
              { label: 'Total Advanced', value: `₱${Number(ledger?.total_advances ?? 0).toFixed(2)}`, color: '#9333ea', bg: '#faf5ff', icon: '📤' },
              { label: 'Total Collected', value: `₱${Number(ledger?.total_collections ?? 0).toFixed(2)}`, color: '#059669', bg: '#f0fdf4', icon: '📥' },
              { label: 'Abono Cap', value: `₱${Number(maxAbono).toFixed(2)}`, color: outstanding >= maxAbono ? '#dc2626' : '#2563eb', bg: '#eff6ff', icon: '🏦' },
            ].map(card => (
              <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}30`, borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{card.icon}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Abono Cap progress bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#6b7280', marginBottom: 6 }}>
              <span>Abono Used</span>
              <span>{Math.min(100, Math.round((outstanding / maxAbono) * 100))}% of ₱{Number(maxAbono).toFixed(2)}</span>
            </div>
            <div style={{ height: 12, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, transition: 'width 0.4s ease',
                width: `${Math.min(100, (outstanding / maxAbono) * 100)}%`,
                background: outstanding >= maxAbono ? '#dc2626' : outstanding >= maxAbono * 0.75 ? '#f59e0b' : '#10b981',
              }} />
            </div>
          </div>

          {/* Update Abono Cap */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>🏦 Update My Abono Cap</h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#6b7280' }}>
              Set the maximum cash advance you're willing to carry. Minimum ₱1, maximum ₱10,000.
            </p>
            <form onSubmit={handleSaveMaxAbono} style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" min="1" max="10000" step="0.01" placeholder={`Current: ₱${Number(maxAbono).toFixed(2)}`}
                value={newMaxAbono} onChange={e => setNewMaxAbono(e.target.value)} required
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
              />
              <button type="submit" disabled={savingAbono}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {savingAbono ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>

          {/* Ledger History */}
          <h4 style={{ margin: '0 0 10px' }}>📒 Transaction History</h4>
          {!ledger || ledger.entries.length === 0
            ? <p className="empty-note">No abono transactions yet. Accept and complete an order to see entries here.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.entries.map(entry => (
                      <tr key={entry.id}>
                        <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{entry.created_at}</td>
                        <td>
                          <span style={{
                            fontWeight: 700, fontSize: '0.8rem', padding: '3px 8px', borderRadius: 10,
                            background: entry.type === 'advance' ? '#fef2f2' : '#f0fdf4',
                            color: entry.type === 'advance' ? '#dc2626' : '#059669',
                          }}>
                            {entry.type === 'advance' ? '📤 Advance' : '📥 Collection'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{entry.note}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: entry.type === 'advance' ? '#dc2626' : '#059669' }}>
                          {entry.type === 'advance' ? '-' : '+'}₱{Number(entry.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}
    </section>
  )
}
