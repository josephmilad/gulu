export function img(src: string, w: number, q = 75) {
  return `${src}?w=${w}&q=${q}&auto=format&fit=crop`;
}
