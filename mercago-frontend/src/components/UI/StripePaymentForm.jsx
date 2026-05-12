import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const StripePaymentForm = ({ orderId, amount, onPaymentSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message);
      } else {
        setMessage('An unexpected error occurred.');
      }
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage('Payment succeeded!');
      onPaymentSuccess(paymentIntent.id);
    } else {
      setMessage('Payment processing…');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        id="payment-element"
        options={{ layout: 'tabs' }}
      />

      {message && (
        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 12,
          fontSize: '0.82rem',
          fontWeight: 600,
          textAlign: 'center',
          background: message.includes('succeeded') ? '#f0fdf4' : '#fef2f2',
          color: message.includes('succeeded') ? '#15803d' : '#b91c1c',
          border: `1px solid ${message.includes('succeeded') ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          type="submit"
          disabled={isLoading || !stripe || !elements}
          style={{
            flex: 1,
            padding: '14px 16px',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: '0.95rem',
            color: '#fff',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !stripe || !elements) ? 0.55 : 1,
            transition: 'transform 0.15s, box-shadow 0.15s, filter 0.15s',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
          onMouseEnter={e => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.filter = 'brightness(1.08)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.filter = 'none';
          }}
        >
          {isLoading ? (
            <>
              <span style={{
                display: 'inline-block', width: 18, height: 18,
                border: '2.5px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'pmSpin 0.85s linear infinite',
              }} />
              Processing…
            </>
          ) : (
            `Pay ₱${Number(amount).toFixed(2)}`
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            padding: '14px 20px',
            borderRadius: 14,
            fontWeight: 700,
            fontSize: '0.88rem',
            color: '#64748b',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.55 : 1,
            transition: 'background 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default StripePaymentForm;
