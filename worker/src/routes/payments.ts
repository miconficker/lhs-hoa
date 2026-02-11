import { Hono } from 'hono';
import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const paymentSchema = z.object({
  household_id: z.string(),
  amount: z.number().positive(),
  method: z.enum(['gcash', 'paymaya', 'instapay', 'cash']),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format'),
  reference_number: z.string().optional(),
});

export const paymentsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// R2 Upload Helper - uploads file and returns public URL
async function uploadProofToR2(
  r2: R2Bucket,
  file: File,
  paymentId: string
): Promise<{ url: string; key: string }> {
  const key = `payment-proofs/${paymentId}/${Date.now()}-${file.name}`;
  await r2.put(key, file);
  // Using R2 public URL pattern - adjust if using custom domain
  const url = `https://pub-${key.replace(/\//g, '--')}.r2.dev`;
  return { url, key };
}

// Get all payments (with optional filters)
paymentsRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.query('household_id');
  const status = c.req.query('status');
  const period = c.req.query('period');

  let query = 'SELECT * FROM payments WHERE 1=1';
  const params: any[] = [];

  if (householdId) {
    query += ' AND household_id = ?';
    params.push(householdId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (period) {
    query += ' AND period = ?';
    params.push(period);
  }

  query += ' ORDER BY created_at DESC';

  const payments = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ payments: payments.results });
});

// Get outstanding balance for a household
paymentsRouter.get('/balance/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  // Calculate outstanding balance from pending payments
  const pendingResult = await c.env.DB.prepare(
    `SELECT period, SUM(amount) as total FROM payments
     WHERE household_id = ? AND status = 'pending'
     GROUP BY period`
  ).bind(householdId).all();

  const periodsDue: string[] = [];
  let totalDue = 0;

  for (const row of pendingResult.results || []) {
    periodsDue.push(row.period as string);
    totalDue += row.total as number;
  }

  return c.json({
    household_id: householdId,
    total_due: totalDue,
    periods_due: periodsDue,
  });
});

// Get my payments (for a specific household)
paymentsRouter.get('/my/:householdId', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const householdId = c.req.param('householdId');

  const payments = await c.env.DB.prepare(
    `SELECT * FROM payments
     WHERE household_id = ?
     ORDER BY created_at DESC`
  ).bind(householdId).all();

  return c.json({ payments: payments.results });
});

// Create payment
paymentsRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const result = paymentSchema.safeParse(body);

  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.flatten() }, 400);
  }

  const { household_id, amount, method, period, reference_number } = result.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO payments (id, household_id, amount, currency, method, status, period, reference_number)
     VALUES (?, ?, ?, 'PHP', ?, 'pending', ?, ?)`
  ).bind(id, household_id, amount, method, period, reference_number || null).run();

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  return c.json({ payment }, 201);
});

// Update payment status (for webhooks/admin)
paymentsRouter.put('/:id/status', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Only admin/staff can update payment status
  if (authUser.role !== 'admin' && authUser.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.status || !['pending', 'completed', 'failed'].includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const updates = ['status = ?', 'updated_at = datetime(\'now\')'];
  const values: any[] = [body.status];

  if (body.status === 'completed') {
    updates.push('paid_at = datetime(\'now\')');
  }

  values.push(id);

  await c.env.DB.prepare(
    `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  return c.json({ payment });
});

// Get single payment
paymentsRouter.get('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  const payment = await c.env.DB.prepare(
    'SELECT * FROM payments WHERE id = ?'
  ).bind(id).first();

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  return c.json({ payment });
});

// =============================================================================
// Payment Verification & Proof Upload Endpoints
// =============================================================================

// Get user's pending verification requests
paymentsRouter.get('/my-pending/verifications', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const verifications = await c.env.DB.prepare(`
    SELECT
      pvq.*,
      p.payment_category,
      h.address as household_address
    FROM payment_verification_queue pvq
    LEFT JOIN payments p ON pvq.payment_id = p.id
    LEFT JOIN households h ON pvq.household_id = h.id
    WHERE pvq.user_id = ? AND pvq.status = 'pending'
    ORDER BY pvq.created_at DESC
  `).bind(authUser.id).all();

  return c.json({ verifications: verifications.results || [] });
});

// Initiate payment with proof upload (multipart/form-data)
paymentsRouter.post('/initiate', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const paymentType = formData.get('payment_type') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const method = formData.get('method') as string;
    const referenceNumber = formData.get('reference_number') as string;
    const proofFile = formData.get('proof') as File;

    // Validate required fields
    if (!paymentType || !amount || !method || !proofFile) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate payment type
    if (!['dues', 'vehicle_pass', 'employee_id'].includes(paymentType)) {
      return c.json({ error: 'Invalid payment type' }, 400);
    }

    // Validate payment method
    if (!['bank_transfer', 'gcash', 'paymaya', 'cash'].includes(method)) {
      return c.json({ error: 'Invalid payment method' }, 400);
    }

    // Validate file type and size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (proofFile.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File size exceeds 5MB limit' }, 400);
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(proofFile.type)) {
      return c.json({ error: 'Invalid file type. Only JPG, PNG, PDF allowed' }, 400);
    }

    // Get user's household
    const household = await c.env.DB.prepare(
      'SELECT id FROM households WHERE owner_id = ? LIMIT 1'
    ).bind(authUser.id).first();

    if (!household) {
      return c.json({ error: 'Household not found' }, 404);
    }

    // Create payment record
    const paymentId = generateId();
    const period = new Date().getFullYear().toString(); // Default to current year for dues

    await c.env.DB.prepare(`
      INSERT INTO payments (
        id, household_id, amount, currency, method, status,
        period, reference_number, payment_category, verification_status, proof_uploaded_at
      ) VALUES (?, ?, ?, 'PHP', ?, 'pending', ?, ?, ?, 'pending', datetime('now'))
    `).bind(
      paymentId,
      household.id,
      amount,
      method,
      period,
      referenceNumber || null,
      paymentType
    ).run();

    // Upload proof to R2
    const { url: fileUrl } = await uploadProofToR2(c.env.R2, proofFile, paymentId);

    // Create proof record
    const proofId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO payment_proofs (id, payment_id, file_url, file_name)
      VALUES (?, ?, ?, ?)
    `).bind(proofId, paymentId, fileUrl, proofFile.name).run();

    // Create verification queue entry
    const queueId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO payment_verification_queue (
        id, payment_id, user_id, household_id, payment_type, amount, reference_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(queueId, paymentId, authUser.id, household.id, paymentType, amount, referenceNumber || null).run();

    // Get created payment with details
    const payment = await c.env.DB.prepare(
      'SELECT * FROM payments WHERE id = ?'
    ).bind(paymentId).first();

    return c.json({
      payment,
      proof: { id: proofId, file_url: fileUrl },
      queue_id: queueId,
    }, 201);

  } catch (error) {
    console.error('Error initiating payment:', error);
    return c.json({ error: 'Failed to initiate payment' }, 500);
  }
});

// Re-upload proof for rejected payment
paymentsRouter.put('/:paymentId/proof', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const paymentId = c.req.param('paymentId');
    const formData = await c.req.formData();
    const proofFile = formData.get('proof') as File;

    if (!proofFile) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Validate file
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (proofFile.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File size exceeds 5MB limit' }, 400);
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(proofFile.type)) {
      return c.json({ error: 'Invalid file type. Only JPG, PNG, PDF allowed' }, 400);
    }

    // Verify payment belongs to user
    const payment = await c.env.DB.prepare(`
      SELECT p.*, pvq.id as queue_id
      FROM payments p
      LEFT JOIN payment_verification_queue pvq ON p.id = pvq.payment_id
      WHERE p.id = ? AND pvq.user_id = ?
    `).bind(paymentId, authUser.id).first();

    if (!payment) {
      return c.json({ error: 'Payment not found or unauthorized' }, 404);
    }

    // Upload new proof to R2
    const { url: fileUrl } = await uploadProofToR2(c.env.R2, proofFile, paymentId);

    // Update existing proof or create new one
    await c.env.DB.prepare(`
      UPDATE payment_proofs
      SET file_url = ?, file_name = ?, uploaded_at = datetime('now'), verified = 0
      WHERE payment_id = ?
    `).bind(fileUrl, proofFile.name, paymentId).run();

    // Update verification queue
    await c.env.DB.prepare(`
      UPDATE payment_verification_queue
      SET status = 'pending', updated_at = datetime('now'), rejection_reason = NULL
      WHERE payment_id = ?
    `).bind(paymentId).run();

    // Update payment verification status
    await c.env.DB.prepare(`
      UPDATE payments
      SET verification_status = 'pending', proof_uploaded_at = datetime('now')
      WHERE id = ?
    `).bind(paymentId).run();

    return c.json({ message: 'Proof uploaded successfully', file_url: fileUrl });

  } catch (error) {
    console.error('Error uploading proof:', error);
    return c.json({ error: 'Failed to upload proof' }, 500);
  }
});
