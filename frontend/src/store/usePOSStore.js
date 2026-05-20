import { create } from 'zustand';
import { getOfflineOrders, saveOfflineOrder, deleteOfflineOrder } from '../utils/indexedDb.js';

const API_BASE = 'http://localhost:5000/api';

export const usePOSStore = create((set, get) => {
  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      set({ isOnline: true });
      get().syncOffline();
    });
    window.addEventListener('offline', () => {
      set({ isOnline: false });
    });
  }

  return {
    // Authentication State
    user: JSON.parse(localStorage.getItem('pos_user') || 'null'),
    token: localStorage.getItem('pos_token') || null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    
    // Core POS State
    currentStore: JSON.parse(localStorage.getItem('pos_store') || 'null'),
    cart: [],
    stores: [],
    products: [],
    lowStockItems: [],
    offlineOrdersCount: 0,
    syncing: false,
    loading: false,
    error: null,
    hasMoreProducts: true,
    nextProductCursor: null,

    // Auth Actions
    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');

        localStorage.setItem('pos_token', data.token);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        
        // Auto-assign store if the user profile has one
        let store = null;
        if (data.user.storeId) {
          store = data.user.storeId;
          localStorage.setItem('pos_store', JSON.stringify(store));
        }

        set({ token: data.token, user: data.user, currentStore: store, loading: false });
        
        // Sync any cached orders upon login
        get().syncOffline();
        return true;
      } catch (err) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    logout: () => {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_store');
      set({ token: null, user: null, currentStore: null, cart: [] });
    },

    setStore: (store) => {
      localStorage.setItem('pos_store', JSON.stringify(store));
      set({ currentStore: store, cart: [] });
    },

    // Cart Actions
    addToCart: (product, variant) => {
      const { cart } = get();
      const sku = variant.sku;
      
      const existing = cart.find(item => item.sku === sku);
      if (existing) {
        get().updateQuantity(sku, existing.quantity + 1);
        return;
      }

      const price = variant.price !== undefined ? variant.price : product.basePrice;
      const newCart = [...cart, {
        productId: product._id,
        name: product.name,
        category: product.category,
        sku,
        attributes: variant.attributes,
        unitPrice: price,
        taxRate: product.taxRate,
        quantity: 1,
        discount: 0, // percentage discount e.g. 10
      }];

      set({ cart: newCart });
    },

    removeFromCart: (sku) => {
      const { cart } = get();
      set({ cart: cart.filter(item => item.sku !== sku) });
    },

    updateQuantity: (sku, quantity) => {
      const { cart } = get();
      if (quantity <= 0) {
        get().removeFromCart(sku);
        return;
      }
      const newCart = cart.map(item => 
        item.sku === sku ? { ...item, quantity } : item
      );
      set({ cart: newCart });
    },

    applyDiscount: (sku, discountPercent) => {
      const { cart } = get();
      const newCart = cart.map(item => 
        item.sku === sku ? { ...item, discount: Math.min(100, Math.max(0, discountPercent)) } : item
      );
      set({ cart: newCart });
    },

    clearCart: () => set({ cart: [] }),

    // Cart Calculations
    getCartTotals: () => {
      const { cart } = get();
      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;

      cart.forEach(item => {
        const itemSubtotal = item.unitPrice * item.quantity;
        const discountAmount = itemSubtotal * (item.discount / 100);
        const taxableAmount = itemSubtotal - discountAmount;
        const taxAmount = taxableAmount * (item.taxRate / 100);

        subtotal += itemSubtotal;
        totalDiscount += discountAmount;
        totalTax += taxAmount;
      });

      const total = subtotal - totalDiscount + totalTax;

      return {
        subtotal: Math.round(subtotal * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    },

    // API Actions
    fetchStores: async () => {
      const { token } = get();
      try {
        const res = await fetch(`${API_BASE}/stores`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) set({ stores: data.stores });
      } catch (err) {
        console.error(err);
      }
    },

    fetchProducts: async (search = '', reset = false) => {
      const { token, products, nextProductCursor, hasMoreProducts } = get();
      if (!hasMoreProducts && !reset) return;

      set({ loading: true });
      try {
        let url = `${API_BASE}/products?limit=24`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (nextProductCursor && !reset) url += `&cursor=${nextProductCursor}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (res.ok) {
          set({
            products: reset ? data.products : [...products, ...data.products],
            nextProductCursor: data.nextCursor,
            hasMoreProducts: data.hasMore,
            loading: false,
          });
        } else {
          set({ loading: false });
        }
      } catch (err) {
        console.error(err);
        set({ loading: false });
      }
    },

    fetchInventory: async () => {
      const { token, currentStore } = get();
      if (!currentStore) return;
      try {
        const res = await fetch(`${API_BASE}/inventory?storeId=${currentStore._id || currentStore.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          // Identify low-stock items (quantity <= reorderPoint)
          const lowStock = data.inventory.filter(item => item.quantity <= item.reorderPoint);
          set({ lowStockItems: lowStock });
        }
      } catch (err) {
        console.error(err);
      }
    },

    // Transaction Checkout (Handles online vs offline seamlessly)
    checkout: async (paymentMethod, customer = null) => {
      const { cart, currentStore, token, isOnline, getCartTotals } = get();
      if (!currentStore || cart.length === 0) return { success: false, message: 'Invalid store or cart.' };

      const { total, totalTax, totalDiscount } = getCartTotals();
      const storeId = currentStore._id || currentStore.id;

      // Construct transaction payload
      const orderPayload = {
        storeId,
        customer: customer && (customer.name || customer.phone || customer.email) ? customer : undefined,
        items: cart.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          discount: item.discount,
        })),
        paymentMethod,
        totalAmount: total,
        totalTax,
        totalDiscount,
      };

      if (!isOnline) {
        // Offline: Generate unique offline order number and cache locally
        const timestamp = Date.now();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const offlineOrderNumber = `OFFLINE-ORD-${timestamp}-${rand}`;

        const offlineOrder = {
          ...orderPayload,
          orderNumber: offlineOrderNumber,
          createdAt: new Date().toISOString(),
          items: cart.map(item => ({
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: (item.unitPrice * item.quantity - (item.unitPrice * item.quantity * (item.discount / 100))) * (item.taxRate / 100),
            discountAmount: item.unitPrice * item.quantity * (item.discount / 100),
            total: (item.unitPrice * item.quantity) - (item.unitPrice * item.quantity * (item.discount / 100)) + ((item.unitPrice * item.quantity - (item.unitPrice * item.quantity * (item.discount / 100))) * (item.taxRate / 100)),
          })),
        };

        try {
          await saveOfflineOrder(offlineOrder);
          get().updateOfflineCount();
          set({ cart: [] });
          return { success: true, message: 'Order saved offline. Will sync when online.', offline: true, order: offlineOrder };
        } catch (err) {
          return { success: false, message: `Offline caching failed: ${err.message}` };
        }
      }

      // Online: Dispatch to API directly
      set({ loading: true });
      try {
        const res = await fetch(`${API_BASE}/orders/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderPayload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Checkout failed');

        set({ cart: [], loading: false });
        return { success: true, order: data.order };
      } catch (err) {
        set({ error: err.message, loading: false });
        return { success: false, message: err.message };
      }
    },

    // Local DB Queue Counter
    updateOfflineCount: async () => {
      try {
        const list = await getOfflineOrders();
        set({ offlineOrdersCount: list.length });
      } catch (err) {
        console.error(err);
      }
    },

    // Sync Offline Orders Queue to Backend
    syncOffline: async () => {
      const { syncing, token, isOnline } = get();
      if (syncing || !isOnline || !token) return;

      set({ syncing: true });
      try {
        const offlineOrders = await getOfflineOrders();
        if (offlineOrders.length === 0) {
          set({ syncing: false });
          return;
        }

        console.log(`📡 Restored connection! Syncing ${offlineOrders.length} offline orders...`);

        const res = await fetch(`${API_BASE}/orders/sync-offline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orders: offlineOrders }),
        });

        const data = await res.json();
        if (res.ok) {
          // Remove successfully synced orders from IndexedDB
          const syncedNumbers = data.results.success.map(o => o.orderNumber);
          for (const num of syncedNumbers) {
            await deleteOfflineOrder(num);
          }
          console.log(`✔ Synced ${syncedNumbers.length} offline orders.`);
        }
      } catch (err) {
        console.error('Failed to sync offline orders:', err);
      } finally {
        set({ syncing: false });
        get().updateOfflineCount();
        get().fetchInventory(); // refresh stock numbers
      }
    },
  };
});
// API wiring: appointment form submit to Scheduler with error boundary
