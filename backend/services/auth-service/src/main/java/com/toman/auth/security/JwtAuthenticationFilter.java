package com.toman.auth.security;

import com.toman.auth.domain.RefreshSession;
import com.toman.auth.repository.RefreshSessionRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;
    private final RefreshSessionRepository refreshSessionRepository;

    public JwtAuthenticationFilter(
            JwtTokenService jwtTokenService,
            RefreshSessionRepository refreshSessionRepository
    ) {
        this.jwtTokenService = jwtTokenService;
        this.refreshSessionRepository = refreshSessionRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String rawToken = authorization.substring(7).trim();
        try {
            AccessTokenClaims claims = jwtTokenService.parse(rawToken);
            Optional<RefreshSession> activeSession = refreshSessionRepository
                    .findByIdAndRevokedAtIsNullAndExpiresAtAfter(claims.sessionId(), Instant.now());
            if (activeSession.isPresent()
                    && activeSession.get().getUser().isActive()
                    && activeSession.get().getUser().getId().equals(claims.userId())) {
                AuthenticatedPrincipal principal = new AuthenticatedPrincipal(
                        claims.userId(),
                        claims.sessionId(),
                        claims.email()
                );
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_OWNER"))
                );
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            }
        } catch (JwtException | IllegalArgumentException ignored) {
            // Do not disclose token parsing details. Protected endpoints are rejected by the entry point.
        }

        filterChain.doFilter(request, response);
    }
}
