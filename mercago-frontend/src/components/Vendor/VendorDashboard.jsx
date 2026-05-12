import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../../config'
import { extractError } from '../../utils/error'
import StatusBadge from '../UI/StatusBadge'
import EditProfileModal from '../UI/EditProfileModal'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const emptyProductForm = {
  product_name: '',
  category: '',
  price: '',
  unit: '',
  stock_qty: '',
  image: null,
}

function VendorAnalytics({ vendorOrders }) {
  const [chartView, setChartView] = useState('sales') // 'sales' | 'products' | 'calendar'
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [dateRange, setDateRange] = useState(14) // 7 | 14 | 30
  const [barMetric, setBarMetric] = useState('qty') // 'qty' | 'revenue'
  const chartRef = useRef(null)

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [selectedCalDate, setSelectedCalDate] = useState(null)
  const [calRangeStart, setCalRangeStart] = useState(null)
  const [calRangeEnd, setCalRangeEnd] = useState(null)
  const [calMode, setCalMode] = useState('single') // 'single' | 'range'

  const isInRange = (dateStr, startDate, endDate) => {
    if (!dateStr) return false
    try {
      const d = new Date(dateStr.split(' ')[0])
      return d >= startDate && d <= endDate
    } catch {
      return false
    }
  }

  // Current period date boundaries
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(now.getDate() - (dateRange - 1))
  currentStart.setHours(0, 0, 0, 0)

  // Previous period (same length, immediately before current)
  const prevEnd = new Date(currentStart)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - (dateRange - 1))
  prevStart.setHours(0, 0, 0, 0)

  // Range-aware aggregation
  let rangeRevenue = 0, rangeOrders = 0, rangeItems = 0
  let prevRevenue = 0, prevOrders = 0, prevItems = 0

  vendorOrders.forEach(o => {
    const amt = parseFloat(o.total_amount) || 0
    const items = o.items.reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0)
    if (isInRange(o.ordered_at, currentStart, now)) {
      rangeRevenue += amt; rangeOrders++; rangeItems += items
    }
    if (isInRange(o.ordered_at, prevStart, prevEnd)) {
      prevRevenue += amt; prevOrders++; prevItems += items
    }
  })

  const rangeAvg = rangeOrders ? rangeRevenue / rangeOrders : 0
  const prevAvg = prevOrders ? prevRevenue / prevOrders : 0

  // % change helper
  const pctChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }

  const stats = [
    { label: 'Total Revenue', value: `₱${rangeRevenue.toFixed(2)}`, change: pctChange(rangeRevenue, prevRevenue), color: '#3b82f6' },
    { label: 'Total Orders', value: rangeOrders, change: pctChange(rangeOrders, prevOrders), color: '#8b5cf6' },
    { label: 'Items Sold', value: rangeItems, change: pctChange(rangeItems, prevItems), color: '#10b981' },
    { label: 'Avg Order Value', value: `₱${rangeAvg.toFixed(2)}`, change: pctChange(rangeAvg, prevAvg), color: '#f59e0b' },
  ]

  // Group sales by Date (format: YYYY-MM-DD)
  const salesByDate = {}
  vendorOrders.forEach(o => {
    const dStr = o.ordered_at ? o.ordered_at.split(' ')[0] : 'Unknown'
    if (!salesByDate[dStr]) salesByDate[dStr] = 0
    salesByDate[dStr] += parseFloat(o.total_amount) || 0
  })

  // Group specific product sales by Date
  const productSalesByDate = {}
  const productQtyByDate = {}
  if (selectedProduct) {
    vendorOrders.forEach(o => {
      const dStr = o.ordered_at ? o.ordered_at.split(' ')[0] : 'Unknown'
      const matchedItem = o.items.find(i => i.product_name === selectedProduct)
      if (matchedItem) {
        if (!productSalesByDate[dStr]) productSalesByDate[dStr] = 0
        if (!productQtyByDate[dStr]) productQtyByDate[dStr] = 0
        productSalesByDate[dStr] += parseFloat(matchedItem.subtotal) || 0
        productQtyByDate[dStr] += parseFloat(matchedItem.quantity) || 0
      }
    })
  }

  // Build a continuous calendar-day range ending today, filling gaps with ₱0
  const buildContinuousRange = (days) => {
    const dates = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      dates.push(d.toISOString().split('T')[0]) // YYYY-MM-DD
    }
    return dates
  }
  const sortedDates = buildContinuousRange(dateRange).map(d => {
    if (!salesByDate[d]) salesByDate[d] = 0
    if (selectedProduct) {
      if (!productSalesByDate[d]) productSalesByDate[d] = 0
      if (!productQtyByDate[d]) productQtyByDate[d] = 0
    }
    return d
  })

  // Top Products (respecting date range)
  const productTally = {}
  vendorOrders.forEach(o => {
    if (isInRange(o.ordered_at, currentStart, now)) {
      o.items.forEach(i => {
        const name = i.product_name
        if (!productTally[name]) productTally[name] = { qty: 0, rev: 0 }
        productTally[name].qty += parseFloat(i.quantity) || 0
        productTally[name].rev += parseFloat(i.subtotal) || 0
      })
    }
  })

  // Full list of products sold in the period
  const allProductsSold = Object.entries(productTally).sort((a, b) => b[1].rev - a[1].rev)

  const topProducts = [...allProductsSold]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 8)

  // ── Gradient helper for the line chart fill ──
  const getGradient = (ctx, chartArea) => {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.28)')
    gradient.addColorStop(0.6, 'rgba(59, 130, 246, 0.08)')
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')
    return gradient
  }

  // ── Chart Data: Sales Line Chart ──
  const salesLineData = {
    labels: sortedDates.map(d => {
      const parts = d.split('-')
      return `${parts[1]}-${parts[2]}`
    }),
    datasets: [
      {
        label: 'Revenue (₱)',
        data: sortedDates.map(d => salesByDate[d]),
        borderColor: '#3b82f6',
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart
          if (!chartArea) return 'rgba(59, 130, 246, 0.1)'
          return getGradient(ctx, chartArea)
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: dateRange <= 14 ? 5 : 3,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true,
      },
    ],
  }

  // ── Chart Data: Specific Product Line Chart ──
  const productLineData = {
    labels: sortedDates.map(d => {
      const parts = d.split('-')
      return `${parts[1]}-${parts[2]}`
    }),
    datasets: [
      {
        label: `${selectedProduct} Revenue (₱)`,
        data: sortedDates.map(d => productSalesByDate[d]),
        borderColor: '#10b981',
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart
          if (!chartArea) return 'rgba(16, 185, 129, 0.1)'
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)')
          gradient.addColorStop(0.6, 'rgba(16, 185, 129, 0.08)')
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')
          return gradient
        },
        borderWidth: 2.5,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: dateRange <= 14 ? 5 : 3,
        pointHoverRadius: 7,
        tension: 0.35,
        fill: true,
      },
    ],
  }

  // ── Crosshair vertical line plugin ──
  const crosshairPlugin = {
    id: 'crosshairLine',
    afterDraw: (chart) => {
      if (chart.tooltip?._active?.length) {
        const ctx = chart.ctx
        const activePoint = chart.tooltip._active[0]
        const x = activePoint.element.x
        const topY = chart.scales.y.top
        const bottomY = chart.scales.y.bottom

        ctx.save()
        ctx.beginPath()
        ctx.setLineDash([4, 4])
        ctx.moveTo(x, topY)
        ctx.lineTo(x, bottomY)
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
        ctx.stroke()
        ctx.restore()
      }
    },
  }

  const salesLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => `₱${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 12 }, maxRotation: dateRange > 14 ? 45 : 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          color: '#9ca3af',
          font: { size: 12 },
          callback: (v) => `₱${v.toLocaleString()}`,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  }

  const productLineOptions = {
    ...salesLineOptions,
    plugins: {
      ...salesLineOptions.plugins,
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const dateStr = sortedDates[ctx.dataIndex]
            return `Qty: ${productQtyByDate[dateStr] || 0}`
          },
          afterLabel: (ctx) => {
            const dateStr = sortedDates[ctx.dataIndex]
            return `Revenue: ₱${(productSalesByDate[dateStr] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          }
        },
      },
    },
  }

  // ── Chart Data: Products Bar Chart ──
  const barColors = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
    '#ef4444', '#06b6d4', '#ec4899', '#6366f1',
  ]

  // Sort by the selected metric
  const sortedProducts = [...topProducts].sort((a, b) =>
    barMetric === 'qty' ? b[1].qty - a[1].qty : b[1].rev - a[1].rev
  )

  const productsBarData = {
    labels: sortedProducts.map(([name]) => name),
    datasets: [
      {
        label: barMetric === 'qty' ? 'Quantity Sold' : 'Revenue (₱)',
        data: sortedProducts.map(([, data]) => barMetric === 'qty' ? data.qty : data.rev),
        backgroundColor: sortedProducts.map((_, i) => barColors[i % barColors.length]),
        borderColor: sortedProducts.map((_, i) => barColors[i % barColors.length]),
        borderWidth: 0,
        borderRadius: 6,
        barPercentage: 0.7,
      },
    ],
  }

  // ── Bar value label plugin ──
  const barLabelPlugin = {
    id: 'barValueLabels',
    afterDatasetsDraw: (chart) => {
      const ctx = chart.ctx
      chart.data.datasets.forEach((dataset, dsIndex) => {
        const meta = chart.getDatasetMeta(dsIndex)
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index]
          const formatted = barMetric === 'qty'
            ? value.toString()
            : `₱${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

          ctx.save()
          ctx.fillStyle = '#374151'
          ctx.font = 'bold 11px Inter, system-ui, sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          // Position label just after the bar end
          const x = bar.x + 6
          const y = bar.y
          ctx.fillText(formatted, x, y)
          ctx.restore()
        })
      })
    },
  }

  const productsBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    layout: {
      padding: { right: barMetric === 'revenue' ? 70 : 30 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => {
            const [, data] = sortedProducts[ctx.dataIndex]
            return barMetric === 'qty'
              ? `Qty: ${data.qty}`
              : `Revenue: ₱${data.rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          },
          afterLabel: (ctx) => {
            const [, data] = sortedProducts[ctx.dataIndex]
            return barMetric === 'qty'
              ? `Revenue: ₱${data.rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : `Qty Sold: ${data.qty}`
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: {
          color: '#9ca3af',
          font: { size: 12 },
          ...(barMetric === 'qty' ? { stepSize: 1 } : {
            callback: (v) => `₱${v.toLocaleString()}`,
          }),
        },
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#374151',
          font: { size: 13, weight: '500' },
        },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  }

  // Export CSV — one row per line item for a proper sales report
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Order ID,Date,Shopper,Shopper Email,Product,Qty,Unit Price (PHP),Subtotal (PHP),Order Total (PHP),Delivery Status\n"

    vendorOrders.forEach(o => {
      o.items.forEach(item => {
        // Wrap string fields in quotes to safely handle commas in names
        const row = [
          o.order_id,
          o.ordered_at,
          `"${o.shopper_name}"`,
          `"${o.shopper_email}"`,
          `"${item.product_name}"`,
          item.quantity,
          Number(item.unit_price).toFixed(2),
          Number(item.subtotal).toFixed(2),
          Number(o.total_amount).toFixed(2),
          o.delivery_status,
        ]
        csvContent += row.join(",") + "\n"
      })
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    // Append today's date to the filename for traceability
    link.setAttribute("download", `sales_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const chartToggleStyle = (active) => ({
    padding: '8px 20px',
    fontSize: '0.85rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: active ? '#3b82f6' : '#f1f5f9',
    color: active ? '#fff' : '#64748b',
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111' }}>📊 System Report & Analytics</h3>
        <button onClick={handleExportCSV} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {stats.map((s, i) => {
          const isUp = s.change >= 0
          return (
            <div key={i} style={{ flex: '1 1 200px', background: '#f3f4f6', padding: '20px', borderRadius: '8px', borderLeft: `4px solid ${s.color}` }}>
              <div style={{ color: '#6b7280', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#111', marginTop: '8px' }}>{s.value}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: s.change === 0 ? '#9ca3af' : isUp ? '#059669' : '#dc2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  background: s.change === 0 ? '#f3f4f6' : isUp ? '#ecfdf5' : '#fef2f2',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}>
                  {s.change === 0 ? '—' : isUp ? '↑' : '↓'} {Math.abs(s.change).toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>vs prev {dateRange}d</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart Section */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '24px' }}>
        {/* Chart Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => { setChartView('sales'); setSelectedProduct(null); }}
              style={chartToggleStyle(chartView === 'sales')}
            >
              📈 Sales Chart
            </button>
            <button
              onClick={() => { setChartView('products'); setSelectedProduct(null); }}
              style={chartToggleStyle(chartView === 'products')}
            >
              📊 Top Products
            </button>
            <button
              onClick={() => { setChartView('calendar'); setSelectedProduct(null); }}
              style={chartToggleStyle(chartView === 'calendar')}
            >
              📅 Calendar
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {chartView === 'sales' && (
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                {[7, 14, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setDateRange(d)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: dateRange === d ? '#3b82f6' : 'transparent',
                      color: dateRange === d ? '#fff' : '#94a3b8',
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            )}
            {chartView === 'products' && (
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                {[{ key: 'qty', label: 'Qty Sold' }, { key: 'revenue', label: 'Revenue' }].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setBarMetric(m.key)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: barMetric === m.key ? '#8b5cf6' : 'transparent',
                      color: barMetric === m.key ? '#fff' : '#94a3b8',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {chartView === 'sales'
                ? `Revenue over last ${dateRange} days`
                : chartView === 'calendar'
                ? 'Click a date to view daily product analytics'
                : `Top ${sortedProducts.length} products by ${barMetric === 'qty' ? 'quantity sold' : 'revenue'}`}
            </span>
          </div>
        </div>

        {/* Charts */}
        <div style={{ minHeight: '320px', position: 'relative' }}>
          {chartView === 'sales' ? (
            <div style={{ height: '320px' }}>
            {sortedDates.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                <p>No sales data available yet.</p>
              </div>
            ) : (
              <Line data={salesLineData} options={salesLineOptions} plugins={[crosshairPlugin]} />
            )}
            </div>
          ) : chartView === 'products' ? (
            <div style={{ height: '320px' }}>
            {selectedProduct ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#111' }}>📈 {selectedProduct} Sales Trend</h4>
                  <button onClick={() => setSelectedProduct(null)} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, padding: '4px 12px', borderRadius: '6px' }}>← Back to All Products</button>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Line data={productLineData} options={productLineOptions} plugins={[crosshairPlugin]} />
                </div>
              </div>
            ) : topProducts.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                <p>No products sold yet.</p>
              </div>
            ) : (
              <Bar data={productsBarData} options={productsBarOptions} plugins={[barLabelPlugin]} />
            )}
            </div>
          ) : (
            /* ── Calendar View ── */
            (() => {
              const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
              const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay()
              const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
              const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

              // Build daily revenue map for this month
              const dailyRevMap = {}
              let maxDayRev = 0
              vendorOrders.forEach(o => {
                const dStr = o.ordered_at ? o.ordered_at.split(' ')[0] : null
                if (!dStr) return
                const [y, m] = dStr.split('-').map(Number)
                if (y === calendarYear && m === calendarMonth + 1) {
                  if (!dailyRevMap[dStr]) dailyRevMap[dStr] = 0
                  dailyRevMap[dStr] += parseFloat(o.total_amount) || 0
                  if (dailyRevMap[dStr] > maxDayRev) maxDayRev = dailyRevMap[dStr]
                }
              })

              // Selected date / range snapshot
              const hasRange = calMode === 'range' && calRangeStart && calRangeEnd
              const hasSingle = calMode === 'single' && selectedCalDate
              const showSnapshot = hasRange || hasSingle

              let snapOrders = [], snapRevenue = 0, snapItems = 0, snapProductMap = {}
              if (showSnapshot) {
                vendorOrders.forEach(o => {
                  const dStr = o.ordered_at ? o.ordered_at.split(' ')[0] : null
                  if (!dStr) return
                  let match = false
                  if (hasSingle) {
                    match = dStr === selectedCalDate
                  } else {
                    match = dStr >= calRangeStart && dStr <= calRangeEnd
                  }
                  if (match) {
                    snapOrders.push(o)
                    snapRevenue += parseFloat(o.total_amount) || 0
                    o.items.forEach(item => {
                      const n = item.product_name
                      if (!snapProductMap[n]) snapProductMap[n] = { qty: 0, rev: 0 }
                      snapProductMap[n].qty += parseInt(item.quantity, 10) || 0
                      snapProductMap[n].rev += parseFloat(item.subtotal) || 0
                      snapItems += parseInt(item.quantity, 10) || 0
                    })
                  }
                })
              }
              const snapProductList = Object.entries(snapProductMap).sort((a, b) => b[1].rev - a[1].rev)
              const todayStr = new Date().toISOString().split('T')[0]

              // Date click handler
              const handleCalClick = (dateStr) => {
                if (calMode === 'single') {
                  setSelectedCalDate(dateStr === selectedCalDate ? null : dateStr)
                } else {
                  if (!calRangeStart || (calRangeStart && calRangeEnd)) {
                    setCalRangeStart(dateStr)
                    setCalRangeEnd(null)
                  } else {
                    if (dateStr < calRangeStart) {
                      setCalRangeEnd(calRangeStart)
                      setCalRangeStart(dateStr)
                    } else if (dateStr === calRangeStart) {
                      setCalRangeStart(null)
                    } else {
                      setCalRangeEnd(dateStr)
                    }
                  }
                }
              }

              // Check if a date is in the selected range
              const isInSelectedRange = (dateStr) => {
                if (calMode !== 'range') return false
                if (calRangeStart && calRangeEnd) return dateStr >= calRangeStart && dateStr <= calRangeEnd
                return dateStr === calRangeStart
              }

              return (
                <div>
                  {/* Mode Toggle + Month Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                      <button onClick={() => { setCalMode('single'); setCalRangeStart(null); setCalRangeEnd(null) }} style={{ padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', background: calMode === 'single' ? '#3b82f6' : 'transparent', color: calMode === 'single' ? '#fff' : '#94a3b8' }}>📌 Single Day</button>
                      <button onClick={() => { setCalMode('range'); setSelectedCalDate(null) }} style={{ padding: '5px 14px', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', background: calMode === 'range' ? '#8b5cf6' : 'transparent', color: calMode === 'range' ? '#fff' : '#94a3b8' }}>📅 Date Range</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => { if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) } else setCalendarMonth(m => m - 1) }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: '1rem' }}>◀</button>
                      <h4 style={{ margin: 0, fontSize: '1.15rem', color: '#111', fontWeight: 700 }}>{monthNames[calendarMonth]} {calendarYear}</h4>
                      <button onClick={() => { if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) } else setCalendarMonth(m => m + 1) }} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: '1rem' }}>▶</button>
                    </div>
                  </div>

                  {/* Range hint */}
                  {calMode === 'range' && (
                    <div style={{ marginBottom: '12px', padding: '8px 14px', background: calRangeStart && !calRangeEnd ? '#fef3c7' : calRangeStart && calRangeEnd ? '#ecfdf5' : '#f0f9ff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500, color: calRangeStart && !calRangeEnd ? '#92400e' : calRangeStart && calRangeEnd ? '#065f46' : '#1e40af', border: `1px solid ${calRangeStart && !calRangeEnd ? '#fde68a' : calRangeStart && calRangeEnd ? '#a7f3d0' : '#bfdbfe'}` }}>
                      {!calRangeStart ? '👆 Click a start date' : !calRangeEnd ? `📍 Start: ${calRangeStart} — now click an end date` : `✅ Range: ${calRangeStart} → ${calRangeEnd}`}
                      {(calRangeStart || calRangeEnd) && (
                        <button onClick={() => { setCalRangeStart(null); setCalRangeEnd(null) }} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>✕ Clear</button>
                      )}
                    </div>
                  )}

                  {/* Calendar Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {dayNames.map(d => (
                      <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', padding: '6px 0', textTransform: 'uppercase' }}>{d}</div>
                    ))}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const rev = dailyRevMap[dateStr] || 0
                      const intensity = maxDayRev > 0 ? Math.min(rev / maxDayRev, 1) : 0
                      const isToday = dateStr === todayStr
                      const isSelected = calMode === 'single' && dateStr === selectedCalDate
                      const isRangeSelected = isInSelectedRange(dateStr)
                      const isRangeEdge = dateStr === calRangeStart || dateStr === calRangeEnd
                      const isFuture = new Date(dateStr) > new Date()

                      return (
                        <div
                          key={day}
                          onClick={() => !isFuture && handleCalClick(dateStr)}
                          style={{
                            position: 'relative',
                            padding: '8px 4px',
                            minHeight: '52px',
                            borderRadius: '8px',
                            cursor: isFuture ? 'default' : 'pointer',
                            opacity: isFuture ? 0.35 : 1,
                            transition: 'all 0.2s',
                            border: isSelected ? '2px solid #3b82f6' : isRangeEdge ? '2px solid #8b5cf6' : isRangeSelected ? '1px solid #c4b5fd' : isToday ? '2px solid #10b981' : '1px solid #e5e7eb',
                            background: isSelected ? 'rgba(59,130,246,0.08)' : isRangeEdge ? 'rgba(139,92,246,0.15)' : isRangeSelected ? 'rgba(139,92,246,0.06)' : rev > 0 ? `rgba(59,130,246,${0.04 + intensity * 0.18})` : '#fafafa',
                            textAlign: 'center',
                          }}
                          onMouseEnter={e => { if (!isFuture) e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                        >
                          <div style={{ fontSize: '0.85rem', fontWeight: isToday || isSelected || isRangeEdge ? 800 : 500, color: isSelected ? '#3b82f6' : isRangeEdge ? '#7c3aed' : isRangeSelected ? '#6d28d9' : isToday ? '#10b981' : '#374151' }}>{day}</div>
                          {rev > 0 && (
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: isRangeSelected ? '#7c3aed' : '#3b82f6', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>₱{rev >= 1000 ? `${(rev/1000).toFixed(1)}k` : rev.toFixed(0)}</div>
                          )}
                          {rev > 0 && (
                            <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: `${12 + intensity * 20}px`, height: '3px', borderRadius: '2px', background: isRangeSelected ? `rgba(139,92,246,${0.3 + intensity * 0.7})` : `rgba(59,130,246,${0.3 + intensity * 0.7})` }} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Less</span>
                    {[0.05, 0.1, 0.15, 0.2, 0.25].map((op, i) => (
                      <div key={i} style={{ width: '14px', height: '14px', borderRadius: '3px', background: `rgba(59,130,246,${op})`, border: '1px solid rgba(59,130,246,0.15)' }} />
                    ))}
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>More Revenue</span>
                  </div>

                  {/* Snapshot Panel */}
                  {showSnapshot && (
                    <div style={{ marginTop: '24px', animation: 'slideFadeIn 0.3s ease-out' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#111' }}>
                          {hasRange ? '📊' : '📋'} {hasRange ? 'Range Analytics' : 'Daily Snapshot'} — {hasRange
                            ? `${new Date(calRangeStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(calRangeEnd + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                            : new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h4>
                        <button onClick={() => { setSelectedCalDate(null); setCalRangeStart(null); setCalRangeEnd(null) }} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>✕ Close</button>
                      </div>

                      {/* Summary Cards */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {[
                          { label: 'Revenue', value: `₱${snapRevenue.toFixed(2)}`, icon: '💰', color: '#3b82f6' },
                          { label: 'Orders', value: snapOrders.length, icon: '🛒', color: '#8b5cf6' },
                          { label: 'Items Sold', value: snapItems, icon: '📦', color: '#10b981' },
                          { label: 'Products', value: snapProductList.length, icon: '🏷️', color: '#f59e0b' },
                          ...(hasRange ? [{ label: 'Avg/Day', value: `₱${(() => { const d1 = new Date(calRangeStart); const d2 = new Date(calRangeEnd); const days = Math.max(1, Math.round((d2 - d1) / 86400000) + 1); return (snapRevenue / days).toFixed(2) })()}`, icon: '📈', color: '#06b6d4' }] : []),
                        ].map((c, i) => (
                          <div key={i} style={{ flex: '1 1 120px', background: '#f8fafc', padding: '14px', borderRadius: '8px', borderLeft: `3px solid ${c.color}` }}>
                            <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>{c.icon} {c.label}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111', marginTop: '4px' }}>{c.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Product Breakdown Table */}
                      {snapProductList.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Qty Sold</th>
                                <th>Revenue</th>
                                <th>% of Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {snapProductList.map(([name, data]) => (
                                <tr key={name}>
                                  <td style={{ fontWeight: 600, color: '#334155' }}>{name}</td>
                                  <td>{data.qty}</td>
                                  <td style={{ fontWeight: 700, color: '#111' }}>₱{data.rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', maxWidth: '80px' }}>
                                        <div style={{ width: `${snapRevenue > 0 ? (data.rev / snapRevenue * 100) : 0}%`, height: '100%', background: hasRange ? '#8b5cf6' : '#3b82f6', borderRadius: '3px', transition: 'width 0.5s' }} />
                                      </div>
                                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{snapRevenue > 0 ? (data.rev / snapRevenue * 100).toFixed(1) : 0}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
                          <p style={{ margin: 0, fontSize: '0.95rem' }}>📭 No sales recorded {hasRange ? 'in this range' : 'on this date'}.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()
          )}
        </div>

        {chartView === 'products' && allProductsSold.length > 0 && (
          <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Period Summary ({dateRange} Days)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111', marginTop: '4px' }}>
                  {allProductsSold.length} Unique Products
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Items Sold</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {allProductsSold.reduce((sum, [_, data]) => sum + data.qty, 0)} items
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Revenue generated</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>
                  ₱{allProductsSold.reduce((sum, [_, data]) => sum + data.rev, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#111' }}>Full List of Products Sold</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Quantity Sold</th>
                    <th>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {allProductsSold.map(([name, data]) => (
                    <tr 
                      key={name}
                      onClick={() => { setChartView('products'); setSelectedProduct(name); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title={`View sales chart for ${name}`}
                    >
                      <td style={{ fontWeight: 600, color: '#334155' }}>{name}</td>
                      <td>{data.qty}</td>
                      <td style={{ fontWeight: 700, color: '#111' }}>₱{data.rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function VendorDashboard({ currentUser, token, onLogout }) {
  const [vendorTab, setVendorTab] = useState('analytics')
  
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [user, setUser] = useState(currentUser)

  // Product State
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productError, setProductError] = useState('')
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)
  const [productForm, setProductForm] = useState(emptyProductForm)

  // Sales State
  const [vendorOrders, setVendorOrders] = useState([])
  const [salesFilter, setSalesFilter] = useState('all') // 'all' | delivery_status values
  const [lowStockDismissed, setLowStockDismissed] = useState(false)

  // Banner Profile State
  const [bannerFile, setBannerFile] = useState(null)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerSuccess, setBannerSuccess] = useState('')

  // Reviews State
  const [myReviews, setMyReviews] = useState([])
  const [myAvgRating, setMyAvgRating] = useState(0)

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([])
  const [activityLogsLoading, setActivityLogsLoading] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }

  const fetchProducts = async () => {
    if (!token) return
    setProductsLoading(true); setProductError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/products`, { 
        headers: {
          ...authHeaders,
          'Accept': 'application/json'
        }
      })
      if (!res.ok) { 
        const error = await extractError(res)
        setProductError(error)
        if (res.status === 401) onLogout()
        return 
      }
      const d = await res.json()
      setProducts(Array.isArray(d) ? d : d?.data ?? [])
    } catch (err) { 
      console.error('Fetch products error:', err)
      setProductError('Unable to load products.') 
    } finally { 
      setProductsLoading(false) 
    }
  }

  const fetchVendorOrders = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/history`, { headers: authHeaders })
      if (!res.ok) return
      const d = await res.json()
      setVendorOrders(Array.isArray(d) ? d : [])
    } catch { /* silent */ }
  }

  const handleMarkReady = async (orderId) => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/ready`, { method: 'POST', headers: authHeaders })
      if (res.ok) await fetchVendorOrders()
    } catch { /* silent */ }
  }

  // ── Flash Sale ──────────────────────────────────────────────────────────────
  const [flashSaleProductId, setFlashSaleProductId] = useState(null)
  const [flashSaleForm, setFlashSaleForm] = useState({ flash_price: '', flash_expires_at: '' })
  const [flashSaleLoading, setFlashSaleLoading] = useState(false)
  const [flashSaleMsg, setFlashSaleMsg] = useState('')

  const handleFlashSale = async (productId, enable) => {
    setFlashSaleLoading(true); setFlashSaleMsg('')
    try {
      const body = enable
        ? { is_flash_sale: true, flash_price: parseFloat(flashSaleForm.flash_price), flash_expires_at: flashSaleForm.flash_expires_at }
        : { is_flash_sale: false }
      const res = await fetch(`${API_BASE_URL}/api/products/${productId}/flash-sale`, {
        method: 'POST', 
        headers: { ...authHeaders, 'Content-Type': 'application/json' }, 
        body: JSON.stringify(body)
      })
      const d = await res.json()
      setFlashSaleMsg(res.ok ? `✅ ${d.message}` : `❌ ${d.message}`)
      if (res.ok) { setFlashSaleProductId(null); setFlashSaleForm({ flash_price: '', flash_expires_at: '' }); await fetchProducts() }
    } catch { setFlashSaleMsg('❌ Unable to update flash sale.') }
    finally { setFlashSaleLoading(false) }
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault(); setIsSavingProduct(true); setProductError('')
    const isEdit = Boolean(editingProductId)
    const url = isEdit ? `${API_BASE_URL}/api/products/${editingProductId}` : `${API_BASE_URL}/api/products`

    const formData = new FormData()
    formData.append('product_name', productForm.product_name)
    formData.append('category', productForm.category)
    formData.append('price', Number(productForm.price))
    formData.append('unit', productForm.unit)
    formData.append('stock_qty', Number(productForm.stock_qty))
    if (productForm.image) {
      formData.append('image', productForm.image)
    }
    if (isEdit) {
      formData.append('_method', 'PUT')
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: formData
      })
      if (!res.ok) { setProductError(await extractError(res)); return }
      setProductForm(emptyProductForm); setEditingProductId(null);
      const fileInput = document.getElementById('productImageInput');
      if (fileInput) fileInput.value = '';
      await fetchProducts()
    } catch { setProductError('Unable to save product.') }
    finally { setIsSavingProduct(false) }
  }

  const startEditProduct = (p) => {
    setEditingProductId(p.id)
    setProductForm({ product_name: p.product_name ?? '', category: p.category ?? '', price: String(p.price ?? ''), unit: p.unit ?? '', stock_qty: String(p.stock_qty ?? ''), image: null })
    const fileInput = document.getElementById('productImageInput');
    if (fileInput) fileInput.value = '';
    setProductError('')
  }

  const cancelEdit = () => { 
    setEditingProductId(null); 
    setProductForm(emptyProductForm);
    const fileInput = document.getElementById('productImageInput');
    if (fileInput) fileInput.value = '';
  }

  const handleDeleteProduct = async (id) => {
    setProductError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE', headers: authHeaders })
      if (!res.ok) { setProductError(await extractError(res)); return }
      setProducts((prev) => prev.filter((p) => p.id !== id))
      if (editingProductId === id) cancelEdit()
    } catch { setProductError('Unable to delete product.') }
  }

  const handleBannerUpload = async (e) => {
    e.preventDefault()
    if (!bannerFile) return
    setIsUploadingBanner(true)
    setBannerError('')
    setBannerSuccess('')

    const formData = new FormData()
    formData.append('banner', bannerFile)

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/banner`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (!res.ok) { setBannerError(await extractError(res)); return }
      const data = await res.json()
      setBannerSuccess('Banner updated successfully!')
      localStorage.setItem('mercago_user', JSON.stringify(data.user))
      currentUser.banner_url = data.user.banner_url
    } catch {
      setBannerError('Unable to upload banner.')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const fetchVendorReviews = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendor/reviews`, { headers: authHeaders })
      if (!res.ok) return
      const d = await res.json()
      setMyReviews(d.reviews || [])
      setMyAvgRating(d.avg_rating || 0)
    } catch { /* silent */ }
  }

  const fetchActivityLogs = async () => {
    if (!token) return
    setActivityLogsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/activity`, { headers: authHeaders })
      if (!res.ok) return
      const d = await res.json()
      setActivityLogs(Array.isArray(d) ? d : [])
    } catch { /* silent */ }
    finally { setActivityLogsLoading(false) }
  }

  useEffect(() => {
    if (!token) return
    fetchProducts()
    fetchVendorOrders()
    fetchVendorReviews()
    fetchActivityLogs()
  }, [token])

  return (
    <section>
      <div className="dashboard-head">
        <div>
          <h2>Vendor Dashboard</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.9rem', opacity: 0.7 }}>
            {user.first_name} {user.last_name} &bull; <em>vendor</em>
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

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={vendorTab === 'analytics' ? 'tab active' : 'tab'} type="button" onClick={() => { setVendorTab('analytics'); fetchVendorOrders() }}>Analytics</button>
        <button className={vendorTab === 'products' ? 'tab active' : 'tab'} type="button" onClick={() => setVendorTab('products')}>My Products</button>
        <button className={vendorTab === 'sales' ? 'tab active' : 'tab'} type="button" onClick={() => { setVendorTab('sales'); fetchVendorOrders() }}>Sales History</button>
        <button className={vendorTab === 'profile' ? 'tab active' : 'tab'} type="button" onClick={() => setVendorTab('profile')}>Store Profile</button>
        <button className={vendorTab === 'activity' ? 'tab active' : 'tab'} type="button" onClick={() => { setVendorTab('activity'); fetchActivityLogs() }}>Audit Log</button>
      </div>

      {vendorTab === 'analytics' && (
        <>
          {/* ── Low Stock Alert Banner ── */}
          {!lowStockDismissed && products.filter(p => p.stock_qty < 5).length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px',
              padding: '12px 16px', marginBottom: '16px', gap: '12px', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#c2410c', fontSize: '0.9rem' }}>
                    {products.filter(p => p.stock_qty < 5).length} product{products.filter(p => p.stock_qty < 5).length > 1 ? 's are' : ' is'} running low on stock
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#9a3412', marginTop: '2px' }}>
                    {products.filter(p => p.stock_qty < 5).map(p => (
                      <span key={p.id} style={{
                        display: 'inline-block', background: '#ffedd5', border: '1px solid #fed7aa',
                        borderRadius: '4px', padding: '1px 8px', marginRight: '6px', marginTop: '2px',
                      }}>
                        {p.product_name} <strong style={{ color: p.stock_qty === 0 ? '#dc2626' : '#ea580c' }}>({p.stock_qty === 0 ? 'Out of stock' : `${p.stock_qty} left`})</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => setVendorTab('products')}
                  style={{ background: '#ea580c', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Restock Now
                </button>
                <button
                  onClick={() => setLowStockDismissed(true)}
                  style={{ background: 'none', border: 'none', color: '#9a3412', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 6px', lineHeight: 1 }}
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          <VendorAnalytics vendorOrders={vendorOrders} />
        </>
      )}

      {vendorTab === 'products' && (
        <>
          {productError ? <p className="error">{productError}</p> : null}
          <form className="form-grid" onSubmit={handleSaveProduct}>
            <h3>{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
            <label>Product Name<input type="text" value={productForm.product_name} onChange={(e) => setProductForm((p) => ({ ...p, product_name: e.target.value }))} required /></label>
            <label>Category<input type="text" value={productForm.category} onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))} required /></label>
            <label>Price<input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} required /></label>
            <label>Unit
              <select value={productForm.unit} onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))} required>
                <option value="" disabled>Select Unit</option>
                <option value="kg">kg</option>
                <option value="gram">gram</option>
                <option value="liters">liters</option>
                <option value="ml">ml</option>
                <option value="pieces">pieces</option>
                <option value="packs">packs</option>
              </select>
            </label>
            <label>Stock<input type="number" min="0" step="any" value={productForm.stock_qty} onChange={(e) => setProductForm((p) => ({ ...p, stock_qty: e.target.value }))} required /></label>
            <label>Product Image<input id="productImageInput" type="file" accept="image/*" onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.files[0] }))} /></label>
            <div className="actions">
              <button type="submit" disabled={isSavingProduct}>{isSavingProduct ? 'Saving...' : editingProductId ? 'Update Product' : 'Create Product'}</button>
              {editingProductId ? <button type="button" className="secondary-btn" onClick={cancelEdit}>Cancel</button> : null}
            </div>
          </form>

          <div className="list-head">
            <h3>{currentUser.first_name}&apos;s Products</h3>
            <button type="button" className="secondary-btn" onClick={fetchProducts}>Refresh</button>
          </div>
          {productsLoading ? <p>Loading...</p> : null}
          {!productsLoading && products.length === 0 ? <p className="empty-note">No products yet.</p> : null}
          {!productsLoading && products.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Unit</th><th>Stock</th><th>⚡ Flash</th><th>Actions</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.image_url ? <img src={p.image_url} alt="img" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} /> : <span style={{opacity:0.5}}>No Image</span>}</td>
                      <td>{p.product_name}</td>
                      <td>{p.category}</td>
                      <td>₱{Number(p.price).toFixed(2)}</td>
                      <td>{p.unit}</td>
                      <td>
                        {p.stock_qty === 0 ? (
                          <span style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>Out of Stock</span>
                        ) : p.stock_qty < 5 ? (
                          <span style={{ background: '#fff7ed', color: '#ea580c', fontWeight: 700, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>Low — {p.stock_qty}</span>
                        ) : (
                          <span style={{ background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>In Stock — {p.stock_qty}</span>
                        )}
                      </td>
                      <td>
                        {p.flash_active
                          ? <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.72rem', padding: '3px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>⚡ ₱{Number(p.flash_price).toFixed(2)}</span>
                          : <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>—</span>
                        }
                      </td>
                      <td className="row-actions">
                        <button type="button" onClick={() => startEditProduct(p)}>Edit</button>
                        <button type="button"
                          onClick={() => { setFlashSaleProductId(flashSaleProductId === p.id ? null : p.id); setFlashSaleMsg('') }}
                          style={{ background: p.flash_active ? '#fef2f2' : '#fff7ed', color: p.flash_active ? '#dc2626' : '#ea580c', border: `1px solid ${p.flash_active ? '#fca5a5' : '#fed7aa'}`, borderRadius: 6, padding: '4px 10px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          {p.flash_active ? '⚡ On' : '⚡ Off'}
                        </button>
                        <button type="button" className="danger-btn" onClick={() => handleDeleteProduct(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* ── Flash Sale Inline Form ── */}
          {flashSaleProductId && (() => {
            const p = products.find(x => x.id === flashSaleProductId)
            if (!p) return null
            return (
              <div style={{ border: '2px solid #fca5a5', borderRadius: 10, padding: '1rem 1.25rem', marginTop: 16, background: '#fff5f5' }}>
                <h4 style={{ margin: '0 0 4px', color: '#dc2626' }}>⚡ Flash Sale — {p.product_name}</h4>
                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#6b7280' }}>Regular price: ₱{Number(p.price).toFixed(2)}. Set a lower flash price and an expiry time.</p>
                {flashSaleMsg && <p style={{ margin: '0 0 8px', fontWeight: 600, color: flashSaleMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>{flashSaleMsg}</p>}
                {p.flash_active && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button type="button" onClick={() => handleFlashSale(p.id, false)} disabled={flashSaleLoading}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
                      🛑 End Flash Sale
                    </button>
                    <button type="button" onClick={() => setFlashSaleProductId(null)}
                      style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={e => { e.preventDefault(); handleFlashSale(p.id, true) }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ flex: '1 1 140px' }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>Flash Price (₱)</span>
                    <input type="number" min="0" step="0.01" value={flashSaleForm.flash_price}
                      onChange={e => setFlashSaleForm(f => ({ ...f, flash_price: e.target.value }))} required
                      placeholder={`e.g. ${Math.round(p.price * 0.7)}`}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #fca5a5', fontSize: '0.9rem' }} />
                  </label>
                  <label style={{ flex: '1 1 200px' }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>Expires At</span>
                    <input type="datetime-local" value={flashSaleForm.flash_expires_at}
                      onChange={e => setFlashSaleForm(f => ({ ...f, flash_expires_at: e.target.value }))} required
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #fca5a5', fontSize: '0.9rem' }} />
                  </label>
                  <button type="submit" disabled={flashSaleLoading}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {flashSaleLoading ? 'Saving...' : '⚡ Activate Flash Sale'}
                  </button>
                  <button type="button" onClick={() => setFlashSaleProductId(null)}
                    style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </form>
              </div>
            )
          })()}

        </>
      )}

      {vendorTab === 'sales' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Sales History</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Status filter pills */}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'finding_rider', label: 'Finding Rider' },
                  { key: 'found_rider', label: 'Found Rider' },
                  { key: 'ongoing', label: 'Ongoing' },
                  { key: 'completed', label: 'Delivered' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setSalesFilter(f.key)}
                    style={{
                      padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600,
                      border: 'none', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s',
                      background: salesFilter === f.key ? '#2563eb' : 'transparent',
                      color: salesFilter === f.key ? '#fff' : '#94a3b8',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button type="button" className="secondary-btn" onClick={fetchVendorOrders}>Refresh</button>
            </div>
          </div>
          {(() => {
            const filtered = salesFilter === 'all'
              ? vendorOrders
              : vendorOrders.filter(o => o.delivery_status === salesFilter)
            const filteredTotal = filtered.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0)
            return (
              <>
                {filtered.length === 0
                  ? <p className="empty-note">No orders match this filter.</p>
                  : filtered.map((order) => (
                    <div key={order.order_id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <strong>🛍 {order.shopper_name}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{order.shopper_email}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <StatusBadge status={order.delivery_status} />
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{order.ordered_at}</span>
                          {order.delivery_status === 'found_rider' && (
                            <button 
                              onClick={() => handleMarkReady(order.order_id)}
                              style={{ 
                                marginTop: 8, background: '#10b981', color: '#fff', border: 'none', 
                                padding: '16px 32px', borderRadius: '12px', fontSize: '1.2rem', 
                                fontWeight: '900', cursor: 'pointer', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)',
                                transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px'
                              }}
                              onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; e.target.style.background = '#059669' }}
                              onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.background = '#10b981' }}
                            >
                              🚀 Ready for Pickup
                            </button>
                          )}
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
                {filtered.length > 0 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '12px 16px', marginTop: '8px',
                  }}>
                    <span style={{ color: '#6b7280', fontSize: '0.85rem', fontWeight: 500 }}>
                      {filtered.length} order{filtered.length !== 1 ? 's' : ''} shown
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e3a8a' }}>
                      Total: ₱{filteredTotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}

      {vendorTab === 'profile' && (
        <div style={{ maxWidth: 600 }}>
          <h3 style={{ marginBottom: '1rem' }}>Store Profile</h3>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem' }}>Store Banner</h4>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Upload a banner to display on the marketplace home page. Recommended size: 1200x300. Max size: 5MB.
            </p>
            
            {currentUser.banner_url && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Current Banner:</p>
                <img 
                  src={currentUser.banner_url?.startsWith('http') ? currentUser.banner_url : `${API_BASE_URL}${currentUser.banner_url}`} 
                  alt="Current Banner" 
                  style={{ width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
                />
              </div>
            )}

            {bannerError && <div className="error-msg" style={{ marginBottom: '1rem' }}>{bannerError}</div>}
            {bannerSuccess && <div style={{ color: '#059669', background: '#ecfdf5', padding: '10px', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>{bannerSuccess}</div>}

            <form onSubmit={handleBannerUpload}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setBannerFile(e.target.files[0])} 
                  required 
                />
              </div>
              <button type="submit" disabled={isUploadingBanner || !bannerFile}>
                {isUploadingBanner ? 'Uploading...' : 'Upload Banner'}
              </button>
            </form>
          </div>

          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Store Reviews</h4>
              <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                ★ {myAvgRating > 0 ? myAvgRating : 'New'}
              </span>
            </div>
            
            {myReviews.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem', fontStyle: 'italic' }}>No reviews yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myReviews.map(review => (
                  <div key={review.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#111' }}>{review.user?.first_name} {review.user?.last_name}</strong>
                      <span style={{ color: '#f59e0b', fontSize: '0.9rem' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                    </div>
                    {review.comment && <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>{review.comment}</p>}
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>{new Date(review.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {vendorTab === 'activity' && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>🔍 Audit Log</h3>
            <button type="button" className="secondary-btn" onClick={fetchActivityLogs}>Refresh</button>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
            A detailed trail of <strong>your own actions</strong> on the platform — product edits, price changes, deletions. For order history, see the <strong>Sales History</strong> tab.
          </p>

          {activityLogsLoading ? (
            <p>Loading activity logs...</p>
          ) : activityLogs.length === 0 ? (
            <p className="empty-note">No activity recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Action Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#475569' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ 
                          background: '#f1f5f9', color: '#334155', 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' 
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.9rem', color: '#111' }}>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
