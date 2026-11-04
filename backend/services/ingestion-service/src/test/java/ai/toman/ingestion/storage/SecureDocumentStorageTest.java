package ai.toman.ingestion.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.toman.ingestion.config.IngestionProperties;
import ai.toman.ingestion.service.DocumentFileType;
import ai.toman.ingestion.service.DocumentUploadValidator;
import ai.toman.ingestion.service.IngestionException;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.mock.web.MockMultipartFile;

class SecureDocumentStorageTest {

    @TempDir
    Path temporaryDirectory;

    @Test
    void storesValidatedPdfUnderGeneratedPrivateKey() throws Exception {
        IngestionProperties properties = new IngestionProperties(temporaryDirectory.toString(), DataSize.ofMegabytes(1));
        DocumentUploadValidator validator = new DocumentUploadValidator(properties);
        SecureDocumentStorage storage = new SecureDocumentStorage(properties, validator);
        MultipartFile upload = new MockMultipartFile(
                "file", "client-leads.pdf", "application/pdf", "%PDF-1.7\nexample".getBytes(StandardCharsets.US_ASCII));

        StoredFile stored = storage.store(
                upload,
                validator.validateMetadata(upload),
                UUID.randomUUID(),
                UUID.randomUUID());

        assertThat(stored.storagePath()).doesNotContain("client-leads.pdf");
        assertThat(stored.storagePath()).endsWith(".pdf");
        assertThat(stored.sha256()).hasSize(64);
        assertThat(Files.exists(temporaryDirectory.resolve(stored.storagePath()))).isTrue();
    }

    @Test
    void rejectsFilenameOnlyPdfAndCleansTemporaryBinary() throws Exception {
        IngestionProperties properties = new IngestionProperties(temporaryDirectory.toString(), DataSize.ofMegabytes(1));
        DocumentUploadValidator validator = new DocumentUploadValidator(properties);
        SecureDocumentStorage storage = new SecureDocumentStorage(properties, validator);
        MultipartFile upload = new MockMultipartFile(
                "file", "not-really-a-pdf.pdf", "application/pdf", "not a PDF".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> storage.store(
                        upload,
                        validator.validateMetadata(upload),
                        UUID.randomUUID(),
                        UUID.randomUUID()))
                .isInstanceOf(IngestionException.class)
                .hasMessageContaining("contents do not match");

        try (var paths = Files.walk(temporaryDirectory)) {
            assertThat(paths.map(Path::getFileName)
                    .filter(name -> name != null && name.toString().startsWith(".incoming-")))
                    .isEmpty();
        }
    }

    @Test
    void acceptsMinimalXlsxPackageOnlyWhenWorkbookEntriesExist() throws Exception {
        IngestionProperties properties = new IngestionProperties(temporaryDirectory.toString(), DataSize.ofMegabytes(1));
        DocumentUploadValidator validator = new DocumentUploadValidator(properties);
        SecureDocumentStorage storage = new SecureDocumentStorage(properties, validator);
        MultipartFile upload = new MockMultipartFile(
                "file",
                "prospects.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                minimalXlsx());

        StoredFile stored = storage.store(
                upload,
                DocumentFileType.XLSX,
                UUID.randomUUID(),
                UUID.randomUUID());

        assertThat(Files.exists(temporaryDirectory.resolve(stored.storagePath()))).isTrue();
    }

    private byte[] minimalXlsx() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zip.write("<Types/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            zip.putNextEntry(new ZipEntry("xl/workbook.xml"));
            zip.write("<workbook/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }
}
