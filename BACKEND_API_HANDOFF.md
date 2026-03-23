# Backend API Handoff

Last updated: March 10, 2026

This file is the backend-first handoff note for the project. The goal is to make the backend/database flow clear first, so later the frontend work is mostly:

- use the correct API on the correct screen
- show the correct data
- trigger the correct refresh after mutations
- keep customer/admin communication smooth

## Product Direction

Current direction:

- Website-first ordering flow
- WhatsApp used for OTP now
- WhatsApp used later for order notifications and status updates
- Admin panel focused on operations, payments, logistics, order handling
- Direct WhatsApp ordering comes later, not in the first backend phase

## What Exists Right Now

### Authentication APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/auth/send-otp` | `POST` | Ready | Customer login page/modal | Sends OTP to WhatsApp |
| `/api/auth/verify-otp` | `POST` | Ready | Customer login verification | Returns customer JWT |
| `/api/auth/me` | `GET` | Ready | Customer profile/header/session restore | Protected route |
| `/api/admin/login` | `POST` | Ready | Admin login page | Uses `email + password` |
| `/api/admin/me` | `GET` | Ready | Admin session/profile | Protected + admin only |

### Category APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/categories` | `GET` | Ready | Customer home/category navigation | Public |
| `/api/categories/:slug` | `GET` | Ready | Category page/category detail | Public |
| `/api/categories` | `POST` | Ready | Admin category create | Protected + admin only |
| `/api/categories/:id` | `PUT` | Ready | Admin category edit | Protected + admin only |
| `/api/categories/:id` | `DELETE` | Ready | Admin category delete | Protected + admin only |

Important note:

- Category admin APIs are under `/api/categories`, not `/api/admin/categories`

### Product APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/products` | `GET` | Ready | Customer product listing/home/category/search results | Supports filters and pagination |
| `/api/products/search` | `GET` | Ready | Customer search page | Returns max 20 |
| `/api/products/:slug` | `GET` | Ready | Customer product detail page | Public |
| `/api/admin/products` | `GET` | Ready | Admin product list | Includes admin filters |
| `/api/admin/products` | `POST` | Ready | Admin create product | Protected + admin only |
| `/api/admin/products/:id` | `PUT` | Ready | Admin edit product | Protected + admin only |
| `/api/admin/products/:id/stock` | `PATCH` | Ready | Admin stock update quick action | Protected + admin only |
| `/api/admin/products/:id` | `DELETE` | Ready | Admin delete product | Protected + admin only |

### Cart APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/cart` | `GET` | Ready | Customer cart page | Protected |
| `/api/cart/add` | `POST` | Ready | Product card/product detail add-to-cart | Protected |
| `/api/cart/items/:itemId` | `PUT` | Ready | Cart quantity update | Protected |
| `/api/cart/items/:itemId` | `DELETE` | Ready | Cart remove item | Protected |
| `/api/cart` | `DELETE` | Ready | Cart clear action | Protected |

### Order APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/orders/checkout/summary` | `GET` | Ready | Checkout page preflight | Returns issues, pricing, saved addresses, payment methods |
| `/api/orders/checkout` | `POST` | Ready | Place-order action | Supports COD today |
| `/api/orders` | `GET` | Ready | Customer order history | Protected |
| `/api/orders/:id` | `GET` | Ready | Customer order detail/tracking | Protected |
| `/api/orders/:id/cancel` | `POST` | Ready | Customer cancel order | Protected with status rules |

### Admin Order APIs

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/api/admin/orders` | `GET` | Ready | Admin orders list | Supports search/status/payment/date filters |
| `/api/admin/orders/:id` | `GET` | Ready | Admin order detail | Includes recent orders for the same customer |
| `/api/admin/orders/:id/status` | `PUT` | Ready | Admin logistics/status update | Enforces status transitions |
| `/api/admin/orders/:id/payment` | `PUT` | Ready | Admin payment verification | Generates invoice number when paid |
| `/api/admin/dashboard/stats` | `GET` | Ready | Admin dashboard | Basic order/product/customer stats |

### System API

| Endpoint | Method | Status | Main Screen/Usage | Notes |
|---|---|---:|---|---|
| `/health` | `GET` | Ready | Local/dev health check | Public |

## Screen To API Map

### Customer Screens

| Screen | Data Needed | Current APIs | Missing APIs | Status |
|---|---|---|---|---|
| Login / OTP verify | phone, otp, current user session | `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `GET /api/auth/me` | None for base login | Ready |
| Home page | categories, featured products, filtered products | `GET /api/categories`, `GET /api/products` | Optional homepage aggregation later | Mostly ready |
| Category page | category meta, filtered products | `GET /api/categories/:slug`, `GET /api/products?category=` | None for basic version | Ready |
| Product detail | product details, stock, category | `GET /api/products/:slug` | None for basic version | Ready |
| Cart page | cart items, subtotal, quantity updates | `GET /api/cart`, `POST /api/cart/add`, `PUT /api/cart/items/:itemId`, `DELETE /api/cart/items/:itemId`, `DELETE /api/cart` | Abandoned-cart admin visibility later | Ready for cart only |
| Address page | saved addresses, create/update/delete address, default selection | None | Dedicated address APIs required | Missing |
| Checkout page | cart summary, chosen address, payment method, validation result | `GET /api/orders/checkout/summary`, `POST /api/orders/checkout` | Final address UX APIs later | Partially ready |
| Payment result page | order success/failure summary | `POST /api/orders/checkout` | External payment flow later | Ready for COD |
| My orders | order list for customer | `GET /api/orders` | None for base version | Ready |
| Order detail / tracking | order info, status timeline, payment status, address snapshot | `GET /api/orders/:id`, `POST /api/orders/:id/cancel` | WhatsApp sync later | Ready |

### Admin Screens

| Screen | Data Needed | Current APIs | Missing APIs | Status |
|---|---|---|---|---|
| Admin login | email, password, session restore | `POST /api/admin/login`, `GET /api/admin/me` | None for base login | Ready |
| Product list | products, filters, stock, status | `GET /api/admin/products` | Optional dashboard summary later | Ready |
| Product create/edit | product form, categories | `POST /api/admin/products`, `PUT /api/admin/products/:id`, `PATCH /api/admin/products/:id/stock`, `GET /api/categories` | None for base catalog | Ready |
| Category list/create/edit | categories | `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` | None for base category management | Ready |
| Dashboard | order counts, payment pending, low stock, abandoned carts, delivery counts | `GET /api/admin/dashboard/stats` | Abandoned-cart stats later | Partially ready |
| Orders list | all orders, filters, search, payment state, status | `GET /api/admin/orders` | None for base order ops | Ready |
| Order detail | customer info, address, items, payment, status timeline, admin notes | `GET /api/admin/orders/:id`, `PUT /api/admin/orders/:id/status`, `PUT /api/admin/orders/:id/payment` | Print payload later | Ready |
| Customers / history | customer profile, order history, cart history | `GET /api/admin/orders/:id` gives recent orders for that customer | Dedicated customer admin APIs later | Partially ready |
| Abandoned carts / leads | cart owners, cart items, last updated, phone | No dedicated API | Admin abandoned-cart APIs required | Missing |
| Print sticker / packing slip | order snapshot, label data, printable payload | None | Print/label API or print payload API required | Missing |

## What Still Must Be Built For Full Flow

### Address Domain

Required for:

- checkout
- order snapshot
- delivery visibility
- admin logistics

Missing pieces:

- save address
- list addresses
- update address
- delete address
- mark default address
- select address during checkout
- optional location search/Google integration later

### Payment Domain

Required for:

- knowing whether an order is safe to pack
- separating logistics from money state

Missing pieces:

- non-COD or external payment provider flow
- payment webhook handling
- richer manual verification and reconciliation tools

### Notification Domain

Required for:

- order placed message
- packed/in-transit/delivered messages
- cancellation/payment messages

Missing pieces:

- WhatsApp order notification templates
- order event triggers
- message log storage
- later real delivery/read tracking webhook support

### Admin Operations Domain

Required for:

- custom business operations
- customer support
- lead recovery
- printing/logistics

Missing pieces:

- abandoned-cart view
- packing slip / sticker payload
- printable label endpoint or printable structured order data

## Cross-Screen Communication Rules

These are the important communication behaviors we need to preserve.

### 1. Admin updates product -> customer sees product change

Current behavior:

- customer product listing/detail reads live product data from product APIs
- admin product updates are visible on the customer side on the next fetch/refetch

Needed frontend behavior later:

- after admin edit, admin screens should refetch product list/detail
- customer screens should refetch on page load, filter change, or manual refresh

Important note:

- cart items store snapshot price
- product APIs return live product price
- cart API also exposes the cart item price snapshot

Implemented decision:

- checkout currently charges the latest active product price, not the older cart snapshot price

### 2. Admin disables or deletes product -> customer cart/listing behavior

Current behavior:

- inactive products do not appear in public product listing/detail
- cart reads sanitize missing/inactive products and remove them from cart

Needed later:

- frontend should show a clear message when items disappeared from the cart because they are no longer available

### 3. Customer places order -> admin must see it immediately

Current behavior:

- successful checkout creates the order record
- stock is reduced during checkout
- cart is cleared after order creation
- admin orders list and dashboard stats will show the new order on the next refetch

Still missing later:

- WhatsApp confirmation after order placement

### 4. Admin updates order status -> customer website + WhatsApp must stay in sync

Current behavior:

- admin can update order status
- status history is stored on the order
- customer order detail will show the updated status on the next fetch
- invoice number is generated when payment is marked paid

Still missing later:

- WhatsApp status messages
- invoice sharing on WhatsApp

### 5. Customer cart without checkout -> admin lead visibility

Not built yet.

Current useful fact:

- cart is protected
- once the customer reaches cart, the backend already knows the user id and phone via login

Required behavior later:

- admin can see carts not converted into orders
- admin can see who the customer is and what they left in cart
- optional reminder workflow later

## Edge Cases And Decisions To Lock Before Frontend Integration

### Authentication

- OTP edge cases still need fixing before production
- admin login is now `email + password`

### Catalog

- deleting categories currently can orphan products
- public category APIs currently expose inactive categories unless filtered
- category admin routes are on `/api/categories`, not `/api/admin/categories`

### Cart

- cart currently requires login
- invalid or inactive products can disappear from cart automatically
- product stock is checked on add/update, but stock must be checked again during checkout
- price snapshot vs live price needs a final business decision

### Address

- order must store an address snapshot, not just an address id reference
- if address changes later, old orders must keep the original address used

### Orders

- order status and payment status must be separate fields
- cancellation rules must be defined
- status transitions must be restricted
- stock rollback rules must be defined for cancelled orders
- admin notes and timeline history should be saved for auditing
- current implementation already separates order status and payment status
- current implementation restores stock when an order is cancelled

### Notifications

- notifications are WhatsApp-only for now
- real delivery/read tracking can come later
- local build can use mock message logging first

### Realtime / Sync

For phase 1 of frontend integration, "smooth communication" does not require sockets yet.

It is enough if:

- every mutation returns the updated entity or success response
- frontend refetches the affected list/detail screen after create/update/delete
- admin and customer see fresh state on reload or post-action refetch

Realtime push can be added later if needed.

## Recommended Backend Build Order From Here

1. Address APIs and address schema
2. Dedicated address APIs and final address/search flow
3. WhatsApp order notification triggers
4. Abandoned-cart/admin lead APIs
5. Sticker / packing-slip print payload
6. Admin order analytics extensions
7. Tests around the full order lifecycle

## Definition Of "Backend Ready For Frontend Design"

Backend should be considered ready for frontend design/reference integration when:

- all customer ordering APIs exist from login to order tracking
- all admin order-handling APIs exist from order list to status update
- data contracts are stable
- edge-case behavior is defined
- COD checkout and admin payment flows work locally
- mock or real WhatsApp notification flows work locally
- only visual design and API hookup remain on the frontend

At that point, the frontend task becomes mostly:

- build screens from design references
- connect screens to APIs
- map returned data into the UI
- refetch or update state after mutations
