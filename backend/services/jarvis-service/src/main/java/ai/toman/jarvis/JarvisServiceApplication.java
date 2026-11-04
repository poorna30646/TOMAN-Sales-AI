package ai.toman.jarvis;

import ai.toman.jarvis.meta.MetaModelProperties;
import ai.toman.jarvis.notification.NotificationDeliveryProperties;
import ai.toman.jarvis.security.GatewayTrustProperties;
import ai.toman.jarvis.workspace.WorkspaceScopeProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({
        MetaModelProperties.class,
        NotificationDeliveryProperties.class,
        GatewayTrustProperties.class,
        WorkspaceScopeProperties.class
})
public class JarvisServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(JarvisServiceApplication.class, args);
    }
}
