import {
  AgentRun,
  Campaign,
  Integration,
  RegistrationForm,
  SelectedBusinessDocument,
  UserSession,
} from '../types';
import {getGatewayBaseUrl} from '../config/gateway';

/**
 * The offline UI contract. It is intentionally separate from the Gateway
 * contract below: a local prototype must never pretend that it created a
 * server account, sent an email, uploaded a file, or connected a channel.
 */
export interface TomanApi {
  auth: {
    register(input: RegistrationForm): Promise<UserSession>;
    signIn(email: string, password: string): Promise<UserSession>;
    logout(): Promise<void>;
  };
  jarvis: {
    createRun(input: {prompt: string; createdBy: 'Jarvis' | 'Owner'}): Promise<AgentRun>;
  };
  campaigns: {
    approve(campaign: Campaign): Promise<Campaign>;
  };
  integrations: {
    beginSecureConnection(integration: Integration): Promise<Integration>;
  };
  documents: {
    queueForSecureUpload(document: SelectedBusinessDocument): Promise<SelectedBusinessDocument>;
  };
}

/** Spring API Gateway resource roots implemented by the microservices. */
export const gatewayEndpoints = {
  auth: '/api/v1/auth',
  workspaces: '/api/v1/workspaces',
  settings: '/api/v1/settings',
  documents: '/api/v1/documents',
  notifications: '/api/v1/notifications',
  jarvis: '/api/v1/jarvis',
} as const;

export interface GatewayUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface GatewayRegistrationResponse {
  user: GatewayUser;
  verificationRequired: boolean;
  /** Present only in the local-development Auth response. Never show or log it in production. */
  developmentVerificationCode?: string | null;
}

export interface GatewayAuthSession {
  accessToken: string;
  tokenType: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: GatewayUser;
}

export interface GatewayWorkspace {
  id: string;
  businessName: string;
  industry: string | null;
  businessDescription: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface GatewaySettings {
  workspaceId: string;
  businessName: string;
  industry: string | null;
  businessDescription: string | null;
  timezone: string;
  reviewNotificationsEnabled: boolean;
  permissionNotificationsEnabled: boolean;
  completedTaskNotificationsEnabled: boolean;
  newLeadNotificationsEnabled: boolean;
  updatedAt: string;
}

export interface GatewayDocument {
  id: string;
  filename: string;
  contentType: string;
  mediaCategory: 'PDF' | 'SPREADSHEET';
  sizeBytes: number;
  sha256: string;
  status: 'UPLOADED' | 'REJECTED' | 'FAILED';
  createdAt: string;
}

export type GatewayNotificationType =
  | 'REVIEW_REQUIRED'
  | 'PERMISSION_REQUIRED'
  | 'TASK_COMPLETED'
  | 'NEW_LEAD';

export interface GatewayNotification {
  id: string;
  type: GatewayNotificationType;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface GatewayNotificationPage {
  content: GatewayNotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
}

export type GatewayAgentTaskStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'AWAITING_OWNER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED_CONFIGURATION'
  | 'FAILED';

export interface GatewayAgentTask {
  id: string;
  title: string;
  prompt: string;
  status: GatewayAgentTaskStatus;
  modelId: string;
  plan: unknown | null;
  failureCode: string | null;
  failureDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayMetaModelStatus {
  configured: boolean;
  model: string;
  provider: 'META';
}

export interface GatewayTomanApiOptions {
  /** Supplies a short-lived access token held by the session layer in memory. */
  getAccessToken?: () => string | null;
  /** Lets the session coordinator rotate the secure refresh session after one expired access token. */
  onUnauthorized?: () => Promise<string | null> | string | null;
  /** Overrides the emulator, device, or production gateway URL. */
  baseUrl?: string;
}

export class GatewayRequestError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, responseBody: string) {
    super(gatewayErrorMessage(status, responseBody));
    this.name = 'GatewayRequestError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

/** Turns the gateway's structured error into wording that can be shown safely to an owner. */
function gatewayErrorMessage(status: number, responseBody: string) {
  try {
    const parsed = JSON.parse(responseBody) as {message?: unknown};
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // A non-JSON response still receives a clear HTTP fallback below.
  }
  return responseBody || `TOMAN could not complete this request (HTTP ${status}).`;
}

interface GatewayRequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  formData?: FormData;
  /** Auth endpoints must not trigger a second refresh attempt after a 401. */
  retryOnUnauthorized?: boolean;
}

export interface CreateWorkspaceInput {
  businessName: string;
  industry?: string;
  businessDescription?: string;
  timezone: string;
}

export interface UpdateSettingsInput {
  businessName: string;
  industry?: string;
  businessDescription?: string;
  timezone: string;
  reviewNotificationsEnabled: boolean;
  permissionNotificationsEnabled: boolean;
  completedTaskNotificationsEnabled: boolean;
  newLeadNotificationsEnabled: boolean;
}

export interface GatewayNotificationListOptions {
  page?: number;
  size?: number;
  unreadOnly?: boolean;
}

function queryString(values: Record<string, string | number | boolean | undefined>) {
  const query = Object.entries(values).filter(([, value]) => value !== undefined);
  if (!query.length) {
    return '';
  }
  return `?${query.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`;
}

/**
 * Gateway client matching the Spring services. The caller owns session
 * persistence: keep the access token in memory and put the rotating refresh
 * token in platform secure storage, never AsyncStorage or source code.
 *
 * Auth registration is deliberately not converted into a UserSession. The
 * production sequence is register -> verify email -> secure session -> create
 * workspace, so a client cannot accidentally treat an unverified account as a
 * signed-in business owner.
 */
export function createGatewayTomanApi(options: GatewayTomanApiOptions = {}) {
  const baseUrl = (options.baseUrl ?? getGatewayBaseUrl()).replace(/\/$/, '');

  const request = async <T>(
    path: string,
    requestOptions: GatewayRequestOptions = {},
    retriedAfterRefresh = false,
  ): Promise<T> => {
    const accessToken = options.getAccessToken?.();
    const headers: Record<string, string> = {Accept: 'application/json'};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    if (!requestOptions.formData && requestOptions.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: requestOptions.method ?? 'GET',
      headers,
      body: requestOptions.formData ?? (requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body)),
    });

    if (
      response.status === 401 &&
      !retriedAfterRefresh &&
      requestOptions.retryOnUnauthorized !== false &&
      options.onUnauthorized
    ) {
      const refreshedToken = await options.onUnauthorized();
      if (refreshedToken) {
        return request<T>(path, requestOptions, true);
      }
    }
    if (!response.ok) {
      throw new GatewayRequestError(response.status, await response.text());
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  };

  return {
    auth: {
      register: (input: RegistrationForm) => request<GatewayRegistrationResponse>(`${gatewayEndpoints.auth}/register`, {
        method: 'POST',
        retryOnUnauthorized: false,
        body: {
          fullName: input.fullName.trim(),
          email: input.email.trim(),
          mobileNumber: input.mobile.replace(/[\s()-]/g, ''),
          password: input.password,
        },
      }),
      verifyEmail: (email: string, code: string) => request<GatewayAuthSession>(`${gatewayEndpoints.auth}/verify-email`, {
        method: 'POST',
        retryOnUnauthorized: false,
        body: {email: email.trim(), code: code.trim()},
      }),
      resendVerification: (email: string) => request<{
        accepted: boolean;
        developmentVerificationCode?: string | null;
      }>(`${gatewayEndpoints.auth}/resend-verification`, {
        method: 'POST',
        retryOnUnauthorized: false,
        body: {email: email.trim()},
      }),
      signIn: (email: string, password: string) => request<GatewayAuthSession>(`${gatewayEndpoints.auth}/login`, {
        method: 'POST',
        retryOnUnauthorized: false,
        body: {email: email.trim(), password},
      }),
      refresh: (refreshToken: string) => request<GatewayAuthSession>(`${gatewayEndpoints.auth}/refresh`, {
        method: 'POST',
        retryOnUnauthorized: false,
        body: {refreshToken},
      }),
      logout: () => request<void>(`${gatewayEndpoints.auth}/logout`, {method: 'POST'}),
      currentUser: () => request<GatewayUser>(`${gatewayEndpoints.auth}/me`),
    },
    workspace: {
      create: (input: CreateWorkspaceInput) => request<GatewayWorkspace>(gatewayEndpoints.workspaces, {
        method: 'POST',
        body: input,
      }),
      current: () => request<GatewayWorkspace>(`${gatewayEndpoints.workspaces}/current`),
    },
    settings: {
      get: () => request<GatewaySettings>(gatewayEndpoints.settings),
      update: (input: UpdateSettingsInput) => request<GatewaySettings>(gatewayEndpoints.settings, {
        method: 'PUT',
        body: input,
      }),
    },
    documents: {
      upload: (document: SelectedBusinessDocument) => {
        const formData = new FormData();
        formData.append('file', {
          uri: document.uri,
          name: document.name,
          type: document.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
        return request<GatewayDocument>(gatewayEndpoints.documents, {method: 'POST', formData});
      },
      list: () => request<GatewayDocument[]>(gatewayEndpoints.documents),
      details: (documentId: string) => request<GatewayDocument>(`${gatewayEndpoints.documents}/${encodeURIComponent(documentId)}`),
    },
    notifications: {
      list: (listOptions: GatewayNotificationListOptions = {}) => request<GatewayNotificationPage>(
        `${gatewayEndpoints.notifications}${queryString({
          page: listOptions.page,
          size: listOptions.size,
          unreadOnly: listOptions.unreadOnly,
        })}`,
      ),
      markRead: (notificationId: string) => request<GatewayNotification>(
        `${gatewayEndpoints.notifications}/${encodeURIComponent(notificationId)}/read`,
        {method: 'POST'},
      ),
      markAllRead: () => request<{markedReadCount: number; readAt: string}>(
        `${gatewayEndpoints.notifications}/read-all`,
        {method: 'POST'},
      ),
    },
    jarvis: {
      createTask: (input: {title?: string; prompt: string}) => request<GatewayAgentTask>(`${gatewayEndpoints.jarvis}/tasks`, {
        method: 'POST',
        body: input,
      }),
      listTasks: () => request<GatewayAgentTask[]>(`${gatewayEndpoints.jarvis}/tasks`),
      decideTask: (taskId: string, input: {approved: boolean; note?: string}) => request<GatewayAgentTask>(
        `${gatewayEndpoints.jarvis}/tasks/${encodeURIComponent(taskId)}/owner-decision`,
        {method: 'POST', body: input},
      ),
      metaStatus: () => request<GatewayMetaModelStatus>(`${gatewayEndpoints.jarvis}/meta/status`),
    },
  };
}

/**
 * Front-end-only adapter. It never creates a server account, stores a token,
 * uploads a document, connects a provider, sends a message, places a call,
 * spends ad budget, or publishes an asset. Its shape is ready to replace with
 * the Spring Gateway client after the services are running.
 */
export const localTomanApi: TomanApi = {
  auth: {
    async register(input) {
      return {
        userId: `local-owner-${Date.now()}`,
        workspaceId: `local-workspace-${Date.now()}`,
        ownerName: input.fullName.trim() || 'Business Owner',
        businessName: input.businessName.trim() || 'My Business',
        isDemo: false,
      };
    },
    async signIn() {
      return {
        userId: 'demo-owner-local',
        workspaceId: 'demo-workspace-local',
        ownerName: 'Arjun Nair',
        businessName: 'Luma Living',
        isDemo: true,
      };
    },
    async logout() {
      return undefined;
    },
  },
  jarvis: {
    async createRun({prompt, createdBy}) {
      return {
        id: `run-local-${Date.now()}`,
        title: 'New Jarvis sales motion',
        prompt,
        status: 'Awaiting owner review',
        assignedAgentIds: ['jarvis', 'strategy', 'creative', 'operations'],
        createdBy,
        output:
          'Jarvis prepared a draft plan. The audience, content, channel, schedule, and consent checks need owner review before any external action.',
        createdAt: 'Just now',
      };
    },
  },
  campaigns: {
    async approve(campaign) {
      return {...campaign, status: 'Scheduled', scheduledFor: 'Tomorrow, 10:30 AM'};
    },
  },
  integrations: {
    async beginSecureConnection(integration) {
      return {...integration, status: 'Sandbox connected', account: 'Local sandbox'};
    },
  },
  documents: {
    async queueForSecureUpload(document) {
      return {...document, status: 'Queued for secure upload'};
    },
  },
};

/** Compatibility alias for the explicit demo entry point. */
export const demoTomanApi = localTomanApi;
