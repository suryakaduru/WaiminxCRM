import { Injectable, Logger } from '@nestjs/common';

import { randomBytes } from 'crypto';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';

type StateEntry = {
  expiresAt: number;
};

type XeroTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
};

type XeroTenant = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
};

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class XeroOAuthService {
  private readonly logger = new Logger(XeroOAuthService.name);
  private readonly pendingStates = new Map<string, StateEntry>();

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  isEnabled(): boolean {
    return this.twentyConfigService.get('XERO_INTEGRATION_ENABLED');
  }

  buildAuthorizeUrl(): { url: string; state: string } {
    const clientId = this.twentyConfigService.get('XERO_CLIENT_ID');
    const redirectUri = this.twentyConfigService.get('XERO_REDIRECT_URI');
    const scopes = this.twentyConfigService.get('XERO_SCOPES');

    if (!clientId || !redirectUri) {
      throw new Error('Xero client id or redirect uri not configured');
    }

    const state = randomBytes(24).toString('hex');

    this.rememberState(state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });

    return { url: `${XERO_AUTHORIZE_URL}?${params.toString()}`, state };
  }

  consumeState(state: string): boolean {
    this.purgeExpiredStates();
    const entry = this.pendingStates.get(state);

    if (!entry || entry.expiresAt < Date.now()) {
      return false;
    }

    this.pendingStates.delete(state);

    return true;
  }

  async exchangeCodeForTokens(code: string): Promise<XeroTokenResponse> {
    const clientId = this.twentyConfigService.get('XERO_CLIENT_ID');
    const clientSecret = this.twentyConfigService.get('XERO_CLIENT_SECRET');
    const redirectUri = this.twentyConfigService.get('XERO_REDIRECT_URI');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(`Xero token exchange failed: ${response.status} ${text}`);
    }

    return (await response.json()) as XeroTokenResponse;
  }

  async listTenants(accessToken: string): Promise<XeroTenant[]> {
    const response = await fetch(XERO_CONNECTIONS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();

      throw new Error(`Xero connections fetch failed: ${response.status} ${text}`);
    }

    return (await response.json()) as XeroTenant[];
  }

  private rememberState(state: string): void {
    this.pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS });
    this.purgeExpiredStates();
  }

  private purgeExpiredStates(): void {
    const now = Date.now();

    for (const [state, entry] of this.pendingStates.entries()) {
      if (entry.expiresAt < now) {
        this.pendingStates.delete(state);
      }
    }
  }
}
