import type { SeedStaff } from './auth.mock'

/**
 * Accounts of the local demo ("Deneme ortamı"). They exist only in this browser's mock
 * database and are shown on the login screen — never used against a real backend.
 */
export const DEMO_TOTP_SECRET = 'KASIFSTUDIODEMOTOTPSECRETKASIF23'

export const DEMO_ACCOUNTS = {
  admin: {
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'yonetici@kasif.dev',
    displayName: 'Deniz Yıldız',
    role: 'admin',
    password: 'Kasif.Studio.2026',
    totpSecret: DEMO_TOTP_SECRET,
  },
  admin2: {
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'ikinci.yonetici@kasif.dev',
    displayName: 'Ali Kaya',
    role: 'admin',
    password: 'Kasif.Studio.2026',
    totpSecret: DEMO_TOTP_SECRET,
  },
  editor: {
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'editor@kasif.dev',
    displayName: 'Elif Demir',
    role: 'editor',
    password: 'Kasif.Editor.2026',
  },
} as const satisfies Record<string, SeedStaff>
