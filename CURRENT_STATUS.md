# Current Project Status

Last updated: March 10, 2026

This note reflects the code currently present in `src/` and `scripts/`. If older planning docs disagree with this file, treat this file as the more accurate snapshot.

## Completed

### Core backend foundation
- Express server bootstrapping in `server.js`
- MongoDB connection setup in `src/config/database.js`
- Health endpoint at `GET /health`
- Environment-driven JWT and OTP utilities
- Basic CORS and JSON/form body parsing

### Customer authentication
- WhatsApp OTP send flow
- OTP verification and JWT issuance
- Protected customer profile endpoint at `GET /api/auth/me`
- User model with OTP, admin role, address, verification, and active state fields
- WhatsApp provider abstraction with Green API implementation

### Admin authentication and access control
- Admin login with email/password
- Admin profile endpoint at `GET /api/admin/me`
- Role-based middleware with `protect` and `adminOnly`
- Seed script for initial admin creation

### Categories
- Category model with slug generation and ordering
- Public category list and single-category APIs
- Admin create, update, and delete category APIs

### Products
- Product model with slug, SKU, pricing, stock, tags, ratings, and category relation
- Public product listing with pagination
- Public product search
- Public product detail by slug
- Admin product listing
- Admin product create, update, delete, and stock update APIs

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
- WhatsApp order/status notifications beyond OTP using the existing WhatsApp service
- Dedicated address CRUD APIs and the final search-based address flow
- Admin order analytics beyond the dashboard summary
- Admin abandoned-cart / recovery APIs
- Printable sticker / packing-slip APIs
- Image upload/storage integration such as Cloudinary
- Standardized validation middleware

### Hardening and cleanup still needed
- Automated tests
- Production-safe admin bootstrap flow
- OTP edge-case fixes
- Safer category deletion rules
- Documentation cleanup so endpoint/status docs match the code
- Secret/config sanitization before sharing docs externally

## Edge Cases And Risks Found So Far

1. OTP resend lockout after max attempts
   The resend path checks max attempts before expired OTP state is safely reset, so a user can get stuck until data is manually cleared.

2. OTP verification can fail with a server error when OTP state disappears
   Verification increments attempts and saves before checking validity. The save hook can clear expired OTP data, after which the code still reads `user.otp.attempts`.

3. OTP is persisted before WhatsApp delivery is confirmed
   If the provider call fails, the database can still contain a fresh OTP that the user never received.

4. Admin bootstrap credentials are predictable
   The seed script creates a known default admin password and prints it to stdout.

5. Category deletion can orphan products
   Categories can be deleted even when products still reference them.

6. Category duplicate checks use raw regular expressions from user input
   Special characters in category names can cause false matches or runtime errors.

7. Category update/delete do not validate malformed ids first
   Invalid ids fall through to generic server errors instead of clean `400` responses.

8. Public category APIs expose inactive categories unless filtered explicitly
   That may be intentional, but it is worth confirming against storefront expectations.

9. Status docs are inconsistent with the implemented code
   Some docs still say categories/products/cart are pending even though code exists for them.

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
