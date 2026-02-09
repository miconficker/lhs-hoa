import { Hono } from "hono";
import { z } from "zod";
import { getUserFromRequest } from "../lib/auth";

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
};

const notificationSchema = z.object({
  user_id: z.string().optional(),
  type: z.enum(["demand_letter", "reminder", "late_notice", "announcement", "alert"]),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
});

const bulkNotificationSchema = z.object({
  target: z.enum(["all", "delinquent", "specific"]),
  user_ids: z.array(z.string()).optional(),
  type: z.enum(["demand_letter", "reminder", "late_notice", "announcement", "alert"]),
  title: z.string().min(1),
  content: z.string().min(1),
  link: z.string().optional(),
  send_now: z.boolean().optional(),
});

export const notificationsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Get current user's notifications
notificationsRouter.get("/", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const type = c.req.query("type");
  const readStatus = c.req.query("read");

  let query = `
    SELECT id, user_id, type, title, content, link, read, created_at, sent_at
    FROM notifications
    WHERE user_id = ?
  `;
  const params: any[] = [authUser.userId];

  if (type) {
    query += ` AND type = ?`;
    params.push(type);
  }

  if (readStatus !== undefined) {
    query += ` AND read = ?`;
    params.push(readStatus === "true" ? 1 : 0);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const notifications = await c.env.DB.prepare(query)
    .bind(...params)
    .all();

  // Get unread count
  const unreadResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`
  ).bind(authUser.userId).first();

  return c.json({
    notifications: notifications.results,
    unread_count: unreadResult?.count || 0,
  });
});

// Get single notification
notificationsRouter.get("/:id", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  const notification = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE id = ? AND user_id = ?`
  ).bind(id, authUser.userId).first();

  if (!notification) {
    return c.json({ error: "Notification not found" }, 404);
  }

  return c.json({ notification });
});

// Create notification (admin only)
notificationsRouter.post("/", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = notificationSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid input", details: result.error.flatten() },
      400
    );
  }

  const { user_id, type, title, content, link } = result.data;

  if (!user_id) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO notifications (id, user_id, type, title, content, link, read, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`
  ).bind(id, user_id, type, title, content, link || null).run();

  const notification = await c.env.DB.prepare(
    "SELECT * FROM notifications WHERE id = ?"
  ).bind(id).first();

  return c.json({ notification }, 201);
});

// Mark notification as read
notificationsRouter.put("/:id/read", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  // Verify ownership
  const existing = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE id = ? AND user_id = ?`
  ).bind(id, authUser.userId).first();

  if (!existing) {
    return c.json({ error: "Notification not found" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE id = ?`
  ).bind(id).run();

  const notification = await c.env.DB.prepare(
    "SELECT * FROM notifications WHERE id = ?"
  ).bind(id).first();

  return c.json({ notification });
});

// Mark all notifications as read
notificationsRouter.put("/read-all", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`
  ).bind(authUser.userId).run();

  return c.json({ success: true });
});

// Delete notification
notificationsRouter.delete("/:id", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");

  // Verify ownership
  const existing = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE id = ? AND user_id = ?`
  ).bind(id, authUser.userId).first();

  if (!existing) {
    return c.json({ error: "Notification not found" }, 404);
  }

  await c.env.DB.prepare(`DELETE FROM notifications WHERE id = ?`)
    .bind(id)
    .run();

  return c.json({ success: true });
});

// Admin: Send bulk notifications
notificationsRouter.post("/admin/send", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = bulkNotificationSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid input", details: result.error.flatten() },
      400
    );
  }

  const { target, user_ids, type, title, content, link, send_now } =
    result.data;

  let targetUsers: string[] = [];

  if (target === "all") {
    const users = await c.env.DB.prepare(
      `SELECT id FROM users WHERE role != 'guest'`
    ).all();
    targetUsers = users.results.map((u: any) => u.id);
  } else if (target === "delinquent") {
    // Get users with unpaid dues
    const users = await c.env.DB.prepare(
      `SELECT DISTINCT owner_user_id as id
       FROM households
       WHERE owner_user_id IS NOT NULL
       AND id IN (
         SELECT DISTINCT household_id
         FROM payment_demands
         WHERE status = 'pending'
         AND due_date < date('now', '+30 days')
       )`
    ).all();
    targetUsers = users.results.map((u: any) => u.id);
  } else if (target === "specific" && user_ids) {
    targetUsers = user_ids;
  }

  if (targetUsers.length === 0) {
    return c.json({ error: "No target users found" }, 400);
  }

  const notifications: any[] = [];
  const sentAt = send_now ? "datetime('now')" : "NULL";

  for (const userId of targetUsers) {
    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, content, link, read, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ${sentAt})`
    )
      .bind(id, userId, type, title, content, link || null)
      .run();

    const notification = await c.env.DB.prepare(
      "SELECT * FROM notifications WHERE id = ?"
    )
      .bind(id)
      .first();

    notifications.push(notification);
  }

  return c.json({
    success: true,
    count: notifications.length,
    notifications,
  });
});

// Admin: Get all notifications (for history)
notificationsRouter.get("/admin/all", async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const limit = parseInt(c.req.query("limit") || "100");
  const offset = parseInt(c.req.query("offset") || "0");

  const notifications = await c.env.DB.prepare(
    `SELECT n.*, u.email as user_email
     FROM notifications n
     LEFT JOIN users u ON n.user_id = u.id
     ORDER BY n.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(limit, offset)
    .all();

  return c.json({ notifications: notifications.results });
});

// Helper: Create notification for a user
export async function createNotification(
  db: D1Database,
  userId: string,
  type: "demand_letter" | "reminder" | "late_notice" | "announcement" | "alert",
  title: string,
  content: string,
  link?: string
): Promise<void> {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO notifications (id, user_id, type, title, content, link, read, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  )
    .bind(id, userId, type, title, content, link || null)
    .run();
}

// Helper: Create notifications for multiple users
export async function createBulkNotifications(
  db: D1Database,
  userIds: string[],
  type: "demand_letter" | "reminder" | "late_notice" | "announcement" | "alert",
  title: string,
  content: string,
  link?: string
): Promise<void> {
  for (const userId of userIds) {
    await createNotification(db, userId, type, title, content, link);
  }
}
