import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../store/usePOSStore.js';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ShoppingBag, 
  FileText, 
  Plus, 
  Settings, 
  PieChart as PieIcon,
  RefreshCw
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function Dashboard() {
  const { token, stores, fetchStores } = usePOSStore();
  const [selectedStore, setSelectedStore] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states for stock reconciliation
  const [reconSku, setReconSku] = useState('');
  const [reconQty, setReconQty] = useState('');
  const [reconStore, setReconStore] = useState('');
  const [reconReorder, setReconReorder] = useState('');
  const [reconMessage, setReconMessage] = useState('');

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedStore]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // 1. Fetch Analytics
      let analyticsUrl = `${API_BASE}/orders/analytics`;
      if (selectedStore) analyticsUrl += `?storeId=${selectedStore}`;
      const analyticsRes = await fetch(analyticsUrl, { headers });
      const analyticsData = await analyticsRes.json();

      // 2. Fetch Inventory
      let inventoryUrl = `${API_BASE}/inventory`;
      if (selectedStore) inventoryUrl += `?storeId=${selectedStore}`;
      const inventoryRes = await fetch(inventoryUrl, { headers });
      const inventoryData = await inventoryRes.json();

      if (analyticsRes.ok) setAnalytics(analyticsData);
      if (inventoryRes.ok) setInventoryList(inventoryData.inventory);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (e) => {
    e.preventDefault();
    setReconMessage('');
    if (!reconSku || !reconQty || !reconStore) {
      setReconMessage('Please fill in Store, SKU, and Quantity fields.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/inventory/reconcile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          storeId: reconStore,
          sku: reconSku,
          quantity: parseInt(reconQty),
          reorderPoint: reconReorder ? parseInt(reconReorder) : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setReconMessage('✔ Stock reconciled successfully!');
        setReconSku('');
        setReconQty('');
        setReconReorder('');
        loadDashboardData(); // Refresh list
      } else {
        setReconMessage(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      setReconMessage('❌ Network error during reconciliation.');
    }
  };

  const COLORS = ['#6366f1', '#10b981', '#a855f7', '#f59e0b', '#3b82f6'];

  const formattedPieData = analytics?.paymentBreakdown?.map(item => ({
    name: item._id === 'cash' ? 'Cash' : item._id === 'credit' ? 'Credit Card' : 'UPI / QR Wallet',
    value: Math.round(item.revenue * 100) / 100
  })) || [];

  const lowStockCount = inventoryList.filter(item => item.quantity <= item.reorderPoint).length;

  return (
    <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-store overview, automated replenish metrics, and analytics</p>
        </div>

        {/* Store Selection filter */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Store Node:</label>
          <select
            value={selectedStore}
            onChange={e => setSelectedStore(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="">All Store Locations</option>
            {stores.map(store => (
              <option key={store._id} value={store._id}>{store.name} ({store.code})</option>
            ))}
          </select>
          <button
            onClick={loadDashboardData}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Analytics Highlights / KPI Blocks */}
      <div className="grid grid-cols-4 gap-6">
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Gross Sales</span>
            <h2 className="text-2xl font-bold text-white font-mono mt-1">₹{analytics?.revenue || 0}</h2>
            <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>Real-time channel synced</span>
            </p>
          </div>
          <div className="p-3.5 bg-brand-500/10 text-brand-500 rounded-xl border border-brand-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Transactions</span>
            <h2 className="text-2xl font-bold text-white font-mono mt-1">{analytics?.transactions || 0}</h2>
            <p className="text-[10px] text-slate-400 mt-1.5">Avg value: ₹{Math.round((analytics?.averageValue || 0) * 100) / 100}</p>
          </div>
          <div className="p-3.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Replenish Alerts</span>
            <h2 className={`text-2xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
              {lowStockCount}
            </h2>
            <p className="text-[10px] text-slate-400 mt-1.5">Items below reorder point</p>
          </div>
          <div className={`p-3.5 rounded-xl border ${lowStockCount > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Tax Liabilities</span>
            <h2 className="text-2xl font-bold text-white font-mono mt-1">₹{analytics?.tax || 0}</h2>
            <p className="text-[10px] text-slate-400 mt-1.5">GST gathered at checkout</p>
          </div>
          <div className="p-3.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <FileText className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recharts Graphs Section */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Sales Trend Graph (Area Chart - 2/3 width) */}
        <div className="col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[340px]">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 text-brand-500 mr-2" />
            <span>Weekly Sales Revenue Trend (INR)</span>
          </h3>
          <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.salesTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="_id" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Breakdown (Pie Chart - 1/3 width) */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-[340px]">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
            <PieIcon className="w-4 h-4 text-brand-500 mr-2" />
            <span>Payment Channels Breakdown</span>
          </h3>
          <div className="flex-1 flex items-center justify-center relative text-xs">
            {formattedPieData.length === 0 ? (
              <p className="text-slate-500">No transaction logs available.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formattedPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {formattedPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Visual Legend */}
                <div className="absolute bottom-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {formattedPieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center space-x-1.5 text-[10px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-slate-400 font-semibold">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Multi-store Inventory ledger grid & Reconciliation Forms */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Inventory grid (2/3 cols) */}
        <div className="col-span-2 glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center">
            <Package className="w-4 h-4 text-brand-500 mr-2" />
            <span>Active Store Stock Ledger</span>
          </h3>
          
          <div className="flex-1 overflow-y-auto border border-slate-900 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-3">Store Location</th>
                  <th className="p-3">Item Variant (SKU)</th>
                  <th className="p-3 text-right">Available Stock</th>
                  <th className="p-3 text-right">Reorder Threshold</th>
                  <th className="p-3 text-right">Sales Velocity (Daily)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {inventoryList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">No stock levels recorded.</td>
                  </tr>
                ) : (
                  inventoryList.map(item => {
                    const isLow = item.quantity <= item.reorderPoint;
                    return (
                      <tr key={item._id} className={`hover:bg-slate-900/30 ${isLow ? 'bg-amber-500/5 text-amber-300' : ''}`}>
                        <td className="p-3 font-semibold">{item.storeId?.name}</td>
                        <td className="p-3 font-mono">
                          <p className="font-bold text-slate-100">{item.productName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.sku}</p>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{item.quantity} units</td>
                        <td className="p-3 text-right font-mono">{item.reorderPoint} units</td>
                        <td className="p-3 text-right font-mono text-slate-400">{Math.round(item.salesVelocity * 100) / 100} units/day</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual stock reconciliation form (1/3 cols) */}
        <div className="glass-panel p-6 rounded-2xl h-[400px] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-1 flex items-center">
              <Settings className="w-4 h-4 text-brand-500 mr-2" />
              <span>Physical Audit & Reconcile</span>
            </h3>
            <p className="text-[10px] text-slate-500">Manually overrides digital ledger logs for stocktaking audits.</p>
          </div>

          <form onSubmit={handleReconcile} className="space-y-3.5 my-3 flex-1 overflow-y-auto pr-1">
            {reconMessage && (
              <div className={`p-2.5 rounded-lg text-[11px] font-semibold border ${reconMessage.startsWith('✔') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                {reconMessage}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Store</label>
              <select
                value={reconStore}
                onChange={e => setReconStore(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none"
              >
                <option value="">Select Location...</option>
                {stores.map(store => (
                  <option key={store._id} value={store._id}>{store.name} ({store.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Variant SKU / Barcode</label>
              <input
                type="text"
                value={reconSku}
                onChange={e => setReconSku(e.target.value)}
                placeholder="e.g. SKU-SHIRT-M"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Counted Qty</label>
                <input
                  type="number"
                  min="0"
                  value={reconQty}
                  onChange={e => setReconQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Alert Threshold (Opt)</label>
                <input
                  type="number"
                  min="0"
                  value={reconReorder}
                  onChange={e => setReconReorder(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none text-center font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Update Stock Levels</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
