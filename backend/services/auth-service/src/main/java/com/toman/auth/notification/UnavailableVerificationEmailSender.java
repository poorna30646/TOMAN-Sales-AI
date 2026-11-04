package com.toman.auth.notification;

import com.toman.auth.service.VerificationEmailMessage;
import com.toman.auth.service.VerificationEmailSender;
import com.toman.auth.service.AuthDomainException;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Production intentionally fails closed until a real provider adapter is configured. It prevents
 * the application from pretending an account is reachable when no mail channel exists.
 */
@Component
@Profile("!local & !test")
@ConditionalOnProperty(prefix = "auth.mail", name = "enabled", havingValue = "false", matchIfMissing = true)
public class UnavailableVerificationEmailSender implements VerificationEmailSender {

    @Override
    public void send(VerificationEmailMessage message) {
        throw AuthDomainException.badRequest(
                "EMAIL_DELIVERY_UNAVAILABLE",
                "Email verification delivery is not configured for this environment."
        );
    }
}
