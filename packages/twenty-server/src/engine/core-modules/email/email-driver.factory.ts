import { Injectable } from '@nestjs/common';

import { type EmailDriverInterface } from 'src/engine/core-modules/email/drivers/interfaces/email-driver.interface';

import { LoggerDriver } from 'src/engine/core-modules/email/drivers/logger.driver';
import { MicrosoftGraphDriver } from 'src/engine/core-modules/email/drivers/microsoft-graph.driver';
import { SmtpDriver } from 'src/engine/core-modules/email/drivers/smtp.driver';
import { EmailDriver } from 'src/engine/core-modules/email/enums/email-driver.enum';
import { DriverFactoryBase } from 'src/engine/core-modules/twenty-config/dynamic-factory.base';
import { ConfigVariablesGroup } from 'src/engine/core-modules/twenty-config/enums/config-variables-group.enum';
import { ConfigGroupHashService } from 'src/engine/core-modules/twenty-config/services/config-group-hash.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class EmailDriverFactory extends DriverFactoryBase<EmailDriverInterface> {
  constructor(
    twentyConfigService: TwentyConfigService,
    configGroupHashService: ConfigGroupHashService,
  ) {
    super(twentyConfigService, configGroupHashService);
  }

  protected buildConfigKey(): string {
    const driver = this.twentyConfigService.get('EMAIL_DRIVER');

    if (driver === EmailDriver.LOGGER) {
      return 'logger';
    }

    if (
      driver === EmailDriver.SMTP ||
      driver === EmailDriver.MICROSOFT_GRAPH
    ) {
      const emailConfigHash = this.configGroupHashService.computeHash(
        ConfigVariablesGroup.EMAIL_SETTINGS,
      );

      return `${driver.toLowerCase()}|${emailConfigHash}`;
    }

    throw new Error(`Unsupported email driver: ${driver}`);
  }

  protected createDriver(): EmailDriverInterface {
    const driver = this.twentyConfigService.get('EMAIL_DRIVER');

    switch (driver) {
      case EmailDriver.LOGGER:
        return new LoggerDriver();

      case EmailDriver.SMTP: {
        const host = this.twentyConfigService.get('EMAIL_SMTP_HOST');
        const port = this.twentyConfigService.get('EMAIL_SMTP_PORT');
        const user = this.twentyConfigService.get('EMAIL_SMTP_USER');
        const pass = this.twentyConfigService.get('EMAIL_SMTP_PASSWORD');
        const noTLS = this.twentyConfigService.get('EMAIL_SMTP_NO_TLS');

        if (!host || !port) {
          throw new Error('SMTP driver requires host and port to be defined');
        }

        const options: {
          host: string;
          port: number;
          auth?: { user: string; pass: string };
          secure?: boolean;
          ignoreTLS?: boolean;
          requireTLS?: boolean;
        } = { host, port };

        if (user && pass) {
          options.auth = { user, pass };
        }

        if (noTLS) {
          options.secure = false;
          options.ignoreTLS = true;
        }

        return new SmtpDriver(options);
      }

      case EmailDriver.MICROSOFT_GRAPH: {
        const tenantId = this.twentyConfigService.get('EMAIL_GRAPH_TENANT_ID');
        const clientId = this.twentyConfigService.get('EMAIL_GRAPH_CLIENT_ID');
        const clientSecret = this.twentyConfigService.get(
          'EMAIL_GRAPH_CLIENT_SECRET',
        );
        const sender = this.twentyConfigService.get('EMAIL_FROM_ADDRESS');
        const senderName = this.twentyConfigService.get('EMAIL_FROM_NAME');

        if (!tenantId || !clientId || !clientSecret) {
          throw new Error(
            'MICROSOFT_GRAPH driver requires EMAIL_GRAPH_TENANT_ID, EMAIL_GRAPH_CLIENT_ID and EMAIL_GRAPH_CLIENT_SECRET',
          );
        }

        return new MicrosoftGraphDriver({
          tenantId,
          clientId,
          clientSecret,
          sender,
          senderName,
        });
      }

      default:
        throw new Error(`Invalid email driver: ${driver}`);
    }
  }
}
