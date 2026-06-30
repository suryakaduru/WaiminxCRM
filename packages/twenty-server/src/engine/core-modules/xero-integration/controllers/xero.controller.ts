import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { Response } from 'express';

import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';

@Controller('auth/xero')
export class XeroController {
  private readonly logger = new Logger(XeroController.name);

  constructor(private readonly xeroOAuthService: XeroOAuthService) {}

  @Get('connect')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  connect(@Res() res: Response) {
    if (!this.xeroOAuthService.isEnabled()) {
      throw new NotFoundException('Xero integration is not enabled');
    }

    const { url } = this.xeroOAuthService.buildAuthorizeUrl();

    return res.redirect(url);
  }

  @Get('callback')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.xeroOAuthService.isEnabled()) {
      throw new NotFoundException('Xero integration is not enabled');
    }

    if (error) {
      this.logger.warn(`Xero OAuth callback returned error: ${error}`);
      throw new BadRequestException(`Xero returned error: ${error}`);
    }

    if (!code || !state) {
      throw new BadRequestException('Missing code or state from Xero callback');
    }

    if (!this.xeroOAuthService.consumeState(state)) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tokens = await this.xeroOAuthService.exchangeCodeForTokens(code);
    const tenants = await this.xeroOAuthService.listTenants(tokens.access_token);

    this.logger.log(
      `Xero OAuth success — token scope: ${tokens.scope}, expiresIn: ${tokens.expires_in}s, tenants: ${tenants
        .map((tenant) => `${tenant.tenantName} (${tenant.tenantId})`)
        .join(', ')}`,
    );

    return res
      .status(200)
      .send(
        '<html><body style="font-family:system-ui;padding:48px;text-align:center;">' +
          '<h1>Xero connected ✓</h1>' +
          `<p>${tenants.length} tenant(s) authorized.</p>` +
          '<p style="color:#888;font-size:13px;">Token logged server-side. Persistence in next slice.</p>' +
          '<p><a href="/finance">Open Finance Dashboard</a></p>' +
          '</body></html>',
      );
  }
}
