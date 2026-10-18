/** Image sources are local files under public/img; width and quality are handled by next/image. */
export function img(src: string, _w?: number, _q?: number) {
  return src;
}
