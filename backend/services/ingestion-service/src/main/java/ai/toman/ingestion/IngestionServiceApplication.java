package ai.toman.ingestion;

import ai.toman.ingestion.config.IngestionProperties;
import ai.toman.ingestion.security.GatewayTrustProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({IngestionProperties.class, GatewayTrustProperties.class})
public class IngestionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IngestionServiceApplication.class, args);
    }
}
