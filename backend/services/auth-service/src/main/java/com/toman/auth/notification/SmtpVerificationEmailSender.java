package com.toman.auth.notification;

import com.toman.auth.config.AuthProperties;
import com.toman.auth.service.AuthDomainException;
import com.toman.auth.service.VerificationEmailMessage;
import com.toman.auth.service.VerificationEmailSender;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** Delivers verification codes through the SMTP provider configured in server environment variables. */
@Component
@ConditionalOnProperty(prefix = "auth.mail", name = "enabled", havingValue = "true")
public class SmtpVerificationEmailSender implements VerificationEmailSender {

    private static final Logger logger = LoggerFactory.getLogger(SmtpVerificationEmailSender.class);

    private static final DateTimeFormatter EXPIRY_FORMAT = DateTimeFormatter
            .ofPattern("uuuu-MM-dd HH:mm 'UTC'")
            .withZone(ZoneOffset.UTC);

    private final JavaMailSender mailSender;
    private final AuthProperties.Mail properties;

    public SmtpVerificationEmailSender(JavaMailSender mailSender, AuthProperties authProperties) {
        this.mailSender = mailSender;
        this.properties = authProperties.getMail();
        if (!StringUtils.hasText(properties.getFrom())) {
            throw new IllegalStateException("SMTP_FROM is required when SMTP_ENABLED=true.");
        }
    }

    @Override
    public void send(VerificationEmailMessage message) {
        SimpleMailMessage email = new SimpleMailMessage();
        email.setFrom(properties.getFrom());
        email.setTo(message.recipientEmail());
        email.setSubject("Your TOMAN verification code");
        email.setText("Your TOMAN verification code is: " + message.code()
                + "\n\nThis code expires at " + EXPIRY_FORMAT.format(message.expiresAt()) + "."
                + "\n\nIf you did not create a TOMAN account, you can ignore this email.");
        try {
            mailSender.send(email);
            logger.info("Verification email accepted by the configured SMTP provider.");
        } catch (MailException exception) {
            logger.warn("Verification email was rejected by the configured SMTP provider: {}", exception.getMessage());
            throw AuthDomainException.serviceUnavailable(
                    "EMAIL_DELIVERY_FAILED",
                    "We could not deliver the verification email. Please try again shortly."
            );
        }
    }
}
