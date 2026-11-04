package ai.toman.contracts;

import java.time.Instant;
import java.util.UUID;

/**
 * Generic envelope for an event emitted by a service outbox. Domain payloads
 * stay in their owning service; this type exists only to standardize metadata.
 */
public record EventEnvelope<T>(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String aggregateType,
        String aggregateId,
        UUID workspaceId,
        String correlationId,
        T payload
) {
}
