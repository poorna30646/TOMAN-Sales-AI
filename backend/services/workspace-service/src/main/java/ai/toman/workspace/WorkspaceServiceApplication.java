package ai.toman.workspace;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class WorkspaceServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkspaceServiceApplication.class, args);
    }
}
