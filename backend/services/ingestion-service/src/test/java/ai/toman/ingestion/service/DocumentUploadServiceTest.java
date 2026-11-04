package ai.toman.ingestion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ai.toman.ingestion.config.IngestionProperties;
import ai.toman.ingestion.repository.StoredDocumentRepository;
import ai.toman.ingestion.storage.SecureDocumentStorage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;

@ExtendWith(MockitoExtension.class)
class DocumentUploadServiceTest {

    @TempDir
    Path temporaryDirectory;

    @Mock
    StoredDocumentRepository documents;

    @Test
    void persistsOnlyAValidatedDocumentWithinTheRequestScope() {
        IngestionProperties properties = new IngestionProperties(temporaryDirectory.toString(), DataSize.ofMegabytes(1));
        DocumentUploadValidator validator = new DocumentUploadValidator(properties);
        SecureDocumentStorage storage = new SecureDocumentStorage(properties, validator);
        DocumentUploadService service = new DocumentUploadService(documents, validator, storage);
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        UUID ownerId = UUID.randomUUID();
        UUID workspaceId = UUID.randomUUID();

        var response = service.upload(
                new DocumentScope(ownerId, workspaceId),
                new MockMultipartFile(
                        "file", "leads.pdf", "application/pdf", "%PDF-1.7\nleads".getBytes(StandardCharsets.US_ASCII)));

        assertThat(response.filename()).isEqualTo("leads.pdf");
        assertThat(response.contentType()).isEqualTo("application/pdf");
        assertThat(response.status()).isEqualTo("UPLOADED");
        verify(documents).save(any());
    }

    @Test
    void doesNotRevealDocumentsOutsideOwnerWorkspaceScope() {
        IngestionProperties properties = new IngestionProperties(temporaryDirectory.toString(), DataSize.ofMegabytes(1));
        DocumentUploadValidator validator = new DocumentUploadValidator(properties);
        DocumentUploadService service = new DocumentUploadService(
                documents,
                validator,
                new SecureDocumentStorage(properties, validator));
        UUID documentId = UUID.randomUUID();
        DocumentScope scope = new DocumentScope(UUID.randomUUID(), UUID.randomUUID());
        when(documents.findByIdAndWorkspaceIdAndOwnerId(documentId, scope.workspaceId(), scope.ownerId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.details(documentId, scope))
                .isInstanceOf(IngestionException.class)
                .hasMessage("The document was not found.");
    }
}
