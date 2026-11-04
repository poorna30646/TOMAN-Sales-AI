package com.toman.auth.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "auth")
public class AuthProperties {

    @Valid
    @NotNull
    private Jwt jwt = new Jwt();

    @Valid
    @NotNull
    private Refresh refresh = new Refresh();

    @Valid
    @NotNull
    private Verification verification = new Verification();

    @Valid
    @NotNull
    private Mail mail = new Mail();

    @NotBlank
    private String issuer = "toman-auth-service";

    private List<String> allowedOrigins = new ArrayList<>();

    public Jwt getJwt() {
        return jwt;
    }

    public void setJwt(Jwt jwt) {
        this.jwt = jwt;
    }

    public Refresh getRefresh() {
        return refresh;
    }

    public void setRefresh(Refresh refresh) {
        this.refresh = refresh;
    }

    public Verification getVerification() {
        return verification;
    }

    public void setVerification(Verification verification) {
        this.verification = verification;
    }

    public Mail getMail() {
        return mail;
    }

    public void setMail(Mail mail) {
        this.mail = mail;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins == null ? new ArrayList<>() : new ArrayList<>(allowedOrigins);
    }

    public static class Jwt {
        /** A Base64-encoded random key with at least 256 bits. */
        @NotBlank
        private String signingKeyBase64;

        @NotNull
        private Duration accessTokenTtl = Duration.ofMinutes(15);

        public String getSigningKeyBase64() {
            return signingKeyBase64;
        }

        public void setSigningKeyBase64(String signingKeyBase64) {
            this.signingKeyBase64 = signingKeyBase64;
        }

        public Duration getAccessTokenTtl() {
            return accessTokenTtl;
        }

        public void setAccessTokenTtl(Duration accessTokenTtl) {
            this.accessTokenTtl = accessTokenTtl;
        }
    }

    public static class Refresh {
        @NotNull
        private Duration tokenTtl = Duration.ofDays(30);

        public Duration getTokenTtl() {
            return tokenTtl;
        }

        public void setTokenTtl(Duration tokenTtl) {
            this.tokenTtl = tokenTtl;
        }
    }

    public static class Verification {
        @NotNull
        private Duration codeTtl = Duration.ofMinutes(10);

        @Min(3)
        @Max(10)
        private int codeLength = 6;

        @Min(1)
        @Max(10)
        private int maxAttempts = 5;

        /** Never enable this outside local development. */
        private boolean exposeCode = false;

        public Duration getCodeTtl() {
            return codeTtl;
        }

        public void setCodeTtl(Duration codeTtl) {
            this.codeTtl = codeTtl;
        }

        public int getCodeLength() {
            return codeLength;
        }

        public void setCodeLength(int codeLength) {
            this.codeLength = codeLength;
        }

        public int getMaxAttempts() {
            return maxAttempts;
        }

        public void setMaxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
        }

        public boolean isExposeCode() {
            return exposeCode;
        }

        public void setExposeCode(boolean exposeCode) {
            this.exposeCode = exposeCode;
        }
    }

    public static class Mail {
        private boolean enabled;
        private String from = "";
        private String fromName = "TOMAN Sales AI";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getFrom() {
            return from;
        }

        public void setFrom(String from) {
            this.from = from;
        }

        public String getFromName() {
            return fromName;
        }

        public void setFromName(String fromName) {
            this.fromName = fromName;
        }
    }
}
