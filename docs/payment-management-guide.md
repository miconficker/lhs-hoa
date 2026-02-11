# Payment Management System - User Guide

This guide explains how to use the Laguna Hills HOA payment management system for both residents and administrators.

---

## Table of Contents

- [For Residents](#for-residents)
  - [Making a Payment](#making-a-payment)
  - [Payment Methods](#payment-methods)
  - [Viewing Payment History](#viewing-payment-history)
  - [Uploading Proof of Payment](#uploading-proof-of-payment)
- [For Administrators](#for-administrators)
  - [Verification Queue](#verification-queue)
  - [Approving/Rejecting Payments](#approvingrejecting-payments)
  - [Late Fee Configuration](#late-fee-configuration)
  - [Exporting Payment History](#exporting-payment-history)
  - [Recording In-Person Payments](#recording-in-person-payments)
- [Payment Types](#payment-types)
- [Notifications](#notifications)

---

## For Residents

### Making a Payment

Residents can make payments for HOA dues, vehicle passes, and employee IDs through the platform.

#### To Make a Payment:

1. Navigate to the **Payments** page from the main menu
2. Click the **"Pay Now"** button for your desired payment type
3. Fill in the payment details:
   - **Payment Type**: HOA Dues, Vehicle Pass, or Employee ID
   - **Amount**: Enter the payment amount
   - **Payment Method**: Select your preferred payment method
   - **Reference Number** (optional): Transaction/reference from your bank or wallet
4. Upload your **proof of payment** (receipt, screenshot, etc.)
5. Review your payment details and click **Submit**

Your payment will be submitted for admin verification.

### Payment Methods

The following payment methods are accepted:

| Method | Description |
|--------|-------------|
| **Bank Transfer** | Direct transfer to HOA's BPI account |
| **GCash** | Send to the official GCash number |
| **PayMaya** | Send to the official PayMaya wallet |
| **Cash** | For in-person payments at the HOA office |

#### Bank Transfer Details:
- **Bank**: BPI
- **Account Name**: Laguna Hills HOA
- **Account Number**: 1234-5678-90

#### GCash Details:
- **Name**: Laguna Hills HOA
- **Number**: 0917-XXX-XXXX

### Viewing Payment History

To view your payment history:

1. Go to the **Payments** page
2. Your payment history is displayed showing:
   - Payment amount and period
   - Payment method and status
   - Verification status (Pending, Verified, Not Required)
   - Date created and paid date

### Uploading Proof of Payment

If your payment proof was rejected, you can re-upload:

1. Find the rejected payment in **My Lots** or **Passes** page
2. Click **"Pay Now"** on the rejected item
3. Upload a new proof file
4. Submit for re-verification

**Accepted file formats**: JPG, PNG, PDF (max 5MB)

---

## For Administrators

### Verification Queue

Admins can view all pending payment verifications in the Admin Panel.

#### Accessing the Verification Queue:

1. Navigate to **Admin Panel** from the main menu
2. Click the **Payments** tab
3. Select **Verification Queue**

The queue shows payments grouped by status:
- **Pending**: Awaiting verification
- **Approved**: Previously approved payments
- **Rejected**: Previously rejected payments

### Approving/Rejecting Payments

#### To Approve a Payment:

1. Open the payment from the Pending queue
2. Review the uploaded proof
3. Click **Approve** button
4. The payment status is updated and the resident is notified

#### To Reject a Payment:

1. Open the payment from the Pending queue
2. Review the uploaded proof
3. Click **Reject** button
4. Enter a reason for rejection (this will be shown to the resident)
5. The resident is notified and can re-upload proof

**Automatic Updates**: When a payment is verified, the system automatically:
- Updates vehicle registration status (for vehicle_pass payments)
- Updates employee ID status (for employee_id payments)
- Sends notification to the resident

### Late Fee Configuration

Admins can configure late fee rules that are applied to pending payments.

#### To Configure Late Fees:

1. Navigate to **Admin Panel → Payments → Settings**
2. Under **Late Fee Configuration**:
   - **Rate (% per month)**: Percentage of amount charged per late month
   - **Grace Period (days)**: Days before late fees are applied
   - **Max Months**: Maximum number of months to calculate late fees for
3. Click **Save Changes**

#### Example Calculation:

With settings:
- Rate: 1% per month
- Grace Period: 30 days
- Max Months: 12

A PHP 1,000 payment that is 3 months late would have:
- Late Fee: PHP 30 (1% × PHP 1,000 × 3 months)

### Exporting Payment History

Admins can export payment history as CSV for accounting and reporting.

#### To Export Payments:

1. Navigate to **Admin Panel → Payments → Export**
2. Apply filters as needed:
   - **Date Range**: Filter by start/end dates
   - **Payment Type**: HOA Dues, Vehicle Pass, Employee ID
   - **Status**: Pending, Completed, Failed
   - **Method**: Bank Transfer, GCash, PayMaya, InstaPay, Cash
3. Click **Export CSV**
4. The file downloads with format: `payments_YYYY-MM-DD_HH-MM.csv`

#### Export Columns:

| Column | Description |
|--------|-------------|
| Payment ID | Unique payment identifier |
| Household ID | Associated household |
| Amount | Payment amount |
| Currency | PHP |
| Method | Payment method used |
| Status | pending, completed, failed |
| Reference Number | Transaction reference |
| Period | Billing period (YYYY-MM) |
| Payment Type | dues, vehicle_pass, employee_id |
| Late Fee Amount | Calculated late fees |
| Late Fee Months | Number of months late |
| Received By | Admin who recorded (cash payments) |
| Created At | When payment was initiated |
| Paid At | When payment was completed |

### Recording In-Person Payments

For residents who pay in person at the HOA office:

1. Navigate to **In-Person Payments** from the admin menu
2. Select the **Household**
3. Enter payment details:
   - **Period**: Billing period
   - **Amount**: Payment amount
   - **Method**: Cash
   - **Received By**: Admin name
4. Click **Record Payment**

The system automatically calculates late fees if applicable.

---

## Payment Types

### HOA Dues

Annual association dues for all households. Due at the start of each year.

### Vehicle Pass

Fee for vehicle sticker or RFID pass registration.

- **Sticker**: One-time fee for vehicle identification
- **RFID**: For automated gate access

### Employee ID

Fee for household employee identification cards (e.g., helpers, drivers, caregivers).

---

## Notifications

### For Residents

- **Payment Verification Requested**: Your proof is being reviewed
- **Payment Approved**: Your payment has been verified and processed
- **Payment Rejected**: Your proof was rejected (includes reason)

### For Admins

- **New Payment Verification**: A resident has submitted payment proof for review

---

## Troubleshooting

### Payment not showing in history?
- Wait a few minutes for the system to update
- Refresh the page
- Check if the payment is still pending verification

### Can't upload proof file?
- Ensure file is JPG, PNG, or PDF format
- File size must be under 5MB
- Try a different browser or device

### Payment verification taking too long?
- Verification is done manually by HOA admins
- Expected turnaround: 1-2 business days
- Contact HOA office if urgent

---

## API Reference (For Developers)

### Payment Endpoints

#### Resident Endpoints

- `POST /api/payments/initiate` - Initiate a new payment with proof upload
- `PUT /api/payments/:paymentId/proof` - Re-upload proof for rejected payment
- `GET /api/payments/my-pending/verifications` - Get user's pending verifications

#### Admin Endpoints

- `GET /api/admin/payments/verify` - Get verification queue
- `PUT /api/admin/payments/:paymentId/verify` - Approve/reject payment
- `GET /api/admin/payments/settings` - Get payment settings
- `PUT /api/admin/payments/settings` - Update payment settings
- `GET /api/admin/payments/export` - Export payments with filters

### Database Tables

- `payments` - All payment records
- `payment_proofs` - Uploaded proof files
- `payment_verification_queue` - Pending verifications
- `late_fee_config` - Late fee configuration

---

## Support

For issues or questions about payments:
- Contact the HOA office during business hours
- Email: support@lagunahills.com (placeholder)
- Phone: (Insert HOA office number)
