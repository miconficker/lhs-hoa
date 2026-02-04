import { sign, verify } from 'jsonwebtoken';
import { compare, hash } from 'bcryptjs';
import type { User, UserRole } from '../types';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await compare(password, hash);
}

export function generateToken(userId: string, role: UserRole, secret: string): string {
  return sign({ userId, role }, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string, secret: string): { userId: string; role: UserRole } | null {
  try {
    const decoded = verify(token, secret) as { userId: string; role: UserRole };
    return decoded;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: Request, secret: string): { userId: string; role: UserRole } | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token, secret);
}
