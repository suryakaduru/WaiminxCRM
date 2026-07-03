import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import { type XeroSyncEntityType } from 'src/engine/core-modules/xero-integration/entities/xero-sync-cursor.entity';
import { XeroSyncService } from 'src/engine/core-modules/xero-integration/services/xero-sync.service';

export type XeroSyncJobData = {
  workspaceId: string;
  tenantId: string;
  entities?: XeroSyncEntityType[];
};

@Processor(MessageQueue.xeroSyncQueue)
export class XeroSyncJob {
  private readonly logger = new Logger(XeroSyncJob.name);

  constructor(
    @InjectRepository(XeroConnectionEntity)
    private readonly xeroConnectionRepository: Repository<XeroConnectionEntity>,
    private readonly xeroSyncService: XeroSyncService,
  ) {}

  @Process(XeroSyncJob.name)
  async handle(data: XeroSyncJobData): Promise<void> {
    const connection = await this.xeroConnectionRepository.findOne({
      where: { workspaceId: data.workspaceId, tenantId: data.tenantId },
    });

    if (!connection) {
      this.logger.warn(
        `XeroSyncJob: no connection for workspace ${data.workspaceId} tenant ${data.tenantId}`,
      );

      return;
    }

    await this.xeroSyncService.syncConnection(connection, data.entities);
  }
}
