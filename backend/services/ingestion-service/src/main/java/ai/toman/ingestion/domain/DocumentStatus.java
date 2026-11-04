package ai.toman.ingestion.domain;

/**
 * Only UPLOADED documents are downloadable or available to future extraction
 * workers. REJECTED and FAILED are reserved for future auditable intake flows;
 * no lead data is fabricated by this service.
 */
public enum DocumentStatus {
    UPLOADED,
    REJECTED,
    FAILED
}
