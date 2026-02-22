# CartY - WhatsApp Storefront Builder

## Overview
CartY is a mobile-first WhatsApp Storefront Builder app where sellers create simple online stores, share a link, receive paid orders, and withdraw earnings.

## Tech Stack
- **Frontend**: Expo React Native (Mobile-first)
- **Backend**: FastAPI with Python
- **Database**: MongoDB
- **Payments**: Paystack (hidden from buyers)
- **Email**: Resend
- **Notifications**: WhatsApp click-to-chat links

## Features Implemented

### Seller Features
1. **Authentication**: Phone + password registration/login with JWT
2. **Store Management**: Create store with name, logo, WhatsApp number, email
3. **Product Management**: Add/edit/delete products with images, prices, descriptions
4. **Dashboard**: View total sales, orders, wallet balance, recent orders
5. **Wallet System**: Track earnings, setup bank account, request withdrawals
6. **Subscription**: Monthly subscription ($5/~₦37,500) to accept payments
7. **Order Notifications**: Email + WhatsApp notifications on new orders

### Buyer Features
1. **Browse Store**: View products via store link (no account needed)
2. **Add to Cart**: Select products and quantities
3. **Checkout**: Enter name, phone, address, optional note
4. **Payment**: Pay via Paystack (hidden from buyer)
5. **Confirmation**: See order success + WhatsApp link to seller

## API Endpoints

### Auth
- `POST /api/auth/register` - Register with phone/password
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Store
- `POST /api/stores` - Create store
- `GET /api/stores/my-store` - Get seller's store
- `PUT /api/stores/my-store` - Update store
- `GET /api/stores/dashboard` - Get dashboard stats

### Products
- `POST /api/products` - Create product
- `GET /api/products` - List products
- `PUT /api/products/{id}` - Update product
- `DELETE /api/products/{id}` - Delete product

### Public Storefront
- `GET /api/storefront/{slug}` - Get store + products
- `POST /api/storefront/{slug}/checkout` - Initialize payment
- `GET /api/storefront/{slug}/verify/{ref}` - Verify payment

### Subscription
- `POST /api/subscription/initialize` - Start subscription
- `GET /api/subscription/verify/{ref}` - Verify subscription

### Wallet
- `GET /api/wallet` - Get wallet balance + history
- `GET /api/banks` - Get Nigerian banks list
- `POST /api/wallet/setup-bank` - Link bank account
- `POST /api/wallet/withdraw` - Request withdrawal

### Orders
- `GET /api/orders` - List seller's orders

## Database Collections
- `users` - Seller accounts
- `stores` - Store profiles with wallet info
- `products` - Product catalog
- `orders` - Customer orders
- `withdrawals` - Withdrawal history
- `pending_subscriptions` - Subscription tracking

## Environment Variables
- `PAYSTACK_SECRET_KEY` - Paystack API secret
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `RESEND_API_KEY` - Resend email API key
- `JWT_SECRET` - JWT signing secret
- `MONGO_URL` - MongoDB connection
- `SUBSCRIPTION_PRICE_NGN` - Subscription price in kobo

## Business Rules
1. Subscription required to accept payments
2. Paystack branding hidden from buyers
3. All payments verified server-side
4. WhatsApp notification on successful orders
5. Email notification to seller with order details

## Store URL Format
`{domain}/store/{slug}` - e.g., `/store/johns-fashion`
