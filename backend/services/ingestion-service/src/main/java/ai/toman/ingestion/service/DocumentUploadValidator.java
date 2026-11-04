package ai.toman.ingestion.service;

import ai.toman.ingestion.config.IngestionProperties;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates both the submitted metadata and the actual on-disk signature. A
 * filename or mobile-provided MIME type alone is never trusted.
 */
@Component
public class DocumentUploadValidator {

    private static final Set<String> GENERIC_CONTENT_TYPES = Set.of("", "application/octet-stream", "binary/octet-stream");
    private static final int ZIP_ENTRY_LIMIT = 10_000;

    private final IngestionProperties properties;

    public DocumentUploadValidator(IngestionProperties properties) {
        this.properties = properties;
    }

    public DocumentFileType validateMetadata(MultipartFile upload) {
        if (upload == null || upload.isEmpty() || upload.getSize() <= 0) {
            throw new IngestionException(HttpStatus.BAD_REQUEST, "EMPTY_DOCUMENT", "Choose a non-empty PDF, XLS, or XLSX document.");
        }
        if (upload.getSize() > properties.maxUploadBytes()) {
            throw new IngestionException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "DOCUMENT_TOO_LARGE",
                    "The document exceeds the configured upload size limit.");
        }

        String filename = upload.getOriginalFilename();
        if (filename == null || filename.isBlank() || filename.length() > 255
                || filename.indexOf('/') >= 0 || filename.indexOf('\\') >= 0
                || filename.chars().anyMatch(Character::isISOControl)) {
            throw new IngestionException(HttpStatus.BAD_REQUEST, "INVALID_FILENAME", "The document filename is invalid.");
        }

        String lowerFilename = filename.toLowerCase(Locale.ROOT);
        DocumentFileType type = typeForFilename(lowerFilename);
        validateDeclaredContentType(upload.getContentType(), type);
        return type;
    }

    public void validateFileContent(Path file, DocumentFileType type) {
        try {
            boolean valid = switch (type) {
                case PDF -> startsWith(file, new byte[] {'%', 'P', 'D', 'F', '-'});
                case XLS -> startsWith(file, new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
                        (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1});
                case XLSX -> isXlsxPackage(file);
            };
            if (!valid) {
                throw new IngestionException(
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "DOCUMENT_CONTENT_MISMATCH",
                        "The file contents do not match the selected PDF, XLS, or XLSX format.");
            }
        } catch (IngestionException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new IngestionException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "DOCUMENT_VALIDATION_FAILED",
                    "The document could not be safely validated.",
                    exception);
        }
    }

    private DocumentFileType typeForFilename(String lowerFilename) {
        for (DocumentFileType candidate : DocumentFileType.values()) {
            if (lowerFilename.endsWith(candidate.extension())) {
                return candidate;
            }
        }
        throw new IngestionException(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_DOCUMENT_TYPE",
                "Only PDF, XLS, and XLSX documents are supported.");
    }

    private void validateDeclaredContentType(String declaredContentType, DocumentFileType type) {
        if (declaredContentType == null) {
            return;
        }
        String normalized = declaredContentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if (GENERIC_CONTENT_TYPES.contains(normalized)) {
            return;
        }

        boolean accepted = switch (type) {
            case PDF -> normalized.equals("application/pdf");
            case XLS -> normalized.equals("application/vnd.ms-excel") || normalized.equals("application/x-msexcel");
            case XLSX -> normalized.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        };
        if (!accepted) {
            throw new IngestionException(
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "DOCUMENT_CONTENT_TYPE_MISMATCH",
                    "The file type does not match its filename extension.");
        }
    }

    private boolean startsWith(Path file, byte[] expected) throws IOException {
        byte[] actual = new byte[expected.length];
        try (InputStream input = Files.newInputStream(file)) {
            int offset = 0;
            while (offset < actual.length) {
                int read = input.read(actual, offset, actual.length - offset);
                if (read < 0) {
                    return false;
                }
                offset += read;
            }
        }
        for (int index = 0; index < expected.length; index++) {
            if (actual[index] != expected[index]) {
                return false;
            }
        }
        return true;
    }

    private boolean isXlsxPackage(Path file) throws IOException {
        boolean hasContentTypes = false;
        boolean hasWorkbook = false;
        int entries = 0;
        try (InputStream input = Files.newInputStream(file); ZipInputStream zip = new ZipInputStream(input)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > ZIP_ENTRY_LIMIT) {
                    return false;
                }
                String name = entry.getName();
                if ("[Content_Types].xml".equals(name)) {
                    hasContentTypes = true;
                } else if ("xl/workbook.xml".equals(name)) {
                    hasWorkbook = true;
                }
                zip.closeEntry();
            }
        }
        return hasContentTypes && hasWorkbook;
    }
}
