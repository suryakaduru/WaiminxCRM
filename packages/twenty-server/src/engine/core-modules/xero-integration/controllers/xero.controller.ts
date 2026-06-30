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
import { XeroConnectionService } from 'src/engine/core-modules/xero-integration/services/xero-connection.service';
import { XeroOAuthService } from 'src/engine/core-modules/xero-integration/services/xero-oauth.service';

@Controller('auth/xero')
export class XeroController {
  private readonly logger = new Logger(XeroController.name);

  constructor(
    private readonly xeroOAuthService: XeroOAuthService,
    private readonly xeroConnectionService: XeroConnectionService,
  ) {}

  @Get('connect')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  connect(
    @Query('workspaceId') workspaceId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.xeroOAuthService.isEnabled()) {
      throw new NotFoundException('Xero integration is not enabled');
    }

    if (!workspaceId) {
      throw new BadRequestException(
        'Missing workspaceId query parameter on /auth/xero/connect',
      );
    }

    const { url } = this.xeroOAuthService.buildAuthorizeUrl({
      workspaceId,
      userId: userId ?? null,
    });

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

    const stateEntry = this.xeroOAuthService.consumeState(state);

    if (!stateEntry) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const tokens = await this.xeroOAuthService.exchangeCodeForTokens(code);
    const tenants = await this.xeroOAuthService.listTenants(tokens.access_token);

    if (tenants.length === 0) {
      this.logger.warn(
        'Xero OAuth succeeded but no tenants returned. ' +
          'Check that the requested scopes include an API scope (e.g. accounting.transactions).',
      );
    }

    for (const tenant of tenants) {
      await this.xeroConnectionService.saveConnection({
        workspaceId: stateEntry.workspaceId,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName ?? null,
        tenantType: tenant.tenantType ?? null,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        accessTokenExpiresInSeconds: tokens.expires_in,
        scopes: tokens.scope,
        connectedByUserId: stateEntry.userId,
      });
    }

    this.logger.log(
      `Xero OAuth persisted — workspace: ${stateEntry.workspaceId}, tenants: ${tenants
        .map((tenant) => `${tenant.tenantName} (${tenant.tenantId})`)
        .join(', ')}`,
    );

    return res
      .status(200)
      .send(
        '<html><body style="font-family:system-ui;padding:48px;text-align:center;">' +
          '<h1>Xero connected ✓</h1>' +
          `<p>${tenants.length} tenant(s) saved to workspace.</p>` +
          '<p><a href="/finance">Open Finance Dashboard</a></p>' +
          '</body></html>',
      );
  }
}
