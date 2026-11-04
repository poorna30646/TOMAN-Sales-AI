package com.toman.auth.security;

import java.io.Serializable;

public record AuthenticatedPrincipal(String userId, String sessionId, String email) implements Serializable {
}
