export function bodyFat(gender: string, waist: number, neck: number, height: number, hip: number): number {
  if (![waist, neck, height].every(value => Number.isFinite(value) && value > 0) || (gender === 'female' && (!Number.isFinite(hip) || hip <= 0))) return NaN;
  const circumference = gender === 'male' ? waist - neck : waist + hip - neck;
  if (circumference <= 0) return NaN;
  const density = gender === 'male'
    ? 1.0324 - 0.19077 * Math.log10(circumference) + 0.15456 * Math.log10(height)
    : 1.29579 - 0.35004 * Math.log10(circumference) + 0.22100 * Math.log10(height);
  const result = 495 / density - 450;
  return Number.isFinite(result) && result >= 0 && result <= 100 ? result : NaN;
}
