import { useState } from 'react'
import './App.css'
import { TOKEN_KEY } from './config'
import HomePage from './components/Home/HomePage'
import AuthModal from './components/Auth/AuthModal'
import VendorDashboard from './components/Vendor/VendorDashboard'
import ShopperDashboard from './components/Shopper/ShopperDashboard'
import RiderDashboard from './components/Rider/RiderDashboard'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mercago_user') || 'null') } catch { return null }
  })

  // 'none' | 'login' | 'register'
  const [authModal, setAuthModal] = useState('none')
  const [authRole, setAuthRole] = useState('shopper')
  // 'home' | 'dashboard'
  const [view, setView] = useState('home')

  const handleLoginSuccess = (tok, user) => {
    localStorage.setItem(TOKEN_KEY, tok)
    localStorage.setItem('mercago_user', JSON.stringify(user))
    setToken(tok)
    setCurrentUser(user)
    setAuthModal('none')
    // Shoppers stay on home page; vendors/riders go straight to their dashboard
    if (user?.role === 'vendor' || user?.role === 'rider') {
      setView('dashboard')
    } else {
      setView('home')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('mercago_user')
    setToken('')
    setCurrentUser(null)
    setView('home')
  }

  // Shopper uses the dashboard on demand (e.g. cart / order history)
  const goToDashboard = () => setView('dashboard')
  const goToHome = () => setView('home')

  return (
    <>
      {/* ── Auth Modal (overlay on top of anything) ── */}
      {authModal !== 'none' && (
        <AuthModal
          defaultTab={authModal === 'register' ? 'register' : 'login'}
          defaultRole={authRole}
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setAuthModal('none')}
        />
      )}

      {view === 'home' || !currentUser ? (
        <HomePage
          currentUser={currentUser}
          token={token}
          onLoginClick={() => { setAuthRole('shopper'); setAuthModal('login') }}
          onSignUpClick={() => { setAuthRole('shopper'); setAuthModal('register') }}
          onSellClick={() => { setAuthRole('vendor'); setAuthModal('register') }}
          onGoToDashboard={goToDashboard}
        />
      ) : (
        <div className="app-shell">
          <div className="card">
            {/* Back to Home (Hidden for Riders) */}
            {currentUser.role !== 'rider' && (
              <div style={{ marginBottom: '1rem' }}>
                <button onClick={goToHome} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', padding: 0 }}>
                  ← Back to Market
                </button>
              </div>
            )}

            {currentUser.role === 'vendor' && <VendorDashboard currentUser={currentUser} token={token} onLogout={handleLogout} />}
            {currentUser.role === 'shopper' && <ShopperDashboard currentUser={currentUser} token={token} onLogout={handleLogout} onGoToHome={goToHome} />}
            {currentUser.role === 'rider' && <RiderDashboard currentUser={currentUser} token={token} onLogout={handleLogout} />}
          </div>
        </div>
      )}
    </>
  )
}

export default App

