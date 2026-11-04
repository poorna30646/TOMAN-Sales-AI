CREATE TABLE review_notification_outbox (
    id BINARY(16) NOT NULL,
    task_id BINARY(16) NOT NULL,
    workspace_id BINARY(16) NOT NULL,
    owner_id BINARY(16) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message VARCHAR(1500) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP(6) NULL,
    last_error VARCHAR(1000) NULL,
    delivered_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT pk_review_notification_outbox PRIMARY KEY (id),
    CONSTRAINT uk_review_notification_outbox_task UNIQUE (task_id),
    INDEX idx_review_notification_outbox_pending (delivered_at, created_at)
);
