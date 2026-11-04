package com.toman.auth.notification;

import com.toman.auth.service.VerificationEmailMessage;
import com.toman.auth.service.VerificationEmailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Development adapter: it does not send customer email. The code is surfaced only by the local
 * API response when the local profile enables it, keeping provider credentials out of this service.
 */
@Component
@Profile({"local", "test"})
@ConditionalOnProperty(prefix = "auth.mail", name = "enabled", havingValue = "false", matchIfMissing = true)
public class LocalVerificationEmailSender implements VerificationEmailSender {

    private static final Logger log = LoggerFactory.getLogger(LocalVerificationEmailSender.class);

    @Override
    public void send(VerificationEmailMessage message) {
        log.info("Email verification challenge created for {} and expires at {}.",
                message.recipientEmail(), message.expiresAt());
    }
}
