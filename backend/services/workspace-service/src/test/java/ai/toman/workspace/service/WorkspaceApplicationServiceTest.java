package ai.toman.workspace.service;

import ai.toman.workspace.api.CreateWorkspaceRequest;
import ai.toman.workspace.api.UpdateSettingsRequest;
import ai.toman.workspace.api.WorkspaceResponse;
import ai.toman.workspace.domain.Workspace;
import ai.toman.workspace.domain.WorkspaceRepository;
import ai.toman.workspace.domain.WorkspaceSettings;
import ai.toman.workspace.domain.WorkspaceSettingsRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkspaceApplicationServiceTest {

    @Mock WorkspaceRepository workspaces;
    @Mock WorkspaceSettingsRepository settings;
    @Captor ArgumentCaptor<WorkspaceSettings> settingsCaptor;
    @InjectMocks WorkspaceApplicationService service;

    @Test
    void createsOnlyTheOwnersActualWorkspaceAndDefaultPreferences() {
        UUID ownerId = UUID.randomUUID();
        when(workspaces.findByOwnerId(ownerId)).thenReturn(Optional.empty());
        when(workspaces.save(any(Workspace.class))).thenAnswer(invocation -> invocation.getArgument(0));

        WorkspaceResponse response = service.create(ownerId, new CreateWorkspaceRequest(
                "  Northstar  Bakery ", " Retail ", " Fresh  bread ", "Asia/Kolkata"));

        assertThat(response.businessName()).isEqualTo("Northstar Bakery");
        assertThat(response.industry()).isEqualTo("Retail");
        assertThat(response.timezone()).isEqualTo("Asia/Kolkata");
    }

    @Test
    void rejectsDuplicateWorkspaceCreation() {
        UUID ownerId = UUID.randomUUID();
        when(workspaces.findByOwnerId(ownerId)).thenReturn(Optional.of(Workspace.create(
                ownerId, "Existing", null, null, "Asia/Kolkata")));

        assertThatThrownBy(() -> service.create(ownerId, new CreateWorkspaceRequest(
                "New", null, null, "Asia/Kolkata")))
                .isInstanceOf(WorkspaceDomainException.class)
                .hasMessageContaining("already has");
    }

    @Test
    void rejectsInvalidTimezoneInsteadOfSavingAmbiguousSettings() {
        UUID ownerId = UUID.randomUUID();
        when(workspaces.findByOwnerId(ownerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(ownerId, new CreateWorkspaceRequest(
                "Northstar", null, null, "not-a-timezone")))
                .isInstanceOf(WorkspaceDomainException.class)
                .hasMessageContaining("valid IANA timezone");
    }
}
