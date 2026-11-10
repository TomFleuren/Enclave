import type { TotpConfig } from '../crypto/totp';
import type { VaultItemDraft } from '../vault/model';
import { addItem, createEmptyVault, EMPTY_DRAFT } from '../vault/model';
import type { UnlockedVault } from '../vault/vault';
import { createVault } from '../vault/vault';

/**
 * Sample data for the development demo (`npm run dev`, then open `/#demo`).
 *
 * Every account, password and key below is invented and protects nothing.
 */
function code(secret: string): TotpConfig {
  return { secret, algorithm: 'SHA-1', digits: 6, period: 30 };
}

const ITEMS: VaultItemDraft[] = [
  {
    ...EMPTY_DRAFT,
    title: 'GitHub',
    username: 'ada@example.com',
    password: 'kV7#tq2!Zp9$Lm4&Wx8*',
    url: 'https://github.com',
    notes: 'Recovery codes are printed and in the desk drawer.',
    totp: code('JBSWY3DPEHPK3PXP'),
    favorite: true,
  },
  {
    ...EMPTY_DRAFT,
    title: 'Proton Mail',
    username: 'ada.lovelace@example.com',
    password: 'Nf3^bR8@yH6!cT1%uJ5(',
    url: 'https://mail.proton.me',
    totp: code('KRSXG5CTMVRXEZLU'),
    favorite: true,
  },
  {
    ...EMPTY_DRAFT,
    title: 'Cloudflare',
    username: 'ada@example.com',
    password: 'Qw9!eD4#rF7$tG2%yH6^',
    url: 'https://dash.cloudflare.com',
    totp: code('MFRGGZDFMZTWQ2LK'),
  },
  {
    ...EMPTY_DRAFT,
    title: 'Figma',
    username: 'ada@example.com',
    password: 'Zx5&cV8*bN1(mK4)jL7_',
    url: 'https://figma.com',
  },
  {
    ...EMPTY_DRAFT,
    title: 'Home router',
    username: 'admin',
    password: 'Pa2$sD6!fG9@hJ3#kL5%',
    url: 'http://192.168.1.1',
    notes: 'Guest network password is on the fridge.',
  },
  {
    ...EMPTY_DRAFT,
    title: 'npm',
    username: 'ada-lovelace',
    password: 'Ty8*uI3(oP6)aS1_dF4+',
    url: 'https://www.npmjs.com',
    totp: code('ONSWG4TFOQQGWZLZ'),
  },
  {
    ...EMPTY_DRAFT,
    title: 'Stripe',
    username: 'billing@example.com',
    password: 'Gh7^jK2&lZ5*xC9(vB4)',
    url: 'https://dashboard.stripe.com',
    totp: code('GEZDGNBVGY3TQOJQ'),
  },
];

export function createDemoVault(): Promise<UnlockedVault> {
  const data = ITEMS.reduce((vault, item) => addItem(vault, item), createEmptyVault());
  return createVault('demo master password', data);
}
