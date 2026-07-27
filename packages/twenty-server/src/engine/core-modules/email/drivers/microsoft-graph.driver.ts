import { Logger } from '@nestjs/common';

import { type Address, type SendMailOptions } from 'nodemailer';

import { type EmailDriverInterface } from 'src/engine/core-modules/email/drivers/interfaces/email-driver.interface';

export type MicrosoftGraphDriverOptions = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  // Mailbox the app sends as (Graph /users/{sender}/sendMail)
  sender: string;
  senderName?: string;
};

type GraphRecipient = { emailAddress: { address: string; name?: string } };

// Sends transactional email (invites, password reset, verification) through
// Microsoft Graph with an app-only client-credentials token. Used when the
// tenant blocks basic SMTP auth (Security Defaults) so the SMTP driver can't
// authenticate. Requires the Mail.Send APPLICATION permission with admin consent.
export class MicrosoftGraphDriver implements EmailDriverInterface {
  private readonly logger = new Logger(MicrosoftGraphDriver.name);
  private cachedToken?: { value: string; expiresAt: number };

  constructor(private readonly options: MicrosoftGraphDriverOptions) {}

  async send(sendMailOptions: SendMailOptions): Promise<void> {
    try {
      const token = await this.getAccessToken();

      const message = {
        subject: this.asString(sendMailOptions.subject),
        body: {
          contentType: 'HTML',
          content:
            this.asString(sendMailOptions.html) ??
            this.asString(sendMailOptions.text) ??
            '',
        },
        toRecipients: this.toRecipients(sendMailOptions.to),
        from: {
          emailAddress: {
            address: this.options.sender,
            name: this.options.senderName,
          },
        },
      };

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
          this.options.sender,
        )}/sendMail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message, saveToSentItems: false }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();

        throw new Error(`Graph sendMail ${response.status}: ${detail}`);
      }

      this.logger.log(
        `Email to '${sendMailOptions.to}' successfully sent via Microsoft Graph`,
      );
    } catch (err) {
      this.logger.error(`sending email to '${sendMailOptions.to}': ${err}`);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.value;
    }

    const body = new URLSearchParams({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(
        this.options.tenantId,
      )}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );

    if (!response.ok) {
      const detail = await response.text();

      throw new Error(`Graph token ${response.status}: ${detail}`);
    }

    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cachedToken = {
      value: json.access_token,
      expiresAt: now + json.expires_in * 1000,
    };

    return json.access_token;
  }

  private toRecipients(
    to: SendMailOptions['to'],
  ): GraphRecipient[] {
    const addresses: string[] = [];

    const push = (value: string | Address | undefined) => {
      if (!value) return;

      if (typeof value === 'string') {
        value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((address) => addresses.push(address));
      } else {
        addresses.push(value.address);
      }
    };

    if (Array.isArray(to)) {
      to.forEach(push);
    } else {
      push(to);
    }

    return addresses.map((address) => ({ emailAddress: { address } }));
  }

  private asString(
    value: string | Buffer | undefined | false | null | unknown,
  ): string | undefined {
    if (typeof value === 'string') return value;

    if (Buffer.isBuffer(value)) return value.toString('utf-8');

    return undefined;
  }
}
