import React, { useState, useEffect, useRef } from 'react';
import { usePOSStore } from '../store/usePOSStore.js';
import { 
  Search, 
  Trash2, 
  User, 
  CreditCard, 
  DollarSign, 
  Wallet, 
  Plus, 
  Minus, 
  Barcode, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Percent, 
  AlertTriangle 
} from 'lucide-react';

export default function POSInterface() {
  const {
    cart,
    products,
    loading,
    isOnline,
    currentStore,
    addToCart,
    removeFromCart,
    updateQuantity,
    applyDiscount,
    clearCart,
    getCartTotals,
    checkout,
    fetchProducts,
    syncOffline,
    offlineOrdersCount,
    syncing
  } = usePOSStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const searchInputRef = useRef(null);
  const barcodeInputRef = useRef(null);

  // Load products initially
  useEffect(() => {
    fetchProducts('', true);
  }, []);

  // Keyboard shortcuts event listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowPaymentModal(true);
        }
      } else if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
        } else {
          clearCart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showPaymentModal]);

  // Handle Search Input Change (with basic bounce)
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    fetchProducts(query, true);
  };

  // Simulated Barcode Scanner (Press Enter in Barcode input)
  const handleBarcodeScan = async (e) => {
    e.preventDefault();
    if (!barcodeInput) return;

    try {
      // Look up sku in database
      const API_BASE = 'http://localhost:5000/api';
      const token = localStorage.getItem('pos_token');
      const res = await fetch(`${API_BASE}/products/sku/${barcodeInput}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('SKU not found');
      }

      const data = await res.json();
      
      // Mock formatting of product & variant
      const productObj = {
        _id: data.productId,
        name: data.name,
        category: data.category,
        taxRate: data.taxRate,
        basePrice: data.basePrice
      };

      const variantObj = data.variant;

      addToCart(productObj, variantObj);
      setBarcodeInput('');
      
      // Flash temporary visual indicator of success
    } catch (err) {
      alert(`Barcode Scan Error: SKU "${barcodeInput}" not found in catalog.`);
      setBarcodeInput('');
    }
  };

  const handleCheckoutSubmit = async (method) => {
    setCheckoutError('');
    const customer = {
      name: customerName || undefined,
      phone: customerPhone || undefined,
      email: customerEmail || undefined,
    };

    const res = await checkout(method, customer);
    
    if (res.success) {
      setLastOrderNumber(res.order.orderNumber);
      setPaymentSuccess(true);
      setShowPaymentModal(false);
      
      // Reset customer details
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');

      // Autohide success screen after 4s
      setTimeout(() => {
        setPaymentSuccess(false);
      }, 4000);
    } else {
      setCheckoutError(res.message || 'Checkout failed.');
    }
  };

  const { subtotal, totalDiscount, totalTax, total } = getCartTotals();

  return (
    <div className="h-[calc(100vh-64px)] grid grid-cols-12 gap-6 p-6">
      
      {/* LEFT COLUMN: PRODUCT SELECTION (7/12 cols) */}
      <div className="col-span-7 flex flex-col h-full space-y-4">
        
        {/* Search & Scan Control Panel */}
        <div className="glass-panel p-4 rounded-xl flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search catalog (F2)..."
              className="w-full pl-11 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          <form onSubmit={handleBarcodeScan} className="relative w-64">
            <Barcode className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Scan/Type SKU (F4)..."
              className="w-full pl-11 pr-16 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-500/50"
            />
            <button
              type="submit"
              className="absolute right-2 top-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-700 text-brand-500 font-semibold"
            >
              Scan
            </button>
          </form>
        </div>

        {/* Product Catalog Grid */}
        <div className="glass-panel flex-1 p-4 rounded-xl overflow-y-auto">
          {loading && products.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <Barcode className="w-16 h-16 stroke-1 mb-4 opacity-50" />
              <p>No products found matching query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {products.map(product => 
                product.variants.map(variant => (
                  <button
                    key={variant.sku}
                    onClick={() => addToCart(product, variant)}
                    className="glass-panel-interactive p-4 rounded-xl text-left flex flex-col justify-between h-36"
                  >
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                        {product.category.split(' > ').pop()}
                      </span>
                      <h3 className="font-semibold text-white mt-2 text-sm line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {Object.entries(variant.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono text-slate-500">{variant.sku}</span>
                      <span className="text-sm font-bold text-white">
                        ₹{variant.price !== undefined ? variant.price : product.basePrice}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CART & CHECKOUT (5/12 cols) */}
      <div className="col-span-5 flex flex-col h-full space-y-4">
        
        {/* Quick Identity Profile Box */}
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
            <span className="font-semibold text-slate-300">
              {isOnline ? 'Online Terminal' : 'Offline Mode (Local Caching Active)'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {offlineOrdersCount > 0 && (
              <button
                onClick={syncOffline}
                disabled={syncing || !isOnline}
                className="flex items-center space-x-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/25 border border-amber-500/20 rounded-md font-semibold animate-pulse-slow"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{offlineOrdersCount} Queued</span>
              </button>
            )}
            <span className="text-slate-400 font-mono font-bold bg-slate-900/60 px-3 py-1 rounded-md border border-slate-800">
              {currentStore?.code || 'NO-STORE'}
            </span>
          </div>
        </div>

        {/* Dynamic Payment/Confetti Celebration Notification */}
        {paymentSuccess && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start space-x-3 shadow-lg">
            <div className="p-1 bg-emerald-500/20 rounded-md">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Transaction Saved!</p>
              <p className="text-xs text-emerald-400/80 mt-1">Order {lastOrderNumber} recorded successfully.</p>
            </div>
          </div>
        )}

        {/* Current Order Cart Panel */}
        <div className="glass-panel flex-1 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-300">Active Register Cart</h2>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40 flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Barcode className="w-12 h-12 mb-3 stroke-1 opacity-40" />
                <p>Register is empty. Add items from the catalog.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.sku} className="p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-semibold text-sm text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                    
                    {/* Inline Discount Control */}
                    <div className="flex items-center space-x-2 mt-2">
                      <Percent className="w-3.5 h-3.5 text-indigo-400" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discount || ''}
                        onChange={e => applyDiscount(item.sku, parseInt(e.target.value) || 0)}
                        placeholder="Discount %"
                        className="w-16 px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-center text-xs text-indigo-400 font-bold focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500">discount %</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                        className="p-1.5 hover:bg-slate-900 text-slate-400"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-sm font-bold font-mono text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                        className="p-1.5 hover:bg-slate-900 text-slate-400"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right w-20">
                      <p className="font-bold text-sm text-white font-mono">
                        ₹{Math.round((item.unitPrice * item.quantity - (item.unitPrice * item.quantity * (item.discount / 100))) * 100) / 100}
                      </p>
                      {item.discount > 0 && (
                        <p className="text-[10px] text-indigo-400 line-through font-mono">
                          ₹{item.unitPrice * item.quantity}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer Attachment Form */}
          <div className="p-4 border-t border-slate-900/60 bg-slate-900/10 space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-400 mb-1">
              <User className="w-4 h-4 text-brand-500" />
              <span>Attach Customer (Optional)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none"
              />
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Phone / Mobile"
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Checkout Calculations Panel */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>Cart Subtotal</span>
              <span>₹{subtotal}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-indigo-400 font-mono">
                <span>Discounts Applied</span>
                <span>-₹{totalDiscount}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>GST Tax Amount</span>
              <span>+₹{totalTax}</span>
            </div>
            
            <div className="flex justify-between text-base font-bold text-white border-t border-slate-800/60 pt-2 font-mono">
              <span>TOTAL DUE</span>
              <span>₹{total}</span>
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="w-full mt-3 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center space-x-2"
            >
              <span>Process Checkout (F8)</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: PAYMENT SELECTION */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl relative border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-1">Secure Payment Checkout</h3>
            <p className="text-xs text-slate-400 mb-6">Choose payment method to reconcile register transaction.</p>

            {checkoutError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleCheckoutSubmit('cash')}
                className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/40 rounded-xl flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 rounded-lg">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Cash Payment</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Physical cash drawer checkout</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-white">₹{total}</span>
              </button>

              <button
                onClick={() => handleCheckoutSubmit('credit')}
                className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/40 rounded-xl flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 rounded-lg">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Credit / Debit Card</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Swipe terminal card auth</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-white">₹{total}</span>
              </button>

              <button
                onClick={() => handleCheckoutSubmit('digital_wallet')}
                className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/40 rounded-xl flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 rounded-lg">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Digital Wallet (UPI / QR)</h4>
                    <p className="text-xs text-slate-500 mt-0.5">PayTM, PhonePe, Google Pay QR</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-white">₹{total}</span>
              </button>
            </div>

            <div className="mt-6 flex justify-end space-x-3 border-t border-slate-900 pt-4">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
