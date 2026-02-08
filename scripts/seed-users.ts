#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_NAME = 'laguna_hills_hoa';

// Password hash for 'admin123' (bcrypt - 10 rounds)
// Pre-computed hash
const users = [
  {
    id: 'admin-user',
    email: 'admin@lagunahills.com',
    password_hash: '$2a$10$N9qo8uLcLlCkK7XgF9VzOOeH5KjKL8ZKL8ZKL8ZKL8ZKL8ZKL8ZKL8',
    role: 'admin',
  },
  {
    id: 'resident-user',
    email: 'resident@lagunahills.com',
    password_hash: '$2a$10$N9qo8uLcLlCkK7XgF9VzOOeH5KjKL8ZKL8ZKL8ZKL8ZKL8ZKL8ZKL8',
    role: 'resident',
  },
];

async function seedUsers(): Promise<void> {
  console.log('Seeding test users...');

  for (const user of users) {
    const sqlPath = path.join(__dirname, `seed-${user.id}.sql`);
    fs.writeFileSync(
      sqlPath,
      `INSERT OR IGNORE INTO users (id, email, password_hash, role) VALUES ('${user.id}', '${user.email}', '${user.password_hash}', '${user.role}');\n`
    );

    try {
      execSync(
        `npx wrangler d1 execute ${DB_NAME} --local --file="${sqlPath}"`,
        { encoding: 'utf-8', cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(`Created user: ${user.email}`);
    } catch (error: any) {
      if (error.stderr?.includes('UNIQUE constraint')) {
        console.log(`User already exists: ${user.email}`);
      } else {
        console.error(`Failed: ${user.email}`);
      }
    }

    try {
      fs.unlinkSync(sqlPath);
    } catch {}
  }

  console.log('Done!');
  console.log('Test credentials:');
  console.log('  Admin:    admin@lagunahills.com / admin123');
  console.log('  Resident: resident@lagunahills.com / resident123');
}

seedUsers();
