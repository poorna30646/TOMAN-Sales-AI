CREATE TABLE workspaces (
    id BINARY(16) NOT NULL,
    owner_id BINARY(16) NOT NULL,
    business_name VARCHAR(160) NOT NULL,
    industry VARCHAR(100) NULL,
    business_description VARCHAR(5000) NULL,
    timezone VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pk_workspaces PRIMARY KEY (id),
    CONSTRAINT uk_workspaces_owner UNIQUE (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE workspace_settings (
    workspace_id BINARY(16) NOT NULL,
    review_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    permission_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    completed_task_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    new_lead_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_workspace_settings PRIMARY KEY (workspace_id),
    CONSTRAINT fk_workspace_settings_workspace
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
