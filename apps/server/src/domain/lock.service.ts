type AsyncTask<T> = () => Promise<T> | T;

interface AsyncLockInstance {
  acquire<T>(key: string, task: AsyncTask<T>): Promise<T>;
}

const AsyncLock: new () => AsyncLockInstance = require("async-lock");
const sessionLock = new AsyncLock();

export async function withSessionLock<T>(
  sessionId: string,
  task: AsyncTask<T>
): Promise<T> {
  return sessionLock.acquire(`session:${sessionId}`, task);
}