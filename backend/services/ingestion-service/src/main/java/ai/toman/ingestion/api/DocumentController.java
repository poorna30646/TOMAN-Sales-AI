package ai.toman.ingestion.api;

import ai.toman.ingestion.service.DocumentDownload;
import ai.toman.ingestion.service.DocumentScope;
import ai.toman.ingestion.service.DocumentUploadService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * The API gateway validates the access token and injects owner/workspace
 * headers. This service never accepts those scopes from an untrusted body.
 */
@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentUploadService documents;

    public DocumentController(DocumentUploadService documents) {
        this.documents = documents;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse upload(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId,
            @RequestPart("file") MultipartFile file) {
        return documents.upload(new DocumentScope(ownerId, workspaceId), file);
    }

    @GetMapping
    public List<DocumentResponse> list(
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId) {
        return documents.list(new DocumentScope(ownerId, workspaceId));
    }

    @GetMapping("/{documentId}")
    public DocumentResponse details(
            @PathVariable UUID documentId,
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId) {
        return documents.details(documentId, new DocumentScope(ownerId, workspaceId));
    }

    @GetMapping("/{documentId}/download")
    public ResponseEntity<Resource> download(
            @PathVariable UUID documentId,
            @RequestHeader("X-TOMAN-User-Id") UUID ownerId,
            @RequestHeader("X-TOMAN-Workspace-Id") UUID workspaceId) {
        DocumentDownload download = documents.download(documentId, new DocumentScope(ownerId, workspaceId));
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.document().getOriginalFilename(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.document().getContentType()))
                .contentLength(download.document().getFileSizeBytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(download.resource());
    }
}
