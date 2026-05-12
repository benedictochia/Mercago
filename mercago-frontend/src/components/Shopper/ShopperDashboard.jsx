import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import { extractError } from '../../utils/error'
import StatusBadge from '../UI/StatusBadge'
import EditProfileModal from '../UI/EditProfileModal'
import MockPaymentModal from '../UI/MockPaymentModal'

export default function ShopperDashboard({ currentUser, token, onLogout }) {
  const [shopperTab, setShopperTab] = useState(() => {
    if (localStorage.getItem('mercago_open_cart') === 'true') {
      localStorage.removeItem('mercago_open_cart')
      return 'cart'
    }
    return 'cart'
  })
  
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [user, setUser] = useState(currentUser)

  // States
  const [shopVendors, setShopVendors] = useState([])
  const [shopLoading, setShopLoading] = useState(false)
  const [shopError, setShopError] = useState('')

  // Per-user cart key
  const cartKey = `mercago_cart_${currentUser?.id}`
  const [cart, setCartState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || '[]') } catch { return [] }
  })

  // Helper to persist cart changes
  const setCart = (updater) => {
    setCartState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem(cartKey, JSON.stringify(next))
      return next
    })
  }
  
  const [orderHistory, setOrderHistory] = useState([])
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [cartWarning, setCartWarning] = useState('')
  const [pollCountdown, setPollCountdown] = useState(20)
  const [paymentMethod, setPaymentMethod] = useState('cod')   // 'cod' | 'gcash' | 'maya' | 'stripe'
  const [mockGatewayOpen, setMockGatewayOpen] = useState(false) // show mock payment UI
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [pendingPaymentOrders, setPendingPaymentOrders] = useState([])
  const pollRef = useRef(null)
  const countdownRef = useRef(null)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const fetchShop = async () => {
    if (!token) return
    setShopLoading(true); setShopError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/shop`, { headers: authHeaders })
      if (!res.ok) { setShopError(await extractError(res)); return }
      setShopVendors(await res.json())
    } catch { setShopError('Unable to load shop.') }
    finally { setShopLoading(false) }
  }

  const fetchOrderHistory = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/history`, { headers: authHeaders })
      if (!res.ok) return
      const d = await res.json()
      setOrderHistory(Array.isArray(d) ? d : [])
    } catch { /* silent */ }
  }

  // Add to cart with client-side stock cap
  const addToCart = (product, vendorName) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === product.id)
      if (ex) {
        // Don't exceed available stock
        if (ex.quantity >= product.stock_qty) {
          setCartWarning(`⚠️ Only ${product.stock_qty} unit(s) of "${product.product_name}" available.`)
          setTimeout(() => setCartWarning(''), 3000)
          return prev
        }
        return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product: { ...product, vendorName }, quantity: 1 }]
    })
  }
  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.product.id !== id))
  const updateCartQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return }
    setCart((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: qty } : i))
  }
  const cartTotal = cart.reduce((s, i) => s + (i.product.flash_active ? Number(i.product.flash_price) : Number(i.product.price)) * i.quantity, 0)

  const placeOrderAPI = async () => {
    setIsPlacingOrder(true); setOrderMessage('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          payment_method: paymentMethod,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setOrderMessage(`❌ ${d.message || 'Order failed.'}`); return null }
      
      // If it's a digital payment, we keep the cart until payment is confirmed
      // Or we can clear it now and let the modal handle success.
      // For Stripe, we need the order ID.
      if (paymentMethod === 'cod') {
        setCart([]); 
        setOrderMessage('✅ Order placed! A rider will be assigned shortly.')
        setShopperTab('history')
        await Promise.all([fetchShop(), fetchOrderHistory()])
      }
      return d.orders;
    } catch { 
      setOrderMessage('❌ Unable to connect.'); 
      return null;
    } finally { 
      setIsPlacingOrder(false) 
    }
  }

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return
    
    if (paymentMethod !== 'cod') {
      const orders = await placeOrderAPI();
      if (orders && orders.length > 0) {
        // For simplicity, we process the first order in the batch for payment
        // In a real multi-vendor setup, you might need a total payment intent
        setPendingPaymentOrders(orders);
        setCurrentOrderId(orders[0].order_id || orders[0].id);
        setMockGatewayOpen(true);
      }
    } else {
      await placeOrderAPI()
    }
  }

  useEffect(() => {
    if (!token) return
    fetchShop()
    fetchOrderHistory()

    // Auto-refresh order history every 20 seconds so shopper
    // sees status updates without manually clicking refresh
    pollRef.current = setInterval(() => {
      fetchOrderHistory()
      setPollCountdown(20)
    }, 20000)

    // Countdown ticker for the UI indicator
    countdownRef.current = setInterval(() => {
      setPollCountdown(prev => (prev <= 1 ? 20 : prev - 1))
    }, 1000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(countdownRef.current)
    }
  }, [token])

  return (
    <>
      <section>
      <div className="dashboard-head">
        <div>
          <h2>Shop</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {user?.first_name} {user?.last_name} &bull; <em>shopper</em>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {cart.length > 0 && (
            <span style={{ background: '#2563eb', color: 'white', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              🛒 {cart.length}
            </span>
          )}
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

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={shopperTab === 'cart' ? 'tab active' : 'tab'} type="button" onClick={() => setShopperTab('cart')}>
          Cart {cart.length > 0 ? `(${cart.length})` : ''}
        </button>
        <button className={shopperTab === 'history' ? 'tab active' : 'tab'} type="button"
          onClick={() => { setShopperTab('history'); fetchOrderHistory() }}>My Orders</button>
      </div>


      {shopperTab === 'cart' && (
        <>
          <h3>Your Cart</h3>
          {orderMessage ? <p style={{ fontWeight: 'bold', color: orderMessage.startsWith('✅') ? '#059669' : '#ef4444' }}>{orderMessage}</p> : null}
          {cartWarning && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '8px 14px', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 500, color: '#92400e' }}>
              {cartWarning}
            </div>
          )}
          {cart.length === 0 ? <p className="empty-note">Cart is empty. Browse to add items!</p> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Image</th><th>Product</th><th>Vendor</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.product.id}>
                        <td>{item.product.image_url ? <img src={item.product.image_url} alt="img" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} /> : null}</td>
                        <td>{item.product.product_name}</td>
                        <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>🏪 {item.product.vendorName}</td>
                        <td>
                          {item.product.flash_active ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚡ ₱{Number(item.product.flash_price).toFixed(2)}</span>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.8rem' }}>₱{Number(item.product.price).toFixed(2)}</span>
                            </div>
                          ) : (
                            `₱${Number(item.product.price).toFixed(2)}`
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value)
                              if (!val || val <= 0) return
                              updateCartQty(item.product.id, val)
                            }}
                            style={{ width: 70, padding: '4px 6px', borderRadius: 4, border: '1px solid #d1d5db', textAlign: 'center', fontSize: '0.9rem' }}
                          />
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 4 }}>{item.product.unit || ''}</span>
                        </td>
                        <td style={{ fontWeight: 'bold' }}>₱{((item.product.flash_active ? Number(item.product.flash_price) : Number(item.product.price)) * item.quantity).toFixed(2)}</td>
                        <td><button type="button" className="danger-btn" onClick={() => removeFromCart(item.product.id)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 8 }}>
                {/* Payment Method Selector */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '0 0 8px' }}>💳 Payment Method</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { id: 'cod', label: '💵 Cash on Delivery', color: '#6b7280' },
                      { id: 'gcash', label: '💙 GCash', color: '#0070FF' },
                      { id: 'maya', label: '💚 Maya', color: '#00BFA5' },
                      { id: 'stripe', label: '💳 Card (Stripe)', color: '#6366f1' },
                    ].map(m => (
                      <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                        style={{
                          padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                          border: `2px solid ${paymentMethod === m.id ? m.color : '#e2e8f0'}`,
                          background: paymentMethod === m.id ? m.color + '15' : '#fff',
                          color: paymentMethod === m.id ? m.color : '#6b7280',
                        }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.1rem' }}>Total: ₱{cartTotal.toFixed(2)}</strong>
                  <button type="button" onClick={handlePlaceOrder} disabled={isPlacingOrder}
                    style={{ background: '#059669', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    {isPlacingOrder ? 'Placing...' : paymentMethod === 'cod' ? '✅ Place Order' : `💳 Pay with ${paymentMethod === 'stripe' ? 'Stripe' : paymentMethod === 'gcash' ? 'GCash' : 'Maya'}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {shopperTab === 'history' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>My Orders</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: '10px' }}>
                🔄 Auto-refreshing in {pollCountdown}s
              </span>
              <button type="button" className="secondary-btn" onClick={() => { fetchOrderHistory(); setPollCountdown(20) }}>Refresh Now</button>
            </div>
          </div>
          {orderHistory.length === 0 ? <p className="empty-note">No orders yet.</p>
            : orderHistory.map((order) => (
              <div key={order.order_id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 8 }}>
                  <strong>🏪 {order.vendor_name}</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <StatusBadge status={order.delivery_status} />
                    {order.payment_method && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: order.payment_method === 'cod' ? '#f3f4f6' : order.payment_method === 'gcash' ? '#eff6ff' : order.payment_method === 'stripe' ? '#eef2ff' : '#f0fdf4',
                        color: order.payment_method === 'cod' ? '#6b7280' : order.payment_method === 'gcash' ? '#1d4ed8' : order.payment_method === 'stripe' ? '#4f46e5' : '#059669',
                      }}>
                        {order.payment_method === 'cod' ? '💵 COD' : order.payment_method === 'gcash' ? '💙 GCash' : order.payment_method === 'stripe' ? '💳 Stripe' : '💚 Maya'}
                      </span>
                    )}
                    <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{order.ordered_at}</span>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.product_name}</td>
                          <td>{item.quantity} <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{item.unit}</span></td>
                          <td>₱{Number(item.unit_price).toFixed(2)}</td>
                          <td>₱{Number(item.subtotal).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ textAlign: 'right', fontWeight: 'bold', margin: '0.5rem 0 0' }}>
                  Total: ₱{Number(order.total_amount).toFixed(2)}
                </p>
              </div>
            ))}
        </>
      )}
    </section>

      {mockGatewayOpen && (
        <MockPaymentModal
          gateway={paymentMethod}
          amount={cartTotal}
          orderId={currentOrderId}
          onSuccess={async () => { 
            setMockGatewayOpen(false); 
            setCart([]); 
            setShopperTab('history');
            setPaymentMethod('cod');
            await Promise.all([fetchShop(), fetchOrderHistory()]);
          }}
          onCancel={async () => {
            setMockGatewayOpen(false);
            if (pendingPaymentOrders.length > 0) {
              await Promise.all(pendingPaymentOrders.map(o => 
                fetch(`${API_BASE_URL}/api/orders/${o.id || o.order_id}`, {
                  method: 'DELETE',
                  headers: authHeaders
                })
              ));
              setPendingPaymentOrders([]);
              fetchOrderHistory(); // Refresh to ensure they disappear
            }
          }}
        />
      )}
    </>
  )
}
