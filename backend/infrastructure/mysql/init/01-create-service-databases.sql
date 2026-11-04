-- Local-only bootstrap. Every service owns its schema/database and migrations.
-- Do not reuse these development credentials in a deployed environment.
CREATE DATABASE IF NOT EXISTS toman_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_workspace CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_ingestion CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_jarvis CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_notification CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_workflow CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS toman_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON toman_auth.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_workspace.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_ingestion.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_jarvis.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_notification.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_workflow.* TO 'toman_app'@'%';
GRANT ALL PRIVILEGES ON toman_integration.* TO 'toman_app'@'%';
FLUSH PRIVILEGES;
