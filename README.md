# OmniPOS Hub: Omnichannel Retail POS & Inventory Management System

OmniPOS Hub is a modern, high-throughput, cloud-native Point of Sale (POS) and inventory optimization system. It unifies physical cashier registers and online storefronts into a single source of truth, offering atomic multi-document transactions, geospatial order fulfillment routing, real-time inventory updates, and resilient offline-checkout capabilities.

---

## 🚀 Key Features

*   **Real-time Cashier Register**: Fluid POS cart with bar-code scanning simulator, keyboard hotkeys (`F2` to focus search, `F4` to scan barcode, `F8` to checkout, `Escape` to reset), and dynamic discount/tax calculations.
*   **Offline-to-Online Resiliency**: Auto-detects network disconnections, stores checkout transactions locally in **IndexedDB**, and syncs them automatically to the server with duplicate protection when connectivity is restored.
*   **ACID-Compliant Inventory Engine**: Prevents race conditions or stock overselling by utilizing MongoDB sessions to process stock decrements atomically.
*   **Algorithmic Stock Replenishment Forecasting**: Automatically updates rolling sales velocity metrics post-checkout and calculates dynamic reorder thresholds to prevent stockouts.
*   **Geospatial Order Routing**: Mathematical routing of online orders to the closest store location based on stock coverage and Haversine distance.
*   **Executive Dashboard**: Dynamic charts powered by Recharts tracking gross revenue trends, payment channel splits, low-stock notifications, and physical stock reconciliation.

---

## 🛠 Tech Stack

*   **Frontend**: React (Vite), Tailwind CSS (v3), Zustand, Lucide Icons, Recharts, IndexedDB
*   **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB ORM), Redis
*   **Development**: Docker Compose (MongoDB replica set & Redis)

---

## 📂 Folder Structure

```
infotact_project/
├── backend/                  # TypeScript Express backend REST API
│   ├── src/
│   │   ├── config/           # Database and Redis client connections
│   │   ├── controllers/      # Route controllers (auth, products, orders, inventory)
│   │   ├── middleware/       # JWT and Role-Based Access Control (RBAC) guards
│   │   ├── models/           # Mongoose schemas (User, Store, Product, Ledger, Order)
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Inventory session transactions and georouting
│   │   ├── scripts/          # Seeder script to initialize default tables
│   │   └── index.ts          # Server entrypoint
│   └── tests/                # Vitest georouting and math unit tests
├── frontend/                 # Vite React cashier app
│   ├── src/
│   │   ├── components/       # POS terminal grid, login, and dashboard
│   │   ├── store/            # Zustand global reactive client store
│   │   ├── utils/            # Local IndexedDB database manager
│   │   ├── App.jsx           # Main navigation and online/offline alerts
│   │   └── index.css         # Styling directives and glassmorphic card utilities
└── docker-compose.yml        # Multi-container setup (MongoDB replica set & Redis)
```

---

## ⚙ Setup & Installation

### 1. Prerequisites
Ensure you have **Node.js v18+** and **npm** installed on your system. 
Ensure you have **MongoDB** (ideally configured as a Replica Set to test ACID transaction rollbacks) and **Redis** running locally, or have access to Atlas and Upstash instances.

### 2. Backend Configuration
Navigate to the `backend/` directory, create a `.env` file, and configure your credentials:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pos_db?replicaSet=rs0
REDIS_URL=redis://localhost:6379
JWT_SECRET=super_secret_pos_system_key_123_456_789
JWT_EXPIRES_IN=1d
```

Install packages, build the typescript files, and seed initial mock database records:
```bash
cd backend
npm install
npm run build
npm run seed  # Generates default store locations, admins, cashiers, products, and stocks
```

### 3. Run Dev Server
Launch the backend server:
```bash
npm run dev
```
The REST API will boot on `http://localhost:5000`.

### 4. Frontend Configuration
Open a new terminal window, navigate to the `frontend/` directory, install packages, and start the dev server:
```bash
cd frontend
npm install
npm run dev
```
The cashier terminal interface will open on `http://localhost:5173`.

---

## 🔐 Credentials for Seeding and Test Accounts

Running `npm run seed` creates the following default accounts for instant log-in:

| Role | Email | Password | Assigned Location |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin@retail.com` | `admin123` | All Locations (HQ) |
| **Store Manager** | `manager@retail.com` | `cashier123` | Mumbai Fashion Arcade |
| **Store Cashier** | `cashier@retail.com` | `cashier123` | Bengaluru Electronics Hub |

### Default Scanned SKUs (Barcodes):
*   `SKU-IPH15-BLK` (iPhone 15 Pro Max - Black Titanium)
*   `SKU-IPH15-NAT` (iPhone 15 Pro Max - Natural Titanium)
*   `SKU-S24U-GRY` (Samsung Galaxy S24 Ultra - Titanium Gray)
*   `SKU-XM5-BLK` (Sony WH-1000XM5 Headphones - Silver Matte)
*   `SKU-LEV-32` (Levi's 501 Original Fit Jeans - Size 32)

---

## 🖥 Keyboard Shortcuts (POS Terminal)

*   `F2`: Instantly focus on the **Catalog Search Bar**.
*   `F4`: Focus on the **Barcode SKU Input**.
*   `F8`: Open **Secure Payment Modal** (only works if items are in the cart).
*   `Escape`: Exit current modal / Reset and empty cashier register cart.

---

## 📡 API Reference Checklist

### Authentication (`/api/auth`)
*   `POST /register`: Registers cashiers/managers with custom store bindings.
*   `POST /login`: Performs authentication checks and signs JWT tokens.
*   `GET /me`: Returns profile of currently authenticated user.

### Store Management (`/api/stores`)
*   `GET /`: Fetches all physical store locations.
*   `POST /`: Adds a new store location with geospatial coordinates (Admin only).

### Catalog Management (`/api/products`)
*   `GET /`: Cursor-based paginated lookup (Optional full-text `?search=` filter).
*   `GET /sku/:sku`: Resolves barcode/SKU to specific product metadata.
*   `POST /`: Inserts new products and variations (Admin/Manager only).
*   `PUT /:id`: Updates product information (Admin/Manager only).
*   `DELETE /:id`: Cascades removal of catalog item and associated stocks (Admin only).

### Stock Management (`/api/inventory`)
*   `GET /`: Returns stock levels (Optional `?lowStock=true` filter).
*   `PUT /reconcile`: Modifies physical count audits (Admin/Manager only).

### Order Registry (`/api/orders`)
*   `GET /`: Lists paginated order registry.
*   `GET /analytics`: Pulls KPI sums, payment breakdowns, and daily sales trends (Admin/Manager only).
*   `POST /checkout`: Performs ACID-safe checkout and stock decrement.
*   `POST /route`: Optimally routes online order coordinates to the best store.
*   `POST /sync-offline`: Performs batch synchronizations of buffered offline sales.
