// IndexedDB es la fuente de verdad en el teléfono: se pide que el navegador no la desaloje
// cuando le falte espacio. En una PWA instalada en iOS se concede sin preguntar.
export async function pedirAlmacenamientoPersistente(): Promise<void> {
  if (!navigator.storage?.persist) return
  if (await navigator.storage.persisted()) return
  await navigator.storage.persist()
}
