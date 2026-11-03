export const PASSWORD_SPECIALS = '!@#$%^&*(),.?:{}|<>+=_-';

export function checkPassword(pw) {
  if (pw.length < 14 || pw.length > 64 || new TextEncoder().encode(pw).length > 72) {
    return 'Le mot de passe doit contenir entre 14 et 64 caractères';
  }
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Le mot de passe doit contenir majuscule, minuscule et chiffre.';
  }
  if (![...pw].some((c) => PASSWORD_SPECIALS.includes(c))) {
    return `Un caractère spécial est requis parmi : ${PASSWORD_SPECIALS}`;
  }
  return '';
}