export interface PasswordOptions { upper: boolean; lower: boolean; number: boolean; symbol: boolean; noAmbig: boolean; }
// Rejection sampling avoids modulo bias and ensures every selected group is represented.
export function generatePassword(length: number, options: PasswordOptions): string {
  if (!Number.isInteger(length) || length < 4 || length > 64) throw new Error('Password length must be 4 to 64');
  const groups = [options.upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '', options.lower ? 'abcdefghijklmnopqrstuvwxyz' : '', options.number ? '0123456789' : '', options.symbol ? '!@#$%^&*()-_=+[]{}|;:,.<>?' : '']
    .map(group => options.noAmbig ? group.replace(/[O0Il1|]/g, '') : group).filter(Boolean);
  if (!groups.length) throw new Error('Select at least one character group');
  const randomIndex = (max: number) => {
    const limit = 256 - (256 % max), buffer = new Uint8Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % max;
  };
  const alphabet = groups.join('');
  const chars = groups.map(group => group[randomIndex(group.length)]);
  while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randomIndex(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
