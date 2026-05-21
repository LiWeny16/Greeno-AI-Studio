const locks = new Map<string, Promise<void>>();

export async function withWriteLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(projectId, next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}
