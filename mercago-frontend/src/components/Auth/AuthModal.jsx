import { useState } from 'react'
import { API_BASE_URL } from '../../config'
import { extractError } from '../../utils/error'

export default function AuthModal({ defaultTab = 'login', defaultRole = 'shopper', onLoginSuccess, onClose }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    first_name: '', middle_name: '', last_name: '',
    email: '', password: '', contact_no: '',
    age: '', sex: 'Male', address: '', role: defaultRole,
  })

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      if (!res.ok) { setError(await extractError(res)); return }
      const d = await res.json()
      const t = d?.token || d?.access_token
      if (!t) { setError('Token not returned.'); return }
      onLoginSuccess(t, d?.user)
    } catch { setError('Unable to reach server.') }
    finally { setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      if (!res.ok) { setError(await extractError(res)); return }
      const d = await res.json()
      const t = d?.token || d?.access_token
      if (!t) { setError('Token not returned.'); return }
      onLoginSuccess(t, d?.user)
    } catch { setError('Unable to reach server.') }
    finally { setLoading(false) }
  }

  const inp = {
    display: 'block', width: '100%', boxSizing: 'border-box',
    border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 12px',
    fontSize: '0.9rem', marginTop: 4, outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', width: '100%', maxWidth: 460, maxHeight: '90vh', overflow: 'auto' }}>

        {/* Modal Header */}
        <div style={{ background: '#2563eb', padding: '1.25rem 1.5rem', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-0.5px' }}>Merca<span style={{ color: '#fbbf24' }}>GO</span></span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '1.5rem', background: '#f3f4f6', borderRadius: 8, padding: 4, gap: 4 }}>
            {['login', 'register'].map((t) => (
              <button key={t} onClick={() => { setActiveTab(t); setError('') }}
                style={{ flex: 1, background: activeTab === t ? '#fff' : 'transparent', border: 'none', borderRadius: 6, padding: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: activeTab === t ? '#2563eb' : '#6b7280', boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                {t === 'login' ? 'Login' : 'Create Account'}
              </button>
            ))}
          </div>

          {error ? <p style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '8px 12px', fontSize: '0.85rem', margin: '0 0 1rem' }}>{error}</p> : null}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label><span style={lbl}>Email</span><input type="email" style={inp} value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} required /></label>
              <label><span style={lbl}>Password</span><input type="password" style={inp} value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} required /></label>
              <button type="submit" disabled={loading}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 4 }}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <p style={{ textAlign: 'center', margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
                No account? <span onClick={() => setActiveTab('register')} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Sign up as Shopper →</span>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label><span style={lbl}>First Name</span><input type="text" style={inp} value={registerForm.first_name} onChange={(e) => setRegisterForm((p) => ({ ...p, first_name: e.target.value }))} required /></label>
                <label><span style={lbl}>Last Name</span><input type="text" style={inp} value={registerForm.last_name} onChange={(e) => setRegisterForm((p) => ({ ...p, last_name: e.target.value }))} required /></label>
              </div>
              <label><span style={lbl}>Middle Name (Optional)</span><input type="text" style={inp} value={registerForm.middle_name} onChange={(e) => setRegisterForm((p) => ({ ...p, middle_name: e.target.value }))} /></label>
              <label><span style={lbl}>Email</span><input type="email" style={inp} value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} required /></label>
              <label><span style={lbl}>Password</span><input type="password" style={inp} value={registerForm.password} onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} required /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label><span style={lbl}>Contact No.</span><input type="text" style={inp} value={registerForm.contact_no} onChange={(e) => setRegisterForm((p) => ({ ...p, contact_no: e.target.value }))} required /></label>
                <label><span style={lbl}>Age</span><input type="number" min="1" style={inp} value={registerForm.age} onChange={(e) => setRegisterForm((p) => ({ ...p, age: e.target.value }))} required /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label><span style={lbl}>Sex</span>
                  <select style={inp} value={registerForm.sex} onChange={(e) => setRegisterForm((p) => ({ ...p, sex: e.target.value }))}>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                </label>
                <label><span style={lbl}>Role</span>
                  <select style={inp} value={registerForm.role} onChange={(e) => setRegisterForm((p) => ({ ...p, role: e.target.value }))}>
                    <option value="shopper">Shopper</option>
                    <option value="vendor">Vendor</option>
                    <option value="rider">Rider</option>
                  </select>
                </label>
              </div>
              <label><span style={lbl}>Address</span><input type="text" style={inp} value={registerForm.address} onChange={(e) => setRegisterForm((p) => ({ ...p, address: e.target.value }))} required /></label>
              <button type="submit" disabled={loading}
                style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 4 }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
