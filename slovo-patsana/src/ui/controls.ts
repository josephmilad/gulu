export function controlsHtml() {
  const rows: [string, string][] = [
    ['Ходить', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>'],
    ['Бег', '<kbd>Shift</kbd>'],
    ['Камера', 'мышь (кликни по экрану) · <kbd>Z</kbd> / <kbd>C</kbd>'],
    ['Удар рукой (серия)', '<kbd>ЛКМ</kbd> или <kbd>J</kbd> — жми несколько раз'],
    ['Удар ногой', '<kbd>ПКМ</kbd> или <kbd>K</kbd>'],
    ['Блок', '<kbd>Q</kbd> или <kbd>L</kbd> (держать)'],
    ['Спецприём', '<kbd>E</kbd> или <kbd>U</kbd> (нужна жёлтая полоса)'],
    ['Уклон', '<kbd>Пробел</kbd>'],
    ['Пауза', '<kbd>Esc</kbd>'],
    ['Геймпад', 'стик — ходить, X — рука, Y — нога, B — приём, A — уклон, LB — блок'],
  ];
  return rows.map(([a, b]) => `<div>${a}</div><div>${b}</div>`).join('');
}
