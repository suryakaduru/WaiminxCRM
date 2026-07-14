import { type ObjectRecordEvent } from 'twenty-shared/database-events';

import { AuditService } from 'src/engine/core-modules/audit/services/audit.service';
import { AuditLogService } from 'src/engine/core-modules/audit-log/services/audit-log.service';
import { OBJECT_RECORD_CREATED_EVENT } from 'src/engine/core-modules/audit/utils/events/object-event/object-record-created';
import { OBJECT_RECORD_DELETED_EVENT } from 'src/engine/core-modules/audit/utils/events/object-event/object-record-delete';
import { OBJECT_RECORD_UPDATED_EVENT } from 'src/engine/core-modules/audit/utils/events/object-event/object-record-updated';
import { OBJECT_RECORD_UPSERTED_EVENT } from 'src/engine/core-modules/audit/utils/events/object-event/object-record-upserted';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

// Maps an internal event name suffix (e.g. "person.updated") to our audit action.
const actionFromEventName = (eventName: string): string => {
  if (eventName.endsWith('.updated')) return 'updated';
  if (eventName.endsWith('.created')) return 'created';
  if (eventName.endsWith('.deleted')) return 'deleted';
  if (eventName.endsWith('.upserted')) return 'upserted';
  if (eventName.endsWith('.restored')) return 'restored';
  if (eventName.endsWith('.destroyed')) return 'destroyed';

  return eventName;
};

// Best-effort human label for the affected record, pulled from the event diff.
const recordNameFromDiff = (diff: unknown): string | null => {
  if (!diff || typeof diff !== 'object') return null;

  const labelFields = ['name', 'title', 'displayName', 'label', 'subject'];

  for (const field of labelFields) {
    const entry = (diff as Record<string, unknown>)[field];

    if (entry && typeof entry === 'object' && 'after' in entry) {
      const after = (entry as { after?: unknown }).after;

      if (typeof after === 'string' && after.trim() !== '') return after;
      // Composite name fields store { firstName, lastName } etc.
      if (after && typeof after === 'object') {
        const parts = Object.values(after).filter(
          (v): v is string => typeof v === 'string' && v.trim() !== '',
        );

        if (parts.length > 0) return parts.join(' ');
      }
    }
  }

  return null;
};

@Processor(MessageQueue.entityEventsToDbQueue)
export class CreateAuditLogFromInternalEvent {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Process(CreateAuditLogFromInternalEvent.name)
  async handle(
    workspaceEventBatch: WorkspaceEventBatch<ObjectRecordEvent>,
  ): Promise<void> {
    for (const eventData of workspaceEventBatch.events) {
      // We remove "before" and "after" property for a cleaner/slimmer event payload
      const eventProperties =
        'diff' in eventData.properties
          ? {
              ...eventData.properties,
              diff: eventData.properties.diff,
            }
          : eventData.properties;

      // Postgres sink (Waimin audit trail). Independent of ClickHouse below —
      // this is the source of truth for the in-app activity log.
      const diff =
        'diff' in eventProperties
          ? (eventProperties.diff as Record<string, unknown> | undefined)
          : undefined;

      await this.auditLogService.record({
        workspaceId: workspaceEventBatch.workspaceId,
        userId: eventData.userId ?? null,
        action: actionFromEventName(workspaceEventBatch.name),
        objectName: workspaceEventBatch.objectMetadata.nameSingular,
        recordId: eventData.recordId,
        recordName: recordNameFromDiff(diff),
        diff: diff ?? null,
        context: eventData.workspaceMemberId
          ? { workspaceMemberId: eventData.workspaceMemberId }
          : null,
      });

      const auditService = this.auditService.createContext({
        workspaceId: workspaceEventBatch.workspaceId,
        userId: eventData.userId,
      });

      // Since these are object record events, we use createObjectEvent
      if (workspaceEventBatch.name.endsWith('.updated')) {
        await auditService.createObjectEvent(OBJECT_RECORD_UPDATED_EVENT, {
          ...eventProperties,
          recordId: eventData.recordId,
          objectMetadataId: workspaceEventBatch.objectMetadata.id,
        });
      } else if (workspaceEventBatch.name.endsWith('.created')) {
        await auditService.createObjectEvent(OBJECT_RECORD_CREATED_EVENT, {
          ...eventProperties,
          recordId: eventData.recordId,
          objectMetadataId: workspaceEventBatch.objectMetadata.id,
        });
      } else if (workspaceEventBatch.name.endsWith('.deleted')) {
        await auditService.createObjectEvent(OBJECT_RECORD_DELETED_EVENT, {
          ...eventProperties,
          recordId: eventData.recordId,
          objectMetadataId: workspaceEventBatch.objectMetadata.id,
        });
      } else if (workspaceEventBatch.name.endsWith('.upserted')) {
        await auditService.createObjectEvent(OBJECT_RECORD_UPSERTED_EVENT, {
          ...eventProperties,
          recordId: eventData.recordId,
          objectMetadataId: workspaceEventBatch.objectMetadata.id,
        });
      }
    }
  }
}
