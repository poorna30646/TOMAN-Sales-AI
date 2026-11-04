package ai.toman.ingestion.service;

import ai.toman.ingestion.domain.StoredDocument;
import org.springframework.core.io.Resource;

public record DocumentDownload(StoredDocument document, Resource resource) {
}
