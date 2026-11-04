package ai.toman.ingestion.storage;

import ai.toman.ingestion.config.IngestionProperties;
import ai.toman.ingestion.domain.StoredDocument;
import ai.toman.ingestion.service.DocumentFileType;
import ai.toman.ingestion.service.DocumentUploadValidator;
import ai.toman.ingestion.service.IngestionException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores binaries beneath a private root using generated UUID keys only. The
 * original filename never participates in filesystem path construction.
 */
@Component
public class SecureDocumentStorage {

    private static final int BUFFER_SIZE = 64 * 1024;

    private final IngestionProperties properties;
    private final DocumentUploadValidator validator;

    public SecureDocumentStorage(IngestionProperties properties, DocumentUploadValidator validator) {
        this.properties = properties;
        this.validator = validator;
    }

    public StoredFile store(
            MultipartFile upload,
            DocumentFileType type,
            UUID workspaceId,
            UUID ownerId) {
        Path temporary = null;
        try {
            Path root = privateRoot();
            temporary = Files.createTempFile(root, ".incoming-", ".part");
            CopyResult copied = copyWithHash(upload, temporary);
            validator.validateFileContent(temporary, type);

            UUID documentId = UUID.randomUUID();
            String relativeStoragePath = workspaceId + "/" + ownerId + "/" + documentId + type.extension();
            Path finalPath = resolvePrivatePath(relativeStoragePath);
            Files.createDirectories(finalPath.getParent());
            moveWithoutReplacement(temporary, finalPath);
            temporary = null;

            return new StoredFile(documentId, relativeStoragePath, copied.sizeBytes(), copied.sha256());
        } catch (IngestionException exception) {
            deleteQuietly(temporary);
            throw exception;
        } catch (IOException exception) {
            deleteQuietly(temporary);
            throw new IngestionException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DOCUMENT_STORAGE_FAILED",
                    "The document could not be stored safely.",
                    exception);
        }
    }

    public Resource open(StoredDocument document) {
        Path path = resolvePrivatePath(document.getStoragePath());
        if (!Files.isRegularFile(path)) {
            // This does not reveal whether the caller supplied a bad path or an
            // operator removed a binary; both remain an unavailable document.
            throw new IngestionException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND", "The document was not found.");
        }
        return new FileSystemResource(path);
    }

    public void deleteQuietly(StoredFile storedFile) {
        if (storedFile != null) {
            deleteQuietly(resolvePrivatePath(storedFile.storagePath()));
        }
    }

    private CopyResult copyWithHash(MultipartFile upload, Path destination) throws IOException {
        MessageDigest digest = sha256();
        long written = 0;
        try (InputStream input = upload.getInputStream();
                OutputStream output = Files.newOutputStream(destination, StandardOpenOption.WRITE)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = input.read(buffer)) != -1) {
                written += read;
                if (written > properties.maxUploadBytes()) {
                    throw new IngestionException(
                            HttpStatus.PAYLOAD_TOO_LARGE,
                            "DOCUMENT_TOO_LARGE",
                            "The document exceeds the configured upload size limit.");
                }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        }
        if (written == 0) {
            throw new IngestionException(HttpStatus.BAD_REQUEST, "EMPTY_DOCUMENT", "Choose a non-empty PDF, XLS, or XLSX document.");
        }
        return new CopyResult(written, HexFormat.of().formatHex(digest.digest()));
    }

    private Path privateRoot() throws IOException {
        Path root = Path.of(properties.storageRoot()).toAbsolutePath().normalize();
        Files.createDirectories(root);
        return root;
    }

    private Path resolvePrivatePath(String relativePath) {
        Path relative = Path.of(relativePath).normalize();
        if (relative.isAbsolute() || relative.startsWith("..")) {
            throw new IngestionException(HttpStatus.INTERNAL_SERVER_ERROR, "DOCUMENT_STORAGE_INVALID", "The document was not found.");
        }
        try {
            Path root = privateRoot();
            Path resolved = root.resolve(relative).normalize();
            if (!resolved.startsWith(root)) {
                throw new IngestionException(HttpStatus.INTERNAL_SERVER_ERROR, "DOCUMENT_STORAGE_INVALID", "The document was not found.");
            }
            return resolved;
        } catch (IOException exception) {
            throw new IngestionException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DOCUMENT_STORAGE_UNAVAILABLE",
                    "The document store is unavailable.",
                    exception);
        }
    }

    private void moveWithoutReplacement(Path source, Path destination) throws IOException {
        try {
            Files.move(source, destination, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, destination);
        }
    }

    private void deleteQuietly(Path file) {
        if (file == null) {
            return;
        }
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
            // A failed cleanup must not mask the client-safe validation error.
        }
    }

    private MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable in this JVM", exception);
        }
    }

    private record CopyResult(long sizeBytes, String sha256) {
    }
}
