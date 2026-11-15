/**
 * Better Auth's database layout, mapped to our naming rules (plural tables, snake_case columns).
 * Plain module with no imports so `scripts/auth-schema-sql.mts` can load it with Node directly.
 *
 * The tables themselves are created by dbmate migrations (AGENTS.md §6), never by Better Auth.
 * After a Better Auth upgrade, run `npm run auth:schema` to see the SQL it expects.
 */

export const STAFF_ROLES = ["owner", "receptionist", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const timestamps = { createdAt: "created_at", updatedAt: "updated_at" } as const;

export const authSchemaOptions = {
  user: {
    modelName: "users",
    fields: { emailVerified: "email_verified", ...timestamps },
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "staff", input: false, fieldName: "role" },
      staffId: { type: "string", required: false, input: false, fieldName: "staff_id" },
      active: { type: "boolean", required: true, defaultValue: true, input: false, fieldName: "active" },
    },
  },
  session: {
    modelName: "sessions",
    fields: { expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent", userId: "user_id", ...timestamps },
  },
  account: {
    modelName: "accounts",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      ...timestamps,
    },
  },
  verification: {
    modelName: "verifications",
    fields: { expiresAt: "expires_at", ...timestamps },
  },
  rateLimit: {
    // Stored in Postgres so limits survive restarts (the default memory store resets).
    storage: "database",
    modelName: "rate_limits",
    fields: { lastRequest: "last_request" },
  },
  advanced: { database: { generateId: "uuid" } },
} as const;
