export const defaultPassword = '123456';
export const changedPassword = '654321';

export function uniqueEmail(prefix = 'mobile'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@empresa.com`;
}
