package com.toman.auth.service;

/**
 * Provider-independent port. A later adapter can deliver through SES, SMTP, Resend, or another
 * provider without changing registration or verification logic.
 */
public interface VerificationEmailSender {

    void send(VerificationEmailMessage message);
}
