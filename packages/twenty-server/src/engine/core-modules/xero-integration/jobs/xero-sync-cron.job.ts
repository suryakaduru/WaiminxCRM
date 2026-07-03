import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { XeroConnectionEntity } from 'src/engine/core-modules/xero-integration/entities/xero-connection.entity';
import {
  XeroSyncJob,
  type XeroSyncJobData,
} from 'src/engine/core-modules/xero-integration/jobs/xero-sync.job';

export const XERO_SYNC_CRON_PATTERN = '*/15 * * * *';

@Processor(MessageQueue.cronQueue)
export class XeroSyncCronJob {
  private readonly logger = new Logger(XeroSyncCronJob.name);

  constructor(
    @InjectRepository(XeroConnectionEntity)
    private readonly xeroConnectionRepository: Repository<XeroConnectionEntity>,
    @InjectMessageQueue(MessageQueue.xeroSyncQueue)
    private readonly xeroSyncQueue: MessageQueueService,
  ) {}

  @Process(XeroSyncCronJob.name)
  async handle(): Promise<void> {
    const connections = await this.xeroConnectionRepository.find({
      select: ['workspaceId', 'tenantId'],
    });

    this.logger.log(
      `XeroSyncCronJob: enqueuing sync for ${connections.length} connections`,
    );

    for (const connection of connections) {
      await this.xeroSyncQueue.add<XeroSyncJobData>(
        XeroSyncJob.name,
        {
          workspaceId: connection.workspaceId,
          tenantId: connection.tenantId,
        },
        { retryLimit: 2 },
      );
    }
  }
}
