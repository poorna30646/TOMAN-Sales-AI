CREATE TABLE user_accounts (
    id CHAR(36) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    status VARCHAR(32) NOT NULL,
    email_verified_at DATETIME(6) NULL,
    last_login_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pk_user_accounts PRIMARY KEY (id),
    CONSTRAINT uk_user_accounts_email UNIQUE (email),
    CONSTRAINT uk_user_accounts_mobile_number UNIQUE (mobile_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE email_verification_challenges (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    code_hash VARCHAR(100) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL,
    consumed_at DATETIME(6) NULL,
    invalidated_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT pk_email_verification_challenges PRIMARY KEY (id),
    CONSTRAINT fk_email_verification_challenges_user
        FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
    INDEX idx_email_verification_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refresh_sessions (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    family_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    issued_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    replaced_by_session_id CHAR(36) NULL,
    user_agent VARCHAR(512) NULL,
    ip_address VARCHAR(64) NULL,
    CONSTRAINT pk_refresh_sessions PRIMARY KEY (id),
    CONSTRAINT fk_refresh_sessions_user
        FOREIGN KEY (user_id) REFERENCES user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT uk_refresh_sessions_token_hash UNIQUE (token_hash),
    INDEX idx_refresh_sessions_user (user_id),
    INDEX idx_refresh_sessions_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
