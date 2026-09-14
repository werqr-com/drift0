/** Parse click values like "0.25moa" or "0.1mil" into a numeric step. */
export function parseClickValue(clickValue: string): number {
  const match = clickValue.match(/^([\d.]+)(moa|mil)$/i);
  if (!match) return 0.25;
  return parseFloat(match[1]);
}
