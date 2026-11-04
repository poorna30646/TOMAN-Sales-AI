package ai.toman.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.sql.Types;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;

@Entity
@Table(name = "workspaces", indexes = @Index(name = "idx_workspaces_owner", columnList = "owner_id", unique = true))
public class Workspace {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    @JdbcTypeCode(Types.BINARY)
    private UUID id;

    @Column(name = "owner_id", nullable = false, updatable = false, columnDefinition = "BINARY(16)")
    @JdbcTypeCode(Types.BINARY)
    private UUID ownerId;

    @Column(name = "business_name", nullable = false, length = 160)
    private String businessName;

    @Column(name = "industry", length = 100)
    private String industry;

    @Column(name = "business_description", length = 5000)
    private String businessDescription;

    @Column(name = "timezone", nullable = false, length = 80)
    private String timezone;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected Workspace() {
    }

    private Workspace(UUID ownerId, String businessName, String industry, String businessDescription, String timezone) {
        this.ownerId = ownerId;
        this.businessName = businessName;
        this.industry = industry;
        this.businessDescription = businessDescription;
        this.timezone = timezone;
    }

    public static Workspace create(
            UUID ownerId,
            String businessName,
            String industry,
            String businessDescription,
            String timezone
    ) {
        return new Workspace(ownerId, businessName, industry, businessDescription, timezone);
    }

    public void updateProfile(String businessName, String industry, String businessDescription, String timezone) {
        this.businessName = businessName;
        this.industry = industry;
        this.businessDescription = businessDescription;
        this.timezone = timezone;
        this.updatedAt = Instant.now();
    }

    @jakarta.persistence.PrePersist
    void initializeTimestamps() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public String getBusinessName() { return businessName; }
    public String getIndustry() { return industry; }
    public String getBusinessDescription() { return businessDescription; }
    public String getTimezone() { return timezone; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
