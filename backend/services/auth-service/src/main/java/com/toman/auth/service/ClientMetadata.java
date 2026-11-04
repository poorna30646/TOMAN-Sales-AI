package com.toman.auth.service;

import jakarta.servlet.http.HttpServletRequest;

public record ClientMetadata(String userAgent, String ipAddress) {

    public static ClientMetadata from(HttpServletRequest request) {
        String userAgent = truncate(request.getHeader("User-Agent"), 512);
        // This deliberately does not trust X-Forwarded-For. A future gateway may inject a
        // trusted client address after it is configured as a trusted proxy.
        String ipAddress = truncate(request.getRemoteAddr(), 64);
        return new ClientMetadata(userAgent, ipAddress);
    }

    private static String truncate(String value, int limit) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.length() <= limit ? value : value.substring(0, limit);
    }
}
