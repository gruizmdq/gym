// IndexedDB is the source of truth on the phone: ask the browser not to evict it when it
// runs low on space. In a PWA installed on iOS it's granted without asking.
export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return
  if (await navigator.storage.persisted()) return
  await navigator.storage.persist()
}
