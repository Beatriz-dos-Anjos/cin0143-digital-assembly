declare module "async-lock" {
  type AsyncTask<T> = () => Promise<T> | T;

  class AsyncLock {
    acquire<T>(key: string, fn: AsyncTask<T>): Promise<T>;
  }

  export default AsyncLock;
}