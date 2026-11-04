package ai.toman.notification.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ai.toman.notification.config.NotificationProperties;
import org.junit.jupiter.api.Test;

class InternalRequestAuthorizerTest {

    @Test
    void failsClosedWhenNoServiceCredentialIsConfigured() {
        InternalRequestAuthorizer authorizer = new InternalRequestAuthorizer(new NotificationProperties(""));

        assertThatThrownBy(() -> authorizer.assertAuthorized("any-value"))
                .isInstanceOf(InternalRequestForbiddenException.class);
    }

    @Test
    void acceptsOnlyTheConfiguredInternalCredential() {
        InternalRequestAuthorizer authorizer = new InternalRequestAuthorizer(new NotificationProperties("service-to-service-secret"));

        assertThatCode(() -> authorizer.assertAuthorized("service-to-service-secret")).doesNotThrowAnyException();
        assertThatThrownBy(() -> authorizer.assertAuthorized("wrong-secret"))
                .isInstanceOf(InternalRequestForbiddenException.class);
    }
}
