import { useState } from 'react'
import { API_BASE_URL, TOKEN_KEY } from '../../config'
import StripeContainer from './StripeContainer'

const GATEWAYS = [
  { id: 'gcash', label: 'GCash', color: '#0070FF', icon: '💙', description: 'Pay via GCash mobile wallet' },
  { id: 'maya', label: 'Maya', color: '#00BFA5', icon: '💚', description: 'Pay via Maya (formerly PayMaya)' },
  { id: 'stripe', label: 'Credit / Debit Card', color: '#6366f1', icon: '💳', description: 'Secure card payment via Stripe' },
]

/**
 * PaymentModal — handles both mock payments and real Stripe Test Mode.
 *
 * Props:
 *   gateway    - 'gcash' | 'maya' | 'stripe'
 *   amount     - number (total to pay)
 *   orderId    - string (required for Stripe)
 *   onSuccess  - callback when payment is confirmed
 *   onCancel   - callback when modal is dismissed
 */
export default function PaymentModal({ gateway, amount, orderId, onSuccess, onCancel }) {
  const gw = GATEWAYS.find(g => g.id === gateway) || GATEWAYS[0]
  const [step, setStep] = useState(gateway === 'stripe' ? 'stripe' : 'pin')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handlePinSubmit = (e) => {
    e.preventDefault()
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return }
    setError('')
    setStep('processing')
    setTimeout(() => setStep('success'), 2000)
  }

  const handleStripeSuccess = async (paymentIntentId) => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`${API_BASE_URL}/api/payments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ order_id: orderId, payment_intent_id: paymentIntentId })
      });

      if (response.ok) {
        setStep('success');
      } else {
        setError('Payment confirmed by Stripe but failed to update order status.');
      }
    } catch (err) {
      setError('Verification error. Please check your order history.');
    }
  }

  // Auto-redirect on success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        onSuccess()
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [step, onSuccess])

  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="pm-header" style={{ background: `linear-gradient(135deg, ${gw.color}, ${gw.color}dd)` }}>
          <button className="pm-close" onClick={onCancel} type="button" aria-label="Close">✕</button>
          <div className="pm-header-icon">{gw.icon}</div>
          <div className="pm-header-title">{gw.label}</div>
          <div className="pm-header-sub">
            {gateway === 'stripe' ? 'SECURE STRIPE CHECKOUT' : 'MOCK PAYMENT SIMULATOR'}
          </div>
        </div>

        <div className="pm-body">
          {/* Amount */}
          <div className="pm-amount-box">
            <span className="pm-amount-label">Amount to Pay</span>
            <span className="pm-amount-value">₱{Number(amount).toFixed(2)}</span>
            <span className={`pm-badge ${gateway === 'stripe' ? 'pm-badge-secure' : 'pm-badge-sim'}`}>
              {gateway === 'stripe' ? '🛡️ Secure SSL Encrypted' : '⚠️ SIMULATION — No real money charged'}
            </span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="pm-error-banner">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* ── Stripe step ── */}
          {step === 'stripe' && (
            <StripeContainer
              orderId={orderId}
              amount={amount}
              onPaymentSuccess={handleStripeSuccess}
              onCancel={onCancel}
            />
          )}

          {/* ── PIN step (GCash / Maya) ── */}
          {step === 'pin' && (
            <form onSubmit={handlePinSubmit} className="pm-pin-form">
              <label className="pm-label">Enter your {gw.label} PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="● ● ● ● ● ●"
                className={`pm-pin-input ${error ? 'pm-pin-error' : ''}`}
                style={{ '--gw-color': gw.color }}
                autoFocus
              />
              <p className="pm-hint">Hint: Any 4–6 digit PIN works in this simulation.</p>

              <button type="submit" className="pm-btn-primary" style={{ background: gw.color }}>
                Confirm Payment
              </button>
              <button type="button" onClick={onCancel} className="pm-btn-secondary">
                Cancel
              </button>
            </form>
          )}

          {/* ── Processing step ── */}
          {step === 'processing' && (
            <div className="pm-state-box">
              <div className="pm-spinner-ring" style={{ borderTopColor: gw.color }}></div>
              <p className="pm-state-title">Processing Payment…</p>
              <p className="pm-state-sub">Please wait, do not close this window.</p>
            </div>
          )}

          {/* ── Success step ── */}
          {step === 'success' && (
            <div className="pm-state-box">
              <div className="pm-success-check">
                <svg viewBox="0 0 52 52" className="pm-checkmark">
                  <circle className="pm-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                  <path className="pm-checkmark-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                </svg>
              </div>
              <p className="pm-state-title" style={{ color: '#10b981' }}>Payment Successful!</p>
              <p className="pm-state-sub">
                Your payment of <strong>₱{Number(amount).toFixed(2)}</strong> has been processed.
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '12px 0' }}>
                Redirecting to your orders in 3s...
              </p>
              <button onClick={onSuccess} className="pm-btn-primary" style={{ background: '#10b981' }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* ── Overlay ── */
        .pm-overlay {
          position: fixed; inset: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center;
          z-index: 3000;
          padding: 16px;
        }

        /* ── Card ── */
        .pm-card {
          background: #fff;
          border-radius: 20px;
          width: 100%; max-width: 420px;
          overflow: hidden;
          box-shadow: 0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          animation: pmSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes pmSlideUp {
          from { transform: translateY(30px) scale(0.97); opacity: 0; }
          to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }

        /* ── Header ── */
        .pm-header {
          position: relative;
          padding: 28px 24px 24px;
          text-align: center; color: #fff;
        }
        .pm-close {
          position: absolute; top: 12px; right: 14px;
          background: rgba(255,255,255,0.2); border: none;
          color: #fff; width: 30px; height: 30px; border-radius: 50%;
          font-size: 0.85rem; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .pm-close:hover { background: rgba(255,255,255,0.35); }
        .pm-header-icon { font-size: 2.4rem; margin-bottom: 6px; }
        .pm-header-title { font-weight: 800; font-size: 1.45rem; letter-spacing: -0.02em; }
        .pm-header-sub {
          font-size: 0.65rem; font-weight: 700; opacity: 0.75;
          margin-top: 4px; letter-spacing: 0.12em; text-transform: uppercase;
        }

        /* ── Body ── */
        .pm-body { padding: 28px 24px 24px; }

        /* ── Amount ── */
        .pm-amount-box {
          text-align: center; margin-bottom: 24px;
          padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;
        }
        .pm-amount-label {
          display: block; font-size: 0.72rem; font-weight: 700; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;
        }
        .pm-amount-value {
          display: block; font-size: 2.4rem; font-weight: 900; color: #0f172a;
          letter-spacing: -0.03em; line-height: 1.15;
        }
        .pm-badge {
          display: inline-block; font-size: 0.68rem; font-weight: 700;
          padding: 4px 12px; border-radius: 20px; margin-top: 8px;
        }
        .pm-badge-sim  { background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; }
        .pm-badge-secure { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

        /* ── Error ── */
        .pm-error-banner {
          background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
          border-radius: 12px; padding: 10px 14px; font-size: 0.82rem;
          font-weight: 600; margin-bottom: 16px; text-align: center;
        }

        /* ── PIN form ── */
        .pm-pin-form { display: flex; flex-direction: column; gap: 0; }
        .pm-label {
          font-size: 0.82rem; font-weight: 700; color: #334155;
          margin-bottom: 8px;
        }
        .pm-pin-input {
          width: 100%; box-sizing: border-box;
          padding: 16px; font-size: 1.6rem; letter-spacing: 0.5em;
          text-align: center; border: 2px solid #e2e8f0; border-radius: 14px;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
          font-family: inherit; color: #0f172a; background: #f8fafc;
        }
        .pm-pin-input:focus {
          border-color: var(--gw-color, #6366f1);
          box-shadow: 0 0 0 4px color-mix(in srgb, var(--gw-color, #6366f1) 12%, transparent);
          background: #fff;
        }
        .pm-pin-input.pm-pin-error { border-color: #ef4444; }
        .pm-hint {
          font-size: 0.72rem; color: #94a3b8; margin: 8px 0 0;
          font-weight: 500; text-align: center;
        }

        /* ── Buttons ── */
        .pm-btn-primary {
          width: 100%; color: #fff; border: none; border-radius: 14px;
          padding: 15px; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; margin-top: 20px;
          transition: transform 0.15s, filter 0.15s, box-shadow 0.15s;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
          font-family: inherit;
        }
        .pm-btn-primary:hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        .pm-btn-primary:active { transform: translateY(0) scale(0.98); }
        .pm-btn-primary:disabled {
          opacity: 0.55; cursor: not-allowed;
          transform: none; filter: none;
        }

        .pm-btn-secondary {
          width: 100%; background: #f1f5f9; color: #64748b;
          border: 1px solid #e2e8f0; border-radius: 14px;
          padding: 13px; font-size: 0.88rem; font-weight: 600;
          cursor: pointer; margin-top: 10px; transition: background 0.15s;
          font-family: inherit;
        }
        .pm-btn-secondary:hover { background: #e2e8f0; }

        /* ── State boxes (processing / success) ── */
        .pm-state-box { text-align: center; padding: 12px 0 8px; }
        .pm-state-title {
          font-weight: 800; font-size: 1.2rem; color: #1e293b;
          margin: 0 0 6px;
        }
        .pm-state-sub {
          font-size: 0.85rem; color: #64748b; margin: 0 0 4px;
          line-height: 1.5;
        }

        /* ── Spinner ── */
        .pm-spinner-ring {
          width: 52px; height: 52px; border-radius: 50%;
          border: 4px solid #e2e8f0; border-top-width: 4px;
          animation: pmSpin 0.85s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes pmSpin { to { transform: rotate(360deg); } }

        /* ── Animated checkmark ── */
        .pm-success-check { width: 64px; height: 64px; margin: 0 auto 18px; }
        .pm-checkmark { width: 100%; height: 100%; }
        .pm-checkmark-circle {
          stroke: #10b981; stroke-width: 2;
          stroke-dasharray: 166; stroke-dashoffset: 166;
          animation: pmCircle 0.6s cubic-bezier(0.65,0,0.45,1) forwards;
        }
        .pm-checkmark-path {
          stroke: #10b981; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 48; stroke-dashoffset: 48;
          animation: pmCheck 0.35s cubic-bezier(0.65,0,0.45,1) 0.4s forwards;
        }
        @keyframes pmCircle { to { stroke-dashoffset: 0; } }
        @keyframes pmCheck  { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  )
}
