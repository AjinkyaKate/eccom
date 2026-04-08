# Current Project Status

Last updated: April 4, 2026

This note reflects the code currently present in `src/` and `scripts/`. If older planning docs disagree with this file, treat this file as the more accurate snapshot.

## Completed

### Core backend foundation
- Express server bootstrapping in `server.js`
- MongoDB connection setup in `src/config/database.js`
- Health endpoint at `GET /health`
- Environment-driven JWT and OTP utilities
- Basic CORS and JSON/form body parsing

### Customer authentication
- WhatsApp OTP send flow (fixed: message sent before DB save)
- OTP verification and JWT issuance (fixed: improved expired OTP handling)
- Protected customer profile endpoint at `GET /api/auth/me`
- User model with OTP, admin role, address, verification, and active state fields (fixed: improved max attempts logic)
- WhatsApp provider abstraction with Meta Cloud API, Green API, and mock implementations

### Admin authentication and access control
- Admin login with email/password
- Admin profile endpoint at `GET /api/admin/me`
- Role-based middleware with `protect` and `adminOnly`
- Seed script for initial admin creation (fixed: uses env variables for credentials)

### Categories
- Category model with slug generation and ordering
- Public category list and single-category APIs (fixed: defaults to active categories, populates product count)
- Admin create, update, and delete category APIs (fixed: regex escape for duplicates, ID validation, product existence check before delete)

### Products
- Product model with slug, SKU, pricing, stock, tags, ratings, and category relation (fixed: added missing category field)
- Public product listing with pagination (fixed: added category filtering and lookup)
- Public product search (fixed: added category info and computed fields)
- Public product detail by slug
- Admin product listing
- Admin product create, update, delete, and stock update APIs (fixed: category field validation and persistence)

### Cart
- Cart model with per-user unique cart
- Get cart, add item, update quantity, remove item, and clear cart APIs
- Snapshot pricing in cart items
- Cleanup of unavailable cart items on read/update

### Orders and checkout
- Order model with item, customer, pricing, payment, invoice, and address snapshots
- Checkout summary API with saved addresses, pricing, and blocking issues
- Customer order placement API with COD support
- Customer order history, detail, and cancel APIs
- Admin order list, detail, order-status update, and payment-status update APIs
- Admin dashboard stats API
- Stock deduction on order placement and stock restoration on cancellation
- Invoice number generation when payment is marked as paid

### Scripts and support files
- Demo category/product seed script
- Postman collection
- Setup and planning documentation

## Pending

### Not implemented yet
- Final live Meta Business verification, phone-number onboarding, and approved template setup
- Dedicated address CRUD APIs and the final search-based address flow
- Admin order analytics beyond the dashboard summary
- Admin abandoned-cart / recovery APIs
- Printable sticker / packing-slip APIs
- Image upload/storage integration such as Cloudinary
- Standardized validation middleware

### Hardening and cleanup still needed
- Automated tests
- Documentation cleanup so endpoint/status docs match the code
- Secret/config sanitization before sharing docs externally

## Edge Cases And Risks Found So Far

1. OTP resend lockout after max attempts (FIXED)
   Now checks if OTP is expired before blocking resend.

2. OTP verification can fail with a server error when OTP state disappears (FIXED)
   Improved handling of missing/expired OTP state during verification.

3. OTP is persisted before WhatsApp delivery is confirmed (FIXED)
   Order of operations changed: send message first, then save to DB.

4. Admin bootstrap credentials are predictable (FIXED)
   Seed script now uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc. from `.env`.

5. Category deletion can orphan products (FIXED)
   Now checks `Product` collection before allowing category deletion.

6. Category duplicate checks use raw regular expressions from user input (FIXED)
   Added `escapeRegex` utility.

7. Category update/delete do not validate malformed ids first (FIXED)
   Added `mongoose.Types.ObjectId.isValid` checks.

8. Public category APIs expose inactive categories unless filtered explicitly (FIXED)
   Now defaults to `isActive: true`.

9. Status docs are inconsistent with the implemented code (FIXED - This file updated)

10. Sensitive-looking config values appear in project documentation
    Before the project is shared, docs should use placeholders instead of real-looking secrets or credentials.

11. No automated test coverage exists yet
    `npm test` is still a placeholder, so regressions in auth/catalog/cart flows are easy to miss.

12. Checkout currently uses the latest product price
    Cart items keep a snapshot price, but order pricing is recalculated from the latest active product price during checkout.

13. Order writes on local standalone MongoDB are best-effort when transactions are unavailable
    The checkout flow attempts a transaction first and falls back to guarded sequential writes with rollback logic if transactions are unsupported.

## Add Later Findings

Append any newly discovered edge cases under the list above so this file stays the single running review note for the project.
