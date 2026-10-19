import type {
  CodeRecord,
  GrantRecord,
  OAuthStore,
  TokenRecord,
  TokenRow,
} from '../../../src/lib/oauth/token-endpoint';

/** A token as the memory store keeps it. */
interface StoredToken {
  kind: 'access' | 'refresh';
  grantId: string;
  expiresAt: number;
  usedAt: number | null;
}

/** An in-memory store with the same atomic-claim behaviour as D1, for tests. */
export class MemoryStore implements OAuthStore {
  codes = new Map<string, CodeRecord>();
  grants = new Map<string, GrantRecord>();
  tokens = new Map<string, StoredToken>();
  touched: string[] = [];

  async saveCode(hash: string, code: CodeRecord) {
    this.codes.set(hash, code);
  }
  async findCode(hash: string) {
    return this.codes.get(hash);
  }
  async claimCode(hash: string, grantId: string) {
    const code = this.codes.get(hash);
    if (!code || code.grantId) {
      return false;
    }
    this.codes.set(hash, { ...code, grantId });
    return true;
  }
  async createGrant(
    grant: Omit<GrantRecord, 'revoked' | 'lastUsedAt'>,
    tokens: readonly TokenRow[],
  ) {
    // One connection per (user, client): approving again replaces the old one.
    for (const [id, other] of this.grants) {
      if (
        other.userId === grant.userId &&
        other.clientId === grant.clientId &&
        !other.revoked
      ) {
        this.grants.set(id, { ...other, revoked: true });
      }
    }
    this.grants.set(grant.id, { ...grant, revoked: false, lastUsedAt: null });
    await this.saveTokens(tokens);
  }
  async revokeGrant(grantId: string) {
    const grant = this.grants.get(grantId);
    if (grant) {
      this.grants.set(grantId, { ...grant, revoked: true });
    }
  }
  async saveTokens(tokens: readonly TokenRow[]) {
    for (const { hash, ...token } of tokens) {
      this.tokens.set(hash, { ...token, usedAt: null });
    }
  }
  async findToken(hash: string): Promise<TokenRecord | undefined> {
    const token = this.tokens.get(hash);
    const grant = token && this.grants.get(token.grantId);
    return token && grant ? { ...token, grant } : undefined;
  }
  async rotateRefreshToken(
    hash: string,
    now: number,
    tokens: readonly TokenRow[],
  ) {
    const token = this.tokens.get(hash);
    if (!token || token.usedAt !== null) {
      return false;
    }
    this.tokens.set(hash, { ...token, usedAt: now });
    await this.saveTokens(tokens);
    return true;
  }
  async touchGrant(grantId: string, now: number) {
    this.touched.push(grantId);
    const grant = this.grants.get(grantId);
    if (grant) {
      this.grants.set(grantId, { ...grant, lastUsedAt: now });
    }
  }
}
