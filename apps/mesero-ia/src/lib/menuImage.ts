/** URL de imagen del menú tal como viene del API (incluye `?v=` cuando el servidor actualiza el binario). */
export function menuImageSrc(url: string | undefined | null): string {
  return (url ?? "").trim();
}
