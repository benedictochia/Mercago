import StatusBadge from './StatusBadge'

export default function OrderCard({ order, onAccept, onDecline, onComplete, showActions }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong style={{ fontSize: '1.2rem' }}>🛍 {order.shopper_name}</strong>
          <p style={{ margin: '4px 0 0', fontSize: '1rem', color: '#6b7280' }}>📍 {order.shopper_address}</p>
          <p style={{ margin: '2px 0 0', fontSize: '1rem', color: '#6b7280' }}>🏪 Vendor: {order.vendor_name}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={order.delivery_status} />
          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{order.ordered_at}</span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem', marginBottom: '1rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Product</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 8px' }}>{item.product_name}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>₱{Number(item.subtotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: '1.15rem' }}>Total: ₱{Number(order.total_amount).toFixed(2)}</strong>

        {showActions === 'pending' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => onDecline(order.order_id)}
              style={{ 
                background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', 
                padding: '12px 24px', cursor: 'pointer', fontWeight: '900', fontSize: '1.1rem',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            >
              ✗ Decline
            </button>
            <button onClick={() => onAccept(order.order_id)}
              style={{ 
                background: '#059669', color: 'white', border: 'none', borderRadius: '10px', 
                padding: '12px 32px', cursor: 'pointer', fontWeight: '900', fontSize: '1.1rem',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'}
            >
              ✓ Accept Order
            </button>
          </div>
        )}

        {showActions === 'ongoing' && (
          <button onClick={() => onComplete(order.order_id)}
            style={{ 
              background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', 
              padding: '16px 32px', cursor: 'pointer', fontWeight: '900', fontSize: '1.2rem', 
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)',
              textTransform: 'uppercase', letterSpacing: '1px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.background = '#1d4ed8' }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.background = '#2563eb' }}
          >
            ✅ Complete Delivery
          </button>
        )}
      </div>
    </div>
  )
}
