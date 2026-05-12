import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { API_BASE_URL, TOKEN_KEY } from '../../config';
import StripePaymentForm from './StripePaymentForm';

// Initialize Stripe outside of the component to avoid re-initializing on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const StripeContainer = ({ orderId, amount, onPaymentSuccess, onCancel }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIntent = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);

        if (!token) {
          setError('User session not found. Please log in again.');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/payments/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ order_id: orderId })
        });

        const data = await response.json();

        if (response.ok) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.message || 'Failed to initialize payment');
        }
      } catch (err) {
        setError('Network error occurred while contacting Stripe.');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchIntent();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 16px', gap: '16px',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '4px solid #e2e8f0', borderTopColor: '#6366f1',
          animation: 'pmSpin 0.85s linear infinite',
        }} />
        <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
          Initializing secure checkout…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '8px 0', textAlign: 'center' }}>
        <div style={{
          background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
          padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem',
          fontWeight: 600, marginBottom: 16,
        }}>
          {error}
        </div>
        <button
          onClick={onCancel}
          style={{
            background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '10px 28px', fontWeight: 700,
            fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#6366f1',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        borderRadius: '12px',
        spacingUnit: '4px',
        colorBackground: '#f8fafc',
        colorText: '#0f172a',
        colorDanger: '#ef4444',
      },
      rules: {
        '.Input': {
          border: '2px solid #e2e8f0',
          boxShadow: 'none',
          padding: '12px',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        },
        '.Input:focus': {
          border: '2px solid #6366f1',
          boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.1)',
        },
        '.Label': {
          fontWeight: '600',
          fontSize: '0.82rem',
          color: '#334155',
          marginBottom: '6px',
        },
        '.Tab': {
          border: '2px solid #e2e8f0',
          borderRadius: '10px',
          padding: '10px 12px',
        },
        '.Tab--selected': {
          border: '2px solid #6366f1',
          backgroundColor: '#eef2ff',
        },
      },
    },
  };

  return (
    <div style={{ animation: 'pmSlideUp 0.3s ease-out' }}>
      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <StripePaymentForm
            orderId={orderId}
            amount={amount}
            onPaymentSuccess={onPaymentSuccess}
            onCancel={onCancel}
          />
        </Elements>
      )}
    </div>
  );
};

export default StripeContainer;
