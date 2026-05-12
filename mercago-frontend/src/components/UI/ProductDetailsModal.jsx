import React, { useState, useMemo } from 'react'

export default function ProductDetailsModal({ product, token, API_BASE_URL, currentUser, onClose, onAddToCart, onReviewSubmitted }) {
  const [reviews, setReviews] = useState(product.reviews || [])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState('')
  const [selectedUnit, setSelectedUnit] = useState(product.unit || 'kg')
  const [addedFeedback, setAddedFeedback] = useState(false)

  // Build available unit options based on the product's base unit
  const unitOptions = useMemo(() => {
    const base = (product.unit || '').toLowerCase()
    const options = [{ value: product.unit, label: product.unit }]
    if (base === 'kg') {
      options.push({ value: 'grams', label: 'grams' })
      options.push({ value: 'lb', label: 'lb' })
    }
    if (['pc', 'unit', 'bundle'].includes(base)) {
      options.push({ value: 'half', label: 'half' })
    }
    return options
  }, [product.unit])

  // Calculate the converted quantity in base unit and price preview
  const { convertedQty, pricePreview } = useMemo(() => {
    const raw = parseFloat(quantity)
    if (isNaN(raw) || raw <= 0) return { convertedQty: 0, pricePreview: null }
    let cq = raw
    const base = (product.unit || '').toLowerCase()
    if (base === 'kg' && selectedUnit === 'grams') cq = raw / 1000
    if (base === 'kg' && selectedUnit === 'lb') cq = raw * 0.453592
    if (selectedUnit === 'half') cq = raw * 0.5
    return { convertedQty: cq, pricePreview: (cq * Number(product.price)).toFixed(2) }
  }, [quantity, selectedUnit, product.price, product.unit])

  const handleAddToCartClick = () => {
    if (convertedQty <= 0) return
    const success = onAddToCart(product, convertedQty)
    if (success === false) return // Blocked by login prompt
    
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
    setQuantity('')
    setSelectedUnit(product.unit || 'kg')
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!token) {
      setError('You must be logged in to leave a review.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: product.id,
          rating,
          comment
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to submit review')

      setReviews([data.review, ...reviews])
      setComment('')
      setRating(5)
      if (onReviewSubmitted) onReviewSubmitted()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '20px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          background: '#fff', borderRadius: '16px', width: '95%', maxWidth: '960px', maxHeight: '92vh', 
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#0f172a', fontWeight: 700 }}>{product.product_name}</h2>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9' }}
          >&times;</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', padding: '28px' }}>
          {/* Left: Product Info + Custom Order */}
          <div style={{ flex: '1 1 340px', minWidth: '300px', paddingRight: '28px', marginBottom: '20px' }}>
            {/* Image */}
            {product.image_url ? (
              <img src={product.image_url} alt={product.product_name} style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '12px', marginBottom: '20px' }} />
            ) : (
              <div style={{ width: '100%', height: '280px', background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <span style={{ color: '#94a3b8', fontSize: '1.1rem' }}>No Image Available</span>
              </div>
            )}
            
            {/* Price + Rating Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>₱{Number(product.price).toFixed(2)} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 'normal' }}>/ {product.unit}</span></span>
              <span style={{ background: '#fef3c7', color: '#b45309', padding: '6px 12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
                ★ {product.avg_rating > 0 ? product.avg_rating : 'New'}
              </span>
            </div>
            
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '6px' }}>Category: <strong style={{ color: '#475569' }}>{product.category}</strong></p>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '24px' }}>
              Stock: {product.stock_qty > 0 ? `${product.stock_qty} ${product.unit} available` : 'Out of stock'}
            </p>

            {/* ── Custom Order Section ── */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>⚖️ Custom Order</h4>
              
              {/* Amount + Unit Row */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Amount</label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0.001" 
                    placeholder={`e.g. ${selectedUnit === 'grams' ? '250' : '1'}`}
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{ 
                      width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', 
                      fontSize: '1.1rem', textAlign: 'center', boxSizing: 'border-box',
                      background: '#fff', outline: 'none', transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#2563eb' }}
                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Unit</label>
                  <select 
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    style={{ 
                      width: '100%', padding: '12px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', 
                      fontSize: '1rem', color: '#0f172a', cursor: 'pointer', background: '#fff',
                      boxSizing: 'border-box', outline: 'none'
                    }}
                  >
                    {unitOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Live Price Preview */}
              {pricePreview && (
                <div style={{ 
                  background: '#eff6ff', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: '1px solid #bfdbfe'
                }}>
                  <span style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                    {quantity} {selectedUnit} {selectedUnit !== product.unit && `(≈ ${convertedQty.toFixed(3)} ${product.unit})`}
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e3a8a' }}>₱{pricePreview}</span>
                </div>
              )}

              {/* Add to Cart Button */}
              <button 
                onClick={handleAddToCartClick}
                disabled={product.stock_qty <= 0 || convertedQty <= 0}
                style={{
                  width: '100%', padding: '14px', 
                  background: addedFeedback ? '#059669' : (product.stock_qty > 0 && convertedQty > 0 ? '#2563eb' : '#94a3b8'), 
                  color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', 
                  cursor: (product.stock_qty > 0 && convertedQty > 0) ? 'pointer' : 'not-allowed',
                  fontSize: '1.05rem', transition: 'all 0.3s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                {addedFeedback ? (
                  <><span style={{ fontSize: '1.2rem' }}>✓</span> Added to Cart!</>
                ) : product.stock_qty <= 0 ? (
                  'Out of Stock'
                ) : convertedQty <= 0 ? (
                  'Enter amount above'
                ) : (
                  <><span style={{ fontSize: '1.2rem' }}>🛒</span> Add to Cart — ₱{pricePreview}</>
                )}
              </button>
            </div>
          </div>

          {/* Right: Reviews Section */}
          <div style={{ flex: '1 1 300px', minWidth: '280px', borderLeft: '1px solid #e2e8f0', paddingLeft: '28px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>Reviews ({reviews.length})</h3>

            {/* Review Form */}
            {currentUser?.role === 'shopper' && (
              <form onSubmit={handleReviewSubmit} style={{ background: '#f8fafc', padding: '20px', borderRadius: '10px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: '#334155', fontWeight: 600 }}>Write a Review</h4>
                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '10px', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px' }}>{error}</div>}
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '6px' }}>Rating:</label>
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}>
                    <option value={5}>5 - Excellent</option>
                    <option value={4}>4 - Good</option>
                    <option value={3}>3 - Average</option>
                    <option value={2}>2 - Poor</option>
                    <option value={1}>1 - Terrible</option>
                  </select>
                </div>
                
                <textarea 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  placeholder="Share your experience with this product..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '12px', minHeight: '80px', boxSizing: 'border-box', fontSize: '0.9rem', resize: 'vertical' }}
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, width: '100%', transition: 'all 0.2s' }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}

            {/* Review List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>No reviews yet. Be the first to review!</p>
              ) : (
                reviews.map(review => (
                  <div key={review.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{review.user?.first_name} {review.user?.last_name}</strong>
                      <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    </div>
                    {review.comment && <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#475569', lineHeight: '1.4' }}>{review.comment}</p>}
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(review.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
