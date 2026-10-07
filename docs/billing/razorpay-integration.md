# Razorpay Integration Guide

## Overview
VANNI integrates with the official Razorpay Subscriptions & Recurring Payments API to process subscriptions across Indian debit/credit cards, UPI Autopay, and netbanking.

## Security Architecture
- **Server-Side Isolation**: `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are never exposed to browser clients or frontend bundles. Only `RAZORPAY_KEY_ID` (public identifier) is provided to clients when initiating checkout widgets.
- **Provider Abstraction**: All gateway operations strictly conform to the `IBillingProvider` interface in `@vanni/provider-sdk`. The core runtime and API routes never import third-party SDKs directly.
- **Fallback Test Mode**: If `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` are not set in the environment, the platform automatically engages `MockBillingProvider`, enabling end-to-end local development and automated CI testing.

## Environment Variables
```env
# Razorpay API Credentials
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="your_secret_here"

# Webhook Verification Secret
RAZORPAY_WEBHOOK_SECRET="whsec_..."
```

## Webhook Endpoint
- **URL**: `POST /api/billing/webhooks/razorpay`
- **Header**: `x-razorpay-signature`
- **Supported Events**:
  - `subscription.activated`: Transition subscription to `ACTIVE`.
  - `subscription.charged`: Record captured payment and refresh billing period.
  - `payment.failed`: Transition subscription to `PAST_DUE` and notify administrators.
  - `subscription.cancelled`: Transition subscription to `CANCELLED`.
  - `subscription.halted`: Flag account for grace period handling.

## Verification Checklist Before Production
- [ ] Registered webhook endpoint in Razorpay Merchant Dashboard pointing to production URL.
- [ ] Configured active events: `subscription.activated`, `subscription.charged`, `payment.failed`, `subscription.cancelled`.
- [ ] Confirmed webhook secret matches `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Verified GSTIN and billing address inputs conform to Indian invoicing standards.
- [ ] Validated recurring mandate testing across UPI Autopay and domestic cards.
