import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
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

  @Get('debug/invoices')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async debugInvoices(
    @Query('workspaceId') workspaceId: string | undefined,
    @Query('tenantId') tenantId: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('Missing workspaceId query parameter');
    }

    const connections = await this.xeroConnectionService.listByWorkspace(
      workspaceId,
    );
    const connection = tenantId
      ? connections.find((row) => row.tenantId === tenantId)
      : connections[0];

    if (!connection) {
      throw new NotFoundException(
        `No Xero connection for workspace ${workspaceId}`,
      );
    }

    const accessToken = await this.xeroConnectionService.getValidAccessToken(
      connection,
    );
    const safeLimit = Math.min(Number(limit ?? '10') || 10, 100);

    const response = await fetch(
      `https://api.xero.com/api.xro/2.0/Invoices?page=1&pageSize=${safeLimit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Xero-Tenant-Id': connection.tenantId,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();

      this.logger.warn(`Xero invoices fetch failed: ${response.status} ${text}`);
      throw new BadRequestException(
        `Xero API returned ${response.status}: ${text}`,
      );
    }

    const data = (await response.json()) as {
      Invoices?: Array<Record<string, unknown>>;
    };

    return {
      tenantId: connection.tenantId,
      tenantName: connection.tenantName,
      count: data.Invoices?.length ?? 0,
      invoices: (data.Invoices ?? []).map((invoice) => ({
        invoiceID: invoice.InvoiceID,
        invoiceNumber: invoice.InvoiceNumber,
        type: invoice.Type,
        status: invoice.Status,
        date: invoice.DateString ?? invoice.Date,
        dueDate: invoice.DueDateString ?? invoice.DueDate,
        contactName: (invoice.Contact as { Name?: string } | undefined)?.Name,
        total: invoice.Total,
        amountDue: invoice.AmountDue,
        amountPaid: invoice.AmountPaid,
        currencyCode: invoice.CurrencyCode,
      })),
    };
  }

  @Get('status')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async status(@Query('workspaceId') workspaceId: string | undefined) {
    if (!workspaceId) {
      throw new BadRequestException('Missing workspaceId query parameter');
    }

    const connections = await this.xeroConnectionService.listByWorkspace(
      workspaceId,
    );

    return {
      enabled: this.xeroOAuthService.isEnabled(),
      connections: connections.map((connection) => ({
        tenantId: connection.tenantId,
        tenantName: connection.tenantName,
        tenantType: connection.tenantType,
        scopes: connection.scopes,
        accessTokenExpiresAt: connection.accessTokenExpiresAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      })),
    };
  }

  @Delete('connections/:tenantId')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async disconnect(
    @Param('tenantId') tenantId: string,
    @Query('workspaceId') workspaceId: string | undefined,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('Missing workspaceId query parameter');
    }

    await this.xeroConnectionService.deleteByWorkspaceAndTenant(
      workspaceId,
      tenantId,
    );

    return { ok: true };
  }

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
