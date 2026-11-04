/**
 * @format
 */

import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

let mountedRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

const gatewayUser = {
  id: '6d4f8e05-f5df-4718-89f3-3121cd2af8f4',
  fullName: 'Priya Rao',
  email: 'priya@example.com',
  mobileNumber: '+919876543210',
  emailVerified: true,
  createdAt: '2026-11-01T08:00:00Z',
};

const gatewaySession = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  accessTokenExpiresAt: '2026-11-01T08:15:00Z',
  refreshToken: 'test-refresh-token',
  refreshTokenExpiresAt: '2026-12-01T08:00:00Z',
  user: gatewayUser,
};

const workspace = {
  id: '44a7d9e5-eec9-4b9f-bdd4-d21f5496e0d3',
  businessName: 'Rao Home Studio',
  industry: 'Retail & e-commerce',
  businessDescription: 'Generate more qualified leads',
  timezone: 'Asia/Kolkata',
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
};

function response(body: unknown, status = 200) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  (globalThis as {fetch: typeof fetch}).fetch = jest.fn((input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.includes('/api/v1/auth/register')) {
      return response({user: gatewayUser, verificationRequired: true});
    }
    if (path.includes('/api/v1/auth/verify-email') || path.includes('/api/v1/auth/login') || path.includes('/api/v1/auth/refresh')) {
      return response(gatewaySession);
    }
    if (path.includes('/api/v1/auth/me')) {
      return response(gatewayUser);
    }
    if (path.includes('/api/v1/workspaces')) {
      return response(workspace, path.includes('/current') ? 200 : 201);
    }
    if (path.includes('/api/v1/settings')) {
      const savedValues = init?.method === 'PUT' && typeof init.body === 'string'
        ? JSON.parse(init.body) as Record<string, unknown>
        : {};
      return response({
        workspaceId: workspace.id,
        businessName: workspace.businessName,
        industry: workspace.industry,
        businessDescription: workspace.businessDescription,
        timezone: workspace.timezone,
        reviewNotificationsEnabled: true,
        permissionNotificationsEnabled: true,
        completedTaskNotificationsEnabled: true,
        newLeadNotificationsEnabled: true,
        updatedAt: workspace.updatedAt,
        ...savedValues,
      });
    }
    if (path.includes('/api/v1/documents')) {
      if (init?.method === 'POST') {
        return response({
          id: 'b4896a09-9394-44ce-8cc4-4d13e4db5899',
          filename: 'customer-data.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          mediaCategory: 'SPREADSHEET',
          sizeBytes: 2048,
          sha256: 'test-sha256',
          status: 'UPLOADED',
          createdAt: '2026-11-01T08:00:00Z',
        }, 201);
      }
      return response([]);
    }
    if (path.includes('/api/v1/notifications')) {
      return response({content: [], page: 0, size: 50, totalElements: 0, totalPages: 0, unreadCount: 0});
    }
    if (path.includes('/api/v1/jarvis/tasks')) {
      if (init?.method === 'POST') {
        return response({
          id: 'c8d30aec-7144-44f6-a804-e28b8384c644',
          title: 'Maya direct brief',
          prompt: 'Create a premium festive offer for repeat buyers.',
          status: 'AWAITING_OWNER_REVIEW',
          modelId: 'meta-agent',
          plan: {summary: 'Jarvis prepared a reviewable sales plan.'},
          failureCode: null,
          failureDetail: null,
          createdAt: '2026-11-01T08:00:00Z',
          updatedAt: '2026-11-01T08:00:00Z',
        }, 201);
      }
      return response([]);
    }
    return response({});
  }) as unknown as typeof fetch;
});

jest.mock('@react-native-documents/picker', () => ({
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error),
  pick: jest.fn(async () => []),
  types: {
    pdf: 'application/pdf',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  },
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => ({service: 'ai.toman.sales.session'})),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('react-native-tts', () => ({
  getInitStatus: jest.fn(async () => undefined),
  setDefaultLanguage: jest.fn(async () => undefined),
  setDefaultVoice: jest.fn(async () => undefined),
  setDefaultPitch: jest.fn(async () => undefined),
  setDefaultRate: jest.fn(async () => undefined),
  voices: jest.fn(async () => [{
    id: 'en-us-strong',
    name: 'English US strong',
    language: 'en-US',
    quality: 500,
    latency: 100,
    networkConnectionRequired: false,
    notInstalled: false,
  }]),
  speak: jest.fn(),
  stop: jest.fn(async () => undefined),
  addEventListener: jest.fn(() => ({remove: jest.fn()})),
  removeEventListener: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactNative = require('react-native');
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
    SafeAreaView: ({children}: {children: React.ReactNode}) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
  };
});

async function renderApp() {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

async function flushAsyncUpdates() {
  await Promise.resolve();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  await Promise.resolve();
}

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mountedRenderers.forEach(renderer => renderer.unmount());
  });
  mountedRenderers = [];
});

async function enterNewWorkspace(renderer: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'welcome-register'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-name'}).props.onChangeText('Priya Rao');
    renderer.root.findByProps({testID: 'register-business'}).props.onChangeText('Rao Home Studio');
    renderer.root.findByProps({testID: 'register-email'}).props.onChangeText('priya@example.com');
    renderer.root.findByProps({testID: 'register-mobile'}).props.onChangeText('+91 98765 43210');
    renderer.root.findByProps({testID: 'register-password'}).props.onChangeText('Secure1234');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-continue'}).props.onPress();
    await flushAsyncUpdates();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-email-code'}).props.onChangeText('123456');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-email-submit'}).props.onPress();
    await flushAsyncUpdates();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'setup-continue'}).props.onPress();
    await flushAsyncUpdates();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'intro-continue'}).props.onPress();
  });
}

test('starts with a guided workspace welcome', async () => {
  const renderer = await renderApp();
  expect(renderer.root.findByProps({testID: 'welcome-register'})).toBeTruthy();
});

test('registration collects owner and business details before the Jarvis introduction', async () => {
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'welcome-register'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-name'}).props.onChangeText('Priya Rao');
    renderer.root.findByProps({testID: 'register-business'}).props.onChangeText('Rao Home Studio');
    renderer.root.findByProps({testID: 'register-email'}).props.onChangeText('priya@rao.demo');
    renderer.root.findByProps({testID: 'register-mobile'}).props.onChangeText('+91 98765 43210');
    renderer.root.findByProps({testID: 'register-password'}).props.onChangeText('Secret1234');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-continue'}).props.onPress();
    await flushAsyncUpdates();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-email-code'}).props.onChangeText('123456');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-email-submit'}).props.onPress();
    await flushAsyncUpdates();
  });

  expect(renderer.root.findByProps({testID: 'setup-continue'})).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'setup-continue'}).props.onPress();
    await flushAsyncUpdates();
  });
  expect(renderer.root.findByProps({testID: 'intro-continue'})).toBeTruthy();
});

test('verification shows a wrong-code error and sends only one request while locked', async () => {
  const originalFetch = globalThis.fetch;
  const lockedFetch = jest.fn((input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes('/api/v1/auth/verify-email')) {
      return response({code: 'INVALID_VERIFICATION_CODE', message: 'The verification code is incorrect.'}, 400);
    }
    return (originalFetch as jest.Mock)(input, init);
  });
  (globalThis as {fetch: typeof fetch}).fetch = lockedFetch as unknown as typeof fetch;

  const renderer = await renderApp();
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'welcome-register'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-name'}).props.onChangeText('Priya Rao');
    renderer.root.findByProps({testID: 'register-business'}).props.onChangeText('Rao Home Studio');
    renderer.root.findByProps({testID: 'register-email'}).props.onChangeText('priya@example.com');
    renderer.root.findByProps({testID: 'register-mobile'}).props.onChangeText('+91 98765 43210');
    renderer.root.findByProps({testID: 'register-password'}).props.onChangeText('Secure1234');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'register-continue'}).props.onPress();
    await flushAsyncUpdates();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'verify-email-code'}).props.onChangeText('000000');
  });
  await ReactTestRenderer.act(async () => {
    const submit = renderer.root.findByProps({testID: 'verify-email-submit'}).props.onPress;
    submit();
    submit();
    await flushAsyncUpdates();
  });

  expect(lockedFetch.mock.calls.filter(([url]) => String(url).includes('/api/v1/auth/verify-email'))).toHaveLength(1);
  const text = renderer.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text).toContain('The verification code is incorrect.');
});

test('a verified owner without a workspace resumes business setup after sign-in', async () => {
  const originalFetch = globalThis.fetch;
  (globalThis as {fetch: typeof fetch}).fetch = jest.fn((input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.includes('/api/v1/auth/login')) {
      return response(gatewaySession);
    }
    if (path.includes('/api/v1/workspaces/current')) {
      return response({code: 'WORKSPACE_NOT_FOUND', message: 'No workspace exists for this owner.'}, 404);
    }
    return (originalFetch as jest.Mock)(input, init);
  }) as unknown as typeof fetch;

  const renderer = await renderApp();
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'welcome-sign-in'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'login-email'}).props.onChangeText('priya@example.com');
    renderer.root.findByProps({testID: 'login-password'}).props.onChangeText('Secure1234');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'login-submit'}).props.onPress();
    await flushAsyncUpdates();
    await flushAsyncUpdates();
    await flushAsyncUpdates();
  });

  const text = renderer.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(text).toContain('Your email is verified');
  expect(renderer.root.findByProps({testID: 'setup-business-name'})).toBeTruthy();
});

test('a real workspace sends an owner brief to Jarvis Service for review', async () => {
  const renderer = await renderApp();
  await enterNewWorkspace(renderer);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'tab-Agents'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'agent-brief-input'}).props.onChangeText('Create a premium festive offer for repeat buyers.');
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'agent-brief-send'}).props.onPress();
    await flushAsyncUpdates();
  });

  expect(renderer.root.findAllByProps({children: 'Maya direct brief'}).length).toBeGreaterThan(0);
  expect((globalThis.fetch as jest.Mock).mock.calls.some(([url, init]) =>
    String(url).includes('/api/v1/jarvis/tasks') && init?.method === 'POST')).toBe(true);
});

test('a newly registered owner starts with an empty real workspace rather than demo leads or campaigns', async () => {
  const renderer = await renderApp();
  await enterNewWorkspace(renderer);

  expect(renderer.root.findByProps({testID: 'dashboard-home'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'tab-Leads'}).props.onPress();
  });

  expect(renderer.root.findByProps({testID: 'leads-empty-state'})).toBeTruthy();
  const renderedText = renderer.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(renderedText).toContain('Rao Home Studio');
  expect(renderedText).not.toContain('Luma Living');
});

test('settings are reachable and a selected device spreadsheet is queued without adding sample leads', async () => {
  const picker = require('@react-native-documents/picker');
  picker.pick.mockResolvedValueOnce([
    {
      uri: 'content://documents/customer-data.xlsx',
      name: 'customer-data.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 2048,
      hasRequestedType: true,
    },
  ]);

  const renderer = await renderApp();
  await enterNewWorkspace(renderer);

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'open-settings'}).props.onPress();
  });
  expect(renderer.root.findByProps({testID: 'settings-screen'})).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'settings-add-documents'}).props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    renderer.root.findByProps({testID: 'pick-business-documents'}).props.onPress();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  const renderedText = renderer.root.findAllByType(Text).map(node => String(node.props.children)).join(' ');
  expect(renderedText).toContain('customer-data.xlsx');
  expect(renderedText).not.toContain('Priya Shah');

  const preference = renderer.root.findByProps({testID: 'notification-reviews-needed'});
  expect(preference.props.value).toBe(true);
  await ReactTestRenderer.act(async () => {
    preference.props.onValueChange(false);
  });
  expect(renderer.root.findByProps({testID: 'notification-reviews-needed'}).props.value).toBe(false);
});
