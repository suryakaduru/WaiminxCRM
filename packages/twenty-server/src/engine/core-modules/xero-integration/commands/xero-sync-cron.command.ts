import { Command, CommandRunner } from 'nest-commander';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  XERO_SYNC_CRON_PATTERN,
  XeroSyncCronJob,
} from 'src/engine/core-modules/xero-integration/jobs/xero-sync-cron.job';

@Command({
  name: 'cron:xero:sync',
  description: 'Registers the recurring Xero cache sync job',
})
export class XeroSyncCronCommand extends CommandRunner {
  constructor(
    @InjectMessageQueue(MessageQueue.cronQueue)
    private readonly cronQueue: MessageQueueService,
  ) {
    super();
  }

  async run(): Promise<void> {
    await this.cronQueue.addCron<undefined>({
      jobName: XeroSyncCronJob.name,
      data: undefined,
      options: {
        repeat: { pattern: XERO_SYNC_CRON_PATTERN },
      },
    });
  }
}
