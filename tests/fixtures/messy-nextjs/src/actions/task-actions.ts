'use server';

export async function createTask(name: string) {
  if (!name) {
    throw new Error('Name is required');
  }
  return { id: '1', name };
}
