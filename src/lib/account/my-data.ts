import type { CategoryRow } from "@/lib/categories/category";
import type { StoredEntry } from "@/lib/entries/entry";
import { Money } from "@/lib/money";
import type { Product } from "@/lib/products/product";
import type { PaymentInfo, SubscriptionInfo } from "./billing";
import type { AccountProfile } from "./profile-repository";

/** One shop the person owns, with everything in it. */
export interface ShopData {
  name: string;
  currency: string;
  businessType: string | null;
  categories: readonly CategoryRow[];
  products: readonly Product[];
  entries: readonly StoredEntry[];
  /** The name of an entry's category in the person's language (its own name, or the translated default). */
  categoryLabel: (entry: StoredEntry) => string;
  /** True when the shop has more records than one export can hold. */
  entriesTruncated: boolean;
}

export interface MyDataInput {
  exportedAt: Date;
  /** The login: email (or phone) and when the person joined. */
  account: { email: string | null };
  profile: AccountProfile;
  shops: readonly ShopData[];
  subscription: SubscriptionInfo | null;
  payments: readonly PaymentInfo[];
  /** When our team looked at the account (times only). */
  supportAccessLog: readonly string[];
}

/**
 * "Download all my data" (Account → Privacy & data, spec D6): everything we
 * keep about the person, as one readable JSON document. Amounts come twice,
 * as cents (exact) and as a decimal number (easy to read in a spreadsheet).
 *
 * It holds nothing that belongs to somebody else: only the person's own
 * profile, the shops they OWN and their own billing. Staff and viewers get
 * their profile and billing only; the shop's records belong to its owner.
 */
export function buildMyDataExport(input: MyDataInput): Record<string, unknown> {
  const { profile } = input;

  return {
    exportedAt: input.exportedAt.toISOString(),
    account: { email: input.account.email },
    profile: {
      name: profile.fullName,
      photo: profile.avatarUrl,
      language: profile.locale,
      dateFormat: profile.dateFormat,
      defaultCurrency: profile.defaultCurrency,
      notifications: profile.notifications,
      supportAccessUntil: profile.supportAccessUntil,
    },
    shops: input.shops.map((shop) => {
      const productNames = new Map(shop.products.map((product) => [product.id, product.name]));
      return {
      name: shop.name,
      currency: shop.currency,
      businessType: shop.businessType,
      categories: shop.categories.map((category) => ({
        key: category.key,
        name: category.name,
        type: category.type,
        countsAs: category.countsAs,
        archived: category.archived,
      })),
      products: shop.products.map((product) => ({
        name: product.name,
        kind: product.kind,
        companyName: product.companyName,
        unit: product.unit,
        costCents: product.costCents,
        priceCents: product.priceCents,
        barcode: product.barcode,
        notes: product.notes,
        archived: product.archived,
      })),
      entries: shop.entries.map((entry) => ({
        date: entry.entryDate,
        type: entry.type,
        category: shop.categoryLabel(entry),
        product: entry.productId ? (productNames.get(entry.productId) ?? null) : null,
        quantity: entry.quantity,
        amountCents: entry.amountCents,
        amount: Money.fromCents(entry.amountCents, shop.currency).toDecimalString(),
        note: entry.note,
        addedAt: entry.createdAt,
      })),
      entriesComplete: !shop.entriesTruncated,
      };
    }),
    plan: input.subscription,
    payments: input.payments.map((payment) => ({
      date: payment.paidAt,
      amountCents: payment.amountCents,
      amount: Money.fromCents(payment.amountCents, payment.currency).toDecimalString(),
      currency: payment.currency,
      status: payment.status,
    })),
    supportAccessLog: input.supportAccessLog,
  };
}

/** The file name offered for the download, e.g. "profit-calculator-my-data-2026-11-23.json". */
export function myDataFilename(date: string): string {
  return `profit-calculator-my-data-${date}.json`;
}
