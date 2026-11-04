CREATE TABLE documents (
    id BINARY(16) NOT NULL,
    workspace_id BINARY(16) NOT NULL,
    owner_id BINARY(16) NOT NULL,
    original_filename VARCHAR(512) NOT NULL,
    content_type VARCHAR(160) NOT NULL,
    media_category VARCHAR(32) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    document_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_documents_workspace_created (workspace_id, created_at DESC),
    INDEX idx_documents_owner_created (owner_id, created_at DESC)
);
