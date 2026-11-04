CREATE TABLE agent_tasks (
    id BINARY(16) NOT NULL,
    workspace_id BINARY(16) NOT NULL,
    owner_id BINARY(16) NOT NULL,
    title VARCHAR(180) NOT NULL,
    prompt TEXT NOT NULL,
    task_status VARCHAR(48) NOT NULL,
    model_id VARCHAR(100) NULL,
    plan_json JSON NULL,
    failure_code VARCHAR(100) NULL,
    failure_detail VARCHAR(1000) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_agent_tasks_workspace_created (workspace_id, created_at DESC),
    INDEX idx_agent_tasks_owner_created (owner_id, created_at DESC)
);
