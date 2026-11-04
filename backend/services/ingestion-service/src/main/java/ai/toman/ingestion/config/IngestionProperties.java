package ai.toman.ingestion.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import org.springframework.util.unit.DataSize;

/**
 * The configured directory is a private filesystem boundary, never a public
 * static-resource directory. Configure an absolute mounted volume in deployed
 * environments; the local default is deliberately outside src/main/resources.
 */
@Validated
@ConfigurationProperties(prefix = "toman.ingestion")
public record IngestionProperties(
        @NotBlank String storageRoot,
        @NotNull DataSize maxUploadSize) {

    public long maxUploadBytes() {
        return maxUploadSize.toBytes();
    }
}
