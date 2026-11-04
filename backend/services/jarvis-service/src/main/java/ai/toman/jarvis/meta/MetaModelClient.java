package ai.toman.jarvis.meta;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The one and only model provider boundary in TOMAN. It uses the Meta Model
 * API's OpenAI-compatible chat-completions endpoint but does not use any
 * non-Meta model, fallback model, fabricated plan, or client-side API key.
 */
@Component
public class MetaModelClient {

    private static final String JARVIS_SYSTEM_PROMPT = """
            You are Jarvis, TOMAN's sales-orchestration AI. Create a safe, owner-reviewable sales plan.
            You may propose specialist agent roles, content, audience logic, and a schedule, but you must never
            claim to have sent email, posted content, placed a call, connected an account, spent advertising money,
            or performed any external action. Every proposed external action needs owner review.
            Be precise, concise, privacy-aware, and consent-aware. Return only the requested structured plan.
            """;

    private final MetaModelProperties properties;
    private final JsonMapper objectMapper;
    private final RestClient restClient;

    public MetaModelClient(MetaModelProperties properties, JsonMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .build();
    }

    public boolean isConfigured() {
        return properties.configured();
    }

    public String modelId() {
        return properties.model();
    }

    public JsonNode createSalesPlan(String prompt) {
        if (!isConfigured()) {
            throw new MetaModelCallException(
                    "META_MODEL_NOT_CONFIGURED",
                    "META_AI_API_KEY is not configured on jarvis-service. No agent plan was generated.");
        }

        ObjectNode request = objectMapper.createObjectNode();
        request.put("model", properties.model());
        request.set("messages", messages(prompt));
        request.set("response_format", responseFormat());

        try {
            JsonNode response = restClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(properties.apiKey()))
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);

            String content = response == null
                    ? ""
                    : response.path("choices").path(0).path("message").path("content").asText("");
            if (content.isBlank()) {
                throw new MetaModelCallException(
                        "META_MODEL_EMPTY_RESPONSE",
                        "Meta Model API returned no structured Jarvis plan.");
            }
            return objectMapper.readTree(content);
        } catch (MetaModelCallException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new MetaModelCallException(
                    "META_MODEL_REQUEST_FAILED",
                    "Meta Model API request failed. No agent task was created from a substitute response.",
                    exception);
        } catch (Exception exception) {
            throw new MetaModelCallException(
                    "META_MODEL_RESPONSE_INVALID",
                    "Meta Model API did not return a valid structured Jarvis plan.",
                    exception);
        }
    }

    private ArrayNode messages(String prompt) {
        ArrayNode messages = objectMapper.createArrayNode();
        messages.addObject().put("role", "system").put("content", JARVIS_SYSTEM_PROMPT);
        messages.addObject().put("role", "user").put("content", prompt);
        return messages;
    }

    private ObjectNode responseFormat() {
        ObjectNode planSchema = objectMapper.createObjectNode();
        planSchema.put("type", "object");
        ObjectNode fields = planSchema.putObject("properties");
        fields.putObject("title").put("type", "string");
        fields.putObject("summary").put("type", "string");
        fields.putObject("objective").put("type", "string");
        fields.putObject("audienceRationale").put("type", "string");
        fields.putObject("ownerReviewRequired").put("type", "boolean");

        ObjectNode agents = fields.putObject("recommendedAgents");
        agents.put("type", "array");
        agents.putObject("items").put("type", "string");

        ObjectNode proposedActions = fields.putObject("proposedActions");
        proposedActions.put("type", "array");
        ObjectNode action = proposedActions.putObject("items");
        action.put("type", "object");
        ObjectNode actionFields = action.putObject("properties");
        actionFields.putObject("agent").put("type", "string");
        actionFields.putObject("action").put("type", "string");
        actionFields.putObject("requiresOwnerApproval").put("type", "boolean");
        action.putArray("required").add("agent").add("action").add("requiresOwnerApproval");
        action.put("additionalProperties", false);

        planSchema.putArray("required")
                .add("title")
                .add("summary")
                .add("objective")
                .add("audienceRationale")
                .add("ownerReviewRequired")
                .add("recommendedAgents")
                .add("proposedActions");
        planSchema.put("additionalProperties", false);

        ObjectNode responseFormat = objectMapper.createObjectNode();
        responseFormat.put("type", "json_schema");
        ObjectNode jsonSchema = responseFormat.putObject("json_schema");
        jsonSchema.put("name", "toman_sales_agent_plan");
        jsonSchema.set("schema", planSchema);
        return responseFormat;
    }
}
