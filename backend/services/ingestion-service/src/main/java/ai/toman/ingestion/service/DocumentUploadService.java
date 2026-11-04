package ai.toman.ingestion.service;

import ai.toman.ingestion.api.DocumentResponse;
import ai.toman.ingestion.domain.StoredDocument;
import ai.toman.ingestion.repository.StoredDocumentRepository;
import ai.toman.ingestion.storage.SecureDocumentStorage;
import ai.toman.ingestion.storage.StoredFile;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentUploadService {

    private final StoredDocumentRepository documents;
    private final DocumentUploadValidator validator;
    private final SecureDocumentStorage storage;

    public DocumentUploadService(
            StoredDocumentRepository documents,
            DocumentUploadValidator validator,
            SecureDocumentStorage storage) {
        this.documents = documents;
        this.validator = validator;
        this.storage = storage;
    }

    @Transactional
    public DocumentResponse upload(DocumentScope scope, MultipartFile upload) {
        DocumentFileType type = validator.validateMetadata(upload);
        StoredFile stored = storage.store(upload, type, scope.workspaceId(), scope.ownerId());
        try {
            StoredDocument document = StoredDocument.uploaded(
                    stored.documentId(),
                    scope.workspaceId(),
                    scope.ownerId(),
                    safeFilename(upload.getOriginalFilename()),
                    type.canonicalContentType(),
                    type.category(),
                    stored.sizeBytes(),
                    stored.sha256(),
                    stored.storagePath());
            StoredDocument saved = documents.save(document);
            deleteBinaryIfTransactionRollsBack(stored);
            return DocumentResponse.from(saved);
        } catch (RuntimeException exception) {
            storage.deleteQuietly(stored);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(DocumentScope scope) {
        return documents.findByWorkspaceIdAndOwnerIdOrderByCreatedAtDesc(scope.workspaceId(), scope.ownerId())
                .stream()
                .map(DocumentResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponse details(UUID documentId, DocumentScope scope) {
        return DocumentResponse.from(findScoped(documentId, scope));
    }

    @Transactional(readOnly = true)
    public DocumentDownload download(UUID documentId, DocumentScope scope) {
        StoredDocument document = findScoped(documentId, scope);
        Resource resource = storage.open(document);
        return new DocumentDownload(document, resource);
    }

    private StoredDocument findScoped(UUID documentId, DocumentScope scope) {
        return documents.findByIdAndWorkspaceIdAndOwnerId(documentId, scope.workspaceId(), scope.ownerId())
                .orElseThrow(() -> new IngestionException(
                        HttpStatus.NOT_FOUND,
                        "DOCUMENT_NOT_FOUND",
                        "The document was not found."));
    }

    private void deleteBinaryIfTransactionRollsBack(StoredFile stored) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != TransactionSynchronization.STATUS_COMMITTED) {
                    storage.deleteQuietly(stored);
                }
            }
        });
    }

    private String safeFilename(String filename) {
        // Metadata validation already rejected path separators/control characters.
        // Keep this defensive guard close to persistence as well.
        if (filename == null) {
            throw new IngestionException(HttpStatus.BAD_REQUEST, "INVALID_FILENAME", "The document filename is invalid.");
        }
        return filename.trim();
    }
}
