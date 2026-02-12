import { Hono } from 'hono';

import { logger } from '../lib/logger';import { z } from 'zod';
import { getUserFromRequest } from '../lib/auth';

type Env = {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
};

const documentSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['rules', 'forms', 'minutes', 'policies']).optional(),
});

export const documentsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// Helper function to get file extension from filename
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Helper function to get content type based on file extension
function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
  };
  return contentTypes[extension] || 'application/octet-stream';
}

// Get all documents with optional category filter
documentsRouter.get('/', async (c) => {
  const category = c.req.query('category');

  let query = 'SELECT id, title, category, file_url, uploaded_by, created_at FROM documents';
  const params: any[] = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';

  const documents = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ documents: documents.results });
});

// Get single document metadata
documentsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const document = await c.env.DB.prepare(
    'SELECT * FROM documents WHERE id = ?'
  ).bind(id).first();

  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  return c.json({ document });
});

// Upload document (admin/staff only)
documentsRouter.post('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'staff')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');
    const titleEntry = formData.get('title');
    const categoryEntry = formData.get('category');

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'No file provided' }, 400);
    }

    const file = fileEntry as File;
    const title = typeof titleEntry === 'string' ? titleEntry : '';
    const category = typeof categoryEntry === 'string' ? categoryEntry : null;

    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    // Validate category if provided
    if (category && !['rules', 'forms', 'minutes', 'policies'].includes(category)) {
      return c.json({ error: 'Invalid category' }, 400);
    }

    const id = generateId();
    const fileExtension = getFileExtension(file.name);
    const objectKey = `${id}.${fileExtension}`;

    // Upload file to R2
    await c.env.R2.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || getContentType(fileExtension),
      },
    });

    // Construct file URL
    const fileUrl = `/api/documents/${id}/download`;

    // Save metadata to D1
    await c.env.DB.prepare(
      `INSERT INTO documents (id, title, category, file_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, title, category || null, fileUrl, authUser.userId).run();

    const document = await c.env.DB.prepare(
      'SELECT * FROM documents WHERE id = ?'
    ).bind(id).first();

    return c.json({ document }, 201);
  } catch (error) {
    logger.error('Upload error', error, { action: 'upload' });
    return c.json({ error: 'Failed to upload document' }, 500);
  }
});

// Download document file from R2
documentsRouter.get('/:id/download', async (c) => {
  const id = c.req.param('id');

  // Get document metadata to find the file extension
  const document = await c.env.DB.prepare(
    'SELECT id, title FROM documents WHERE id = ?'
  ).bind(id).first();

  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Try to find the file in R2 with common extensions
  const extensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif'];
  let file: R2Object | null = null;
  let objectKey = '';

  for (const ext of extensions) {
    objectKey = `${id}.${ext}`;
    file = await c.env.R2.get(objectKey);
    if (file) break;
  }

  if (!file) {
    return c.json({ error: 'File not found in storage' }, 404);
  }

  // Cast to R2ObjectBody which has arrayBuffer method
  const r2ObjectBody = file as R2ObjectBody;
  const fileData = await r2ObjectBody.arrayBuffer();
  const contentType = getContentType(getFileExtension(objectKey));

  return new Response(fileData, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${document.title}.${getFileExtension(objectKey)}"`,
    },
  });
});

// Delete document (admin only)
documentsRouter.delete('/:id', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser || authUser.role !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const id = c.req.param('id');

  // Check if document exists
  const document = await c.env.DB.prepare(
    'SELECT id FROM documents WHERE id = ?'
  ).bind(id).first();

  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Delete file from R2 (try all extensions)
  const extensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'gif'];
  for (const ext of extensions) {
    await c.env.R2.delete(`${id}.${ext}`);
  }

  // Delete metadata from D1
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});
