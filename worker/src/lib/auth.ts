import { SignJWT, jwtVerify } from 'jose';
import { compare, hash } from 'bcryptjs';
import type { User, UserRole } from '../types';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashStr: string): Promise<boolean> {
  return await compare(password, hashStr);
}

export async function generateToken(userId: string, role: UserRole, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyToken(token: string, secret: string): Promise<{ userId: string; role: UserRole } | null> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: (payload as any).userId as string,
      role: (payload as any).role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(req: Request, secret: string): Promise<{ userId: string; role: UserRole } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return await verifyToken(token, secret);
}
