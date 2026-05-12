import { useState } from 'react'

const GATEWAYS = [
  { id: 'gcash', label: 'GCash', color: '#0070FF', icon: '💙', description: 'Pay via GCash mobile wallet' },
  { id: 'maya', label: 'Maya', color: '#00BFA5', icon: '💚', description: 'Pay via Maya (formerly PayMaya)' },
]

/**
 * MockPaymentModal — simulates a digital payment gateway flow.
 * This is a REPLICA for demonstration purposes only. No real transactions occur.
 *
 * Props:
 *   gateway    - 'gcash' | 'maya'
 *   amount     - number (total to pay)
 *   onSuccess  - callback when "payment" is confirmed
 *   onCancel   - callback when modal is dismissed
 */
export default function MockPaymentModal({ gateway, amount, onSuccess, onCancel }) {
  const gw = GATEWAYS.find(g => g.id === gateway) || GATEWAYS[0]
  const [step, setStep] = useState('pin') // 'pin' | 'processing' | 'success'
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handlePinSubmit = (e) => {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setError('')
    setStep('processing')
    // Simulate network delay
    setTimeout(() => setStep('success'), 2000)
  }

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 3000,
  }

  const cardStyle = {
    background: '#fff', borderRadius: '20px', width: '92%', maxWidth: 380,
    overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    fontFamily: 'Inter, sans-serif',
  }

  const headerStyle = {
    background: gw.color, padding: '24px 20px', textAlign: 'center', color: '#fff',
  }

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={headerStyle}>
          <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>{gw.icon}</div>
          <div style={{ fontWeight: 900, fontSize: '1.5rem', letterSpacing: 1 }}>{gw.label}</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: 4 }}>MOCK PAYMENT SIMULATOR</div>
        </div>

        <div style={{ padding: '24px 20px' }}>
          {/* Amount Display */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 4 }}>Amount to Pay</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#111' }}>
              ₱{Number(amount).toFixed(2)}
            </div>
            <div style={{
              display: 'inline-block', background: '#fef3c7', color: '#92400e',
              fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
              borderRadius: 20, marginTop: 6, border: '1px solid #fcd34d',
            }}>
              ⚠️ SIMULATION — No real money charged
            </div>
          </div>

          {step === 'pin' && (
            <form onSubmit={handlePinSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Enter {gw.label} PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '14px', fontSize: '1.5rem', letterSpacing: '0.5rem',
                    textAlign: 'center', border: `2px solid ${error ? '#ef4444' : '#d1d5db'}`,
                    borderRadius: 10, outline: 'none',
                  }}
                  autoFocus
                />
                {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '4px 0 0' }}>{error}</p>}
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '6px 0 0' }}>
                  Hint: Any 4-6 digit PIN works in this simulation.
                </p>
              </div>

              <button type="submit" style={{
                width: '100%', background: gw.color, color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px', fontSize: '1rem', fontWeight: 700,
                cursor: 'pointer', marginBottom: 10,
              }}>
                Confirm Payment
              </button>
              <button type="button" onClick={onCancel} style={{
                width: '100%', background: '#f3f4f6', color: '#374151', border: 'none',
                borderRadius: 10, padding: '12px', fontSize: '0.9rem', fontWeight: 600,
                cursor: 'pointer',
              }}>
                Cancel
              </button>
            </form>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
              <p style={{ fontWeight: 700, color: '#374151', marginTop: 12 }}>Processing Payment...</p>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Please wait, do not close this window.</p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: 10 }}>✅</div>
              <p style={{ fontWeight: 900, fontSize: '1.2rem', color: '#059669', margin: '0 0 8px' }}>
                Payment Successful!
              </p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 20px' }}>
                Your {gw.label} payment of <strong>₱{Number(amount).toFixed(2)}</strong> has been simulated successfully.
              </p>
              <button onClick={onSuccess} style={{
                background: '#059669', color: '#fff', border: 'none',
                borderRadius: 10, padding: '14px 32px', fontSize: '1rem',
                fontWeight: 700, cursor: 'pointer',
              }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
