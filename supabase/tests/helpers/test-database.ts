import { PGlite, type Transaction } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HELPERS_DIR = import.meta.dirname;
const MIGRATIONS_DIR = join(HELPERS_DIR, "..", "..", "migrations");

/** A database session that runs as one user, with RLS applied. */
export type Session = Transaction;

/**
 * An in-memory Postgres with our real migrations applied.
 *
 * Lets tests act as any user ("as Owner A", "as Staff", "as a guest") and
 * check that Row Level Security allows or blocks exactly what Part B says.
 * Each test file creates its own database, so tests never share data.
 */
export class TestDatabase {
  private constructor(private readonly db: PGlite) {}

  static async create(): Promise<TestDatabase> {
    const db = await PGlite.create();

    await db.exec(readFileSync(join(HELPERS_DIR, "supabase-stubs.sql"), "utf8"));
    for (const file of TestDatabase.migrationFiles()) {
      await db.exec(readFileSync(file, "utf8"));
    }

    return new TestDatabase(db);
  }

  /** Migrations in the order Supabase applies them (by file name). */
  private static migrationFiles(): string[] {
    return readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => join(MIGRATIONS_DIR, name));
  }

  /**
   * Creates a login user; the migration's trigger then creates their profile.
   * `contact` sets the email and phone shown in the admin user list.
   */
  async createUser(
    fullName: string,
    contact: { email?: string; phone?: string } = {},
  ): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      "insert into auth.users (id, email, phone, raw_user_meta_data) values ($1, $2, $3, $4)",
      [id, contact.email ?? null, contact.phone ?? null, { full_name: fullName }],
    );
    return id;
  }

  /**
   * Runs `work` as a logged-in user (`authenticated` role), or as a guest
   * (`anon` role) when `userId` is null. RLS applies, like in the browser.
   * Everything runs in one transaction: an error rolls the work back.
   */
  as<T>(userId: string | null, work: (session: Session) => Promise<T>): Promise<T> {
    return this.db.transaction(async (session) => {
      await session.exec(userId ? "set local role authenticated" : "set local role anon");
      await session.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      return work(session);
    });
  }

  /**
   * Runs SQL as the database owner. RLS is bypassed, like server code using
   * the Supabase secret key. Use it only to arrange or inspect test data.
   */
  asService<T>(sql: string, params: unknown[] = []) {
    return this.db.query<T>(sql, params);
  }

  close(): Promise<void> {
    return this.db.close();
  }
}
