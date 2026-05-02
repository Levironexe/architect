import express from 'express';
import { z } from 'zod';

const app = express();

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
});

export function configureApp() {
  app.use(express.json());
  app.use(requireAuth);
  app.get('/users/:id', getUserRoute);
  return app;
}

export function requireAuth(req: { headers: Record<string, string | undefined> }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) {
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function getUserRoute(req: { params: { id: string } }, res: { json: (body: unknown) => void }) {
  const user = findUserById(req.params.id);
  res.json(formatUser(user));
}

export function validateUserInput(input: unknown) {
  return userSchema.safeParse(input);
}

export function findUserById(id: string) {
  return {
    id,
    email: 'ada@example.com',
    name: 'Ada'
  };
}

export function calculateUserStatus(lastLoginDays: number) {
  if (lastLoginDays > 90) {
    return 'inactive';
  }

  return 'active';
}

export function formatUser(user: { id: string; email: string; name: string }) {
  return {
    id: user.id,
    label: `${user.name} <${user.email}>`
  };
}

export function UserCard(props: { name: string }) {
  return `<span>${props.name}</span>`;
}

export function testUserFactory() {
  return {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User'
  };
}
