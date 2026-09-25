/** Studio accounts of the local Supabase stack in CI (e2e/supabase/seed.ts). Test data only. */
export const SUPABASE_E2E = {
  admin: {
    email: 'admin@kasif.e2e',
    password: 'Kasif.Admin.2026',
    name: 'Deniz Yönetici',
    role: 'admin',
    totpSecret: 'KASIFSUPABASEE2ETOTPSECRETKASIF2',
  },
  editor: {
    email: 'editor@kasif.e2e',
    password: 'Kasif.Editor.2026',
    name: 'Ece Editör',
    role: 'editor',
    totpSecret: null,
  },
} as const
