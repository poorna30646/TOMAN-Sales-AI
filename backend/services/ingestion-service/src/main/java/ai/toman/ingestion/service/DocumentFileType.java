package ai.toman.ingestion.service;

import ai.toman.ingestion.domain.DocumentMediaCategory;

/** Accepted, canonical document formats. The canonical MIME type is stored. */
public enum DocumentFileType {
    PDF(DocumentMediaCategory.PDF, ".pdf", "application/pdf"),
    XLS(DocumentMediaCategory.SPREADSHEET, ".xls", "application/vnd.ms-excel"),
    XLSX(
            DocumentMediaCategory.SPREADSHEET,
            ".xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final DocumentMediaCategory category;
    private final String extension;
    private final String canonicalContentType;

    DocumentFileType(DocumentMediaCategory category, String extension, String canonicalContentType) {
        this.category = category;
        this.extension = extension;
        this.canonicalContentType = canonicalContentType;
    }

    public DocumentMediaCategory category() {
        return category;
    }

    public String extension() {
        return extension;
    }

    public String canonicalContentType() {
        return canonicalContentType;
    }
}
