CREATE TABLE owner_notifications (
    id BINARY(16) NOT NULL,
    workspace_id BINARY(16) NOT NULL,
    owner_id BINARY(16) NOT NULL,
    event_type VARCHAR(48) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message VARCHAR(1500) NOT NULL,
    reference_type VARCHAR(80) NULL,
    reference_id BINARY(16) NULL,
    read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_owner_notifications_feed (workspace_id, owner_id, created_at DESC),
    INDEX idx_owner_notifications_unread (workspace_id, owner_id, read_at, created_at DESC)
);
