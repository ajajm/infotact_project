import React, { useState, useEffect } from 'react';
import { usePOSStore } from './store/usePOSStore.js';
import Login from './components/Login.jsx';
import POSInterface from './components/POSInterface.jsx';
import Dashboard from './components/Dashboard.jsx';
import { 
  ShoppingBag, 
  LayoutDashboard, 
  LogOut, 
  MapPin, 
  Wifi, 
  WifiOff, 
  UserCheck 
} from 'lucide-react';

export default function App() {
  const {
    token,
    user,
    currentStore,
    stores,
    isOnline,
    setStore,
    fetchStores,
    logout
  } = usePOSStore();

  const [activeTab, setActiveTab] = useState('pos'); // 'pos' or 'dashboard'

  // Fetch stores list upon login
  useEffect(() => {
    if (token) {
      fetchStores();
    }
  }, [token]);

  if (!token || !user) {
    return <Login />;
  }

  const handleStoreSelect = (e) => {
    const storeId = e.target.value;
    const store = stores.find(s => s._id === storeId);
    if (store) {
      setStore(store);
    }
  };

  const isManagementAllowed = user.role === 'admin' || user.role === 'manager';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 font-sans selection:bg-brand-500">
      
      {/* GLOBAL HEADER */}
      <header className="h-16 glass-panel border-b border-slate-900 px-6 flex items-center justify-between shrink-0 relative z-30">
        
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center border border-brand-500 shadow-md shadow-brand-500/20">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold tracking-tight text-white text-base">
            Omni<span className="text-brand-500">POS</span>
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all flex items-center space-x-2 ${
              activeTab === 'pos'
                ? 'bg-brand-600/10 text-brand-500 border-brand-500/30'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>POS Register</span>
          </button>
          
          {isManagementAllowed && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all flex items-center space-x-2 ${
                activeTab === 'dashboard'
                  ? 'bg-brand-600/10 text-brand-500 border-brand-500/30'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          )}
        </div>

        {/* User Identity and Store selection */}
        <div className="flex items-center space-x-4">
          
          {/* Store select widget */}
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-brand-500" />
            <select
              value={currentStore?._id || currentStore?.id || ''}
              onChange={handleStoreSelect}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:border-brand-500 text-slate-200"
            >
              <option value="">Choose Store...</option>
              {stores.map(store => (
                <option key={store._id} value={store._id}>{store.name}</option>
              ))}
            </select>
          </div>

          {/* User metadata */}
          <div className="flex items-center space-x-2 border-l border-slate-900 pl-4">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-200">{user.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{user.role}</p>
            </div>
            
            <button
              onClick={logout}
              title="Logout session"
              className="p-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* OFFLINE STICKY BANNER */}
      {!isOnline && (
        <div className="bg-rose-600 text-white py-1 px-4 text-center text-xs font-bold flex items-center justify-center space-x-2 shadow-inner shrink-0 relative z-20">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>Local database operations are running offline. Orders will cache in browser until internet link is restored.</span>
        </div>
      )}

      {/* CORE PAGE VIEWS */}
      <main className="flex-1 min-h-0 bg-slate-950/40 relative z-10">
        {activeTab === 'pos' ? (
          currentStore ? (
            <POSInterface />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
              <MapPin className="w-16 h-16 text-brand-500 stroke-1 mb-4 animate-bounce" />
              <p className="font-semibold text-slate-300">No Store Node Assigned</p>
              <p className="text-xs text-slate-500 mt-1.5">Select a store from the header dropdown to enable register terminals.</p>
            </div>
          )
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}
