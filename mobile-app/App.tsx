import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Tts from 'react-native-tts';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  createStarterAgents,
  createStarterIntegrations,
  demoAgentRuns,
  demoAgents,
  demoAlerts,
  demoCampaigns,
  demoIntegrations,
  demoLeads,
  demoWorkspaceMetrics,
  emptyWorkspaceMetrics,
} from './src/data/demoData';
import {
  AgentRun,
  AgentRunStatus,
  AppStage,
  AlertItem,
  Campaign,
  CampaignStatus,
  DemoSession,
  Integration,
  Lead,
  NotificationPreferences,
  RegistrationForm,
  SalesAgent,
  SelectedBusinessDocument,
  TabKey,
  WorkspaceMetrics,
} from './src/types';
import {
  createGatewayTomanApi,
  GatewayAgentTask,
  GatewayAuthSession,
  GatewayDocument,
  GatewayNotification,
  GatewayRequestError,
  GatewaySettings,
  GatewayWorkspace,
  localTomanApi,
} from './src/services/tomanApi';
import {selectBusinessDocuments} from './src/services/documentPicker';
import {clearRefreshSession, loadRefreshSession, saveRefreshSession} from './src/services/secureSession';
import {
  Avatar,
  Card,
  Colors,
  Divider,
  Metric,
  Pill,
  SectionTitle,
  StatusDot,
  TomanButton,
  TrendBars,
} from './src/ui';

type DetailRoute =
  | {kind: 'lead'; lead: Lead}
  | {kind: 'campaign'; campaign: Campaign}
  | null;

const tabItems: Array<{key: TabKey; label: string; icon: string}> = [
  {key: 'Home', label: 'Home', icon: '⌂'},
  {key: 'Leads', label: 'Leads', icon: '◉'},
  {key: 'Jarvis', label: 'Jarvis', icon: '✦'},
  {key: 'Agents', label: 'Agents', icon: '◌'},
  {key: 'Campaigns', label: 'Campaigns', icon: '◫'},
];

const emptyRegistration: RegistrationForm = {
  fullName: '',
  businessName: '',
  email: '',
  mobile: '',
  password: '',
  industry: 'Retail & e-commerce',
  goal: 'Generate more qualified leads',
};

const recordingWelcome = 'Welcome to TOMAN AI. I am Jarvis, your AI sales manager. How can I help you today?';

/** Offline recording mode uses only the phone's installed TTS engine. */
async function speakRecordingWelcome() {
  try {
    await Tts.getInitStatus();
    await Tts.setDefaultLanguage('en-US');
    const availableVoices = await Tts.voices();
    const strongestEnglishVoice = availableVoices
      .filter(voice => !voice.notInstalled && voice.language.toLowerCase().startsWith('en'))
      .sort((left, right) => {
        const leftUs = left.language.toLowerCase() === 'en-us' ? 1 : 0;
        const rightUs = right.language.toLowerCase() === 'en-us' ? 1 : 0;
        return rightUs - leftUs || right.quality - left.quality || left.latency - right.latency;
      })[0];
    if (strongestEnglishVoice) {
      await Tts.setDefaultVoice(strongestEnglishVoice.id);
    }
    await Tts.setDefaultPitch(0.82);
    await Tts.setDefaultRate(0.44, true);
    await Tts.stop();
    Tts.speak(recordingWelcome);
  } catch {
    // The visual recording demo remains usable if no TTS engine is installed.
  }
}

function notificationKind(type: GatewayNotification['type']): AlertItem['kind'] {
  if (type === 'NEW_LEAD') {
    return 'lead';
  }
  if (type === 'PERMISSION_REQUIRED') {
    return 'permission';
  }
  if (type === 'TASK_COMPLETED') {
    return 'completed';
  }
  return 'review';
}

function notificationToAlert(notification: GatewayNotification): AlertItem {
  return {
    id: notification.id,
    title: notification.title,
    detail: notification.message,
    time: new Date(notification.createdAt).toLocaleString(),
    kind: notificationKind(notification.type),
    unread: !notification.read,
  };
}

function taskStatus(task: GatewayAgentTask): AgentRunStatus {
  switch (task.status) {
    case 'APPROVED': return 'Approved';
    case 'REJECTED': return 'Awaiting owner review';
    case 'AWAITING_OWNER_REVIEW': return 'Awaiting owner review';
    case 'PLANNING': return 'Planning';
    case 'CREATED': return 'Planning';
    case 'FAILED': return 'Complete';
    case 'BLOCKED_CONFIGURATION': return 'Complete';
    default: return 'Planning';
  }
}

function planSummary(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object' || !('summary' in plan)) {
    return null;
  }
  const summary = (plan as {summary?: unknown}).summary;
  return typeof summary === 'string' ? summary : null;
}

function taskToRun(task: GatewayAgentTask): AgentRun {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    status: taskStatus(task),
    assignedAgentIds: ['jarvis'],
    createdBy: 'Jarvis',
    output: task.failureDetail ?? planSummary(task.plan) ?? 'Jarvis is preparing your owner-reviewable plan.',
    createdAt: new Date(task.createdAt).toLocaleString(),
  };
}

function gatewayDocumentToSelected(document: GatewayDocument): SelectedBusinessDocument {
  return {
    id: document.id,
    name: document.filename,
    uri: '',
    mimeType: document.contentType,
    size: document.sizeBytes,
    category: document.mediaCategory === 'SPREADSHEET' ? 'Customer sheet' : 'Business document',
    status: document.status === 'UPLOADED' ? 'Uploaded' : 'Upload failed',
  };
}

function App() {
  const [stage, setStage] = useState<AppStage>('welcome');
  const [session, setSession] = useState<DemoSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Home');
  const [detail, setDetail] = useState<DetailRoute>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [agents, setAgents] = useState<SalesAgent[]>(createStarterAgents);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>(createStarterIntegrations);
  const [documents, setDocuments] = useState<SelectedBusinessDocument[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics>({...emptyWorkspaceMetrics});
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    reviews: true,
    permissions: true,
    completedTasks: true,
    newLeads: true,
  });
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<RegistrationForm | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [gatewaySettings, setGatewaySettings] = useState<GatewaySettings | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const [, setAccessToken] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
    toastTimeout.current = setTimeout(() => setToast(null), 2800);
  };

  const setLiveAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  const clearLiveSession = useCallback(async () => {
    setLiveAccessToken(null);
    await clearRefreshSession().catch(() => undefined);
  }, [setLiveAccessToken]);

  const refreshLiveSession = useCallback(async (): Promise<string | null> => {
    const persisted = await loadRefreshSession().catch(() => null);
    if (!persisted) {
      return null;
    }
    try {
      const refreshed = await createGatewayTomanApi().auth.refresh(persisted.refreshToken);
      setLiveAccessToken(refreshed.accessToken);
      await saveRefreshSession(refreshed);
      return refreshed.accessToken;
    } catch {
      await clearLiveSession();
      setSession(null);
      setStage('welcome');
      return null;
    }
  }, [clearLiveSession, setLiveAccessToken]);

  const gatewayApi = useMemo(() => createGatewayTomanApi({
    getAccessToken: () => accessTokenRef.current,
    onUnauthorized: refreshLiveSession,
  }), [refreshLiveSession]);

  const applyGatewaySettings = useCallback((settings: GatewaySettings) => {
    setGatewaySettings(settings);
    setNotificationPreferences({
      reviews: settings.reviewNotificationsEnabled,
      permissions: settings.permissionNotificationsEnabled,
      completedTasks: settings.completedTaskNotificationsEnabled,
      newLeads: settings.newLeadNotificationsEnabled,
    });
    setSession(current => current && !current.isDemo
      ? {...current, businessName: settings.businessName}
      : current);
  }, []);

  const resetForNewWorkspace = useCallback(() => {
    setCampaigns([]);
    setLeads([]);
    setAlerts([]);
    setAgents(createStarterAgents());
    setAgentRuns([]);
    setIntegrations(createStarterIntegrations());
    setDocuments([]);
    setGatewaySettings(null);
    setMetrics({...emptyWorkspaceMetrics});
    setNotificationPreferences({
      reviews: true,
      permissions: true,
      completedTasks: true,
      newLeads: true,
    });
  }, []);

  const hydrateLiveWorkspace = useCallback(async (auth: GatewayAuthSession, workspace: GatewayWorkspace) => {
    resetForNewWorkspace();
    setSession({
      userId: auth.user.id,
      workspaceId: workspace.id,
      ownerName: auth.user.fullName,
      businessName: workspace.businessName,
      isDemo: false,
    });

    const [settingsResult, documentsResult, notificationsResult, tasksResult] = await Promise.allSettled([
      gatewayApi.settings.get(),
      gatewayApi.documents.list(),
      gatewayApi.notifications.list({size: 50}),
      gatewayApi.jarvis.listTasks(),
    ]);
    if (settingsResult.status === 'fulfilled') {
      applyGatewaySettings(settingsResult.value);
    }
    if (documentsResult.status === 'fulfilled') {
      setDocuments(documentsResult.value.map(gatewayDocumentToSelected));
    }
    if (notificationsResult.status === 'fulfilled') {
      setAlerts(notificationsResult.value.content.map(notificationToAlert));
    }
    if (tasksResult.status === 'fulfilled') {
      setAgentRuns(tasksResult.value.map(taskToRun));
    }
  }, [applyGatewaySettings, gatewayApi, resetForNewWorkspace]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const persisted = await loadRefreshSession().catch(() => null);
      if (!persisted || !active) {
        return;
      }
      try {
        const restored = await createGatewayTomanApi().auth.refresh(persisted.refreshToken);
        if (!active) {
          return;
        }
        setLiveAccessToken(restored.accessToken);
        await saveRefreshSession(restored);
        const workspace = await gatewayApi.workspace.current();
        if (!active) {
          return;
        }
        await hydrateLiveWorkspace(restored, workspace);
        if (active) {
          setStage('workspace');
        }
      } catch {
        await clearLiveSession();
      }
    };
    restore();
    return () => {
      active = false;
    };
  }, [clearLiveSession, gatewayApi, hydrateLiveWorkspace, setLiveAccessToken]);

  const goToCampaign = (campaignId = 'campaign-festive') => {
    const campaign = campaigns.find(item => item.id === campaignId);
    if (campaign) {
      setDetail({kind: 'campaign', campaign});
    }
  };

  const approveCampaign = (campaignId: string) => {
    if (!session?.isDemo) {
      showToast('Campaign approvals will be available when the workflow service is connected.');
      return;
    }

    const approved = campaigns.find(item => item.id === campaignId);
    if (!approved) {
      return;
    }

    localTomanApi.campaigns.approve(approved).then(scheduled => {
      setCampaigns(current =>
        current.map(item =>
          item.id === campaignId
            ? {
                ...scheduled,
                progress: 'Owner approval recorded — ready for safe scheduling',
                color: Colors.green,
              }
            : item,
        ),
      );
      setAgentRuns(current =>
        current.map(run =>
          run.status === 'Awaiting owner review'
            ? {...run, status: 'Scheduled', output: 'Owner approval recorded. Campaign Operations is preparing the safe schedule.'}
            : run,
        ),
      );
      setMetrics(current => ({...current, revenue: '₹4.96L'}));
      setAlerts(current => [
        {
          id: 'alert-approved-' + campaignId,
          title: approved.title + ' is scheduled',
          detail: 'Owner approval recorded. TOMAN will simulate a safe local delivery at 10:30 AM.',
          time: 'Just now',
          kind: 'completed',
          unread: true,
        },
        ...current,
      ]);
      setDetail(null);
      setActiveTab('Campaigns');
      showToast('Approved and safely scheduled for the local demo');
    }).catch(() => showToast('The local approval could not be updated. Please try again.'));
  };

  const queueDocuments = async (nextDocuments: SelectedBusinessDocument[]) => {
    if (!nextDocuments.length) {
      return;
    }

    if (session?.isDemo) {
      const queued = await Promise.all(nextDocuments.map(document => localTomanApi.documents.queueForSecureUpload(document)));
      setDocuments(current => [...queued, ...current]);
      setAlerts(current => [
        ...queued.map(document => ({
          id: `alert-document-${document.id}`,
          title: `${document.name} is ready for review`,
          detail: 'The file is selected in the isolated demo. No customer data is uploaded.',
          time: 'Just now',
          kind: 'review' as const,
          unread: true,
        })),
        ...current,
      ]);
      setShowUpload(false);
      showToast(`${queued.length} demo file${queued.length === 1 ? '' : 's'} selected`);
      return;
    }

    try {
      const uploaded = await Promise.all(nextDocuments.map(document => gatewayApi.documents.upload(document)));
      setDocuments(current => [...uploaded.map(gatewayDocumentToSelected), ...current]);
      setShowUpload(false);
      showToast(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} securely uploaded`);
    } catch (error) {
      setDocuments(current => [...nextDocuments.map(document => ({...document, status: 'Upload failed' as const})), ...current]);
      showToast(error instanceof Error ? error.message : 'The document could not be uploaded. Please try again.');
    }
  };

  const pickDocumentsFromDevice = () => {
    selectBusinessDocuments()
      .then(queueDocuments)
      .catch(error => showToast(error instanceof Error ? error.message : 'Could not open the document picker. Please try again.'));
  };

  const addDemoDocument = (fileName: string, category: SelectedBusinessDocument['category']) => {
    if (!session?.isDemo) {
      return;
    }
    queueDocuments([
      {
        id: `demo-file-${Date.now()}`,
        name: fileName,
        uri: `demo://${fileName}`,
        mimeType: category === 'Customer sheet' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
        size: null,
        category,
        status: 'Selected locally',
        isDemoSample: true,
      },
    ]);
  };

  const registerOwner = async (form: RegistrationForm) => {
    try {
      const registration = await gatewayApi.auth.register(form);
      resetForNewWorkspace();
      setPendingRegistration(form);
      setStage('verifyEmail');
      showToast(registration.developmentVerificationCode
        ? `Local development verification code: ${registration.developmentVerificationCode}`
        : 'We sent a verification code to your work email.');
    } catch (error) {
      // A real owner can safely resume an interrupted registration after an
      // app restart. The backend keeps the account pending until its email is
      // verified, so asking it for a new code is safer than asking the owner
      // to start over or exposing whether another account exists.
      if (error instanceof GatewayRequestError
        && error.status === 409
        && error.responseBody.includes('EMAIL_ALREADY_REGISTERED')) {
        try {
          await gatewayApi.auth.resendVerification(form.email);
          resetForNewWorkspace();
          setPendingRegistration(form);
          setStage('verifyEmail');
          showToast('Your registration is waiting for verification. We sent a fresh code to your work email.');
          return;
        } catch (resendError) {
          if (resendError instanceof GatewayRequestError
            && resendError.status === 409
            && resendError.responseBody.includes('EMAIL_ALREADY_VERIFIED')) {
            setStage('signIn');
            showToast('This email is already verified. Please sign in with your password.');
            return;
          }
          showToast(resendError instanceof Error
            ? resendError.message
            : 'We could not send a new verification code. Please try again.');
          return;
        }
      }
      const message = error instanceof Error ? error.message : 'Your account could not be created. Please try again.';
      showToast(message);
      // Onboarding is rendered before the signed-in app shell, where toasts
      // normally appear. Propagate this failure to the visible form as well.
      throw new Error(message);
    }
  };

  const completeEmailVerification = async (code: string): Promise<void> => {
    if (!pendingRegistration) {
      setStage('register');
      throw new Error('Your registration details are no longer available. Please register again.');
    }
    try {
      const authenticated = await gatewayApi.auth.verifyEmail(pendingRegistration.email, code);
      setLiveAccessToken(authenticated.accessToken);
      await saveRefreshSession(authenticated);
      setSession({
        userId: authenticated.user.id,
        workspaceId: '',
        ownerName: authenticated.user.fullName,
        businessName: pendingRegistration.businessName,
        isDemo: false,
      });
      setStage('businessSetup');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The verification code could not be accepted.';
      showToast(message);
      throw new Error(message);
    }
  };

  const completeBusinessSetup = async ({businessName, goal}: {businessName: string; goal: string}) => {
    setOnboardingError(null);
    if (!pendingRegistration || !accessTokenRef.current) {
      const message = 'Please register and verify your email before creating a workspace.';
      setOnboardingError(message);
      showToast(message);
      setStage('register');
      return;
    }
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const workspace = await gatewayApi.workspace.create({
        businessName,
        industry: pendingRegistration.industry,
        businessDescription: goal,
        timezone,
      });
      const user = await gatewayApi.auth.currentUser();
      const currentAuth: GatewayAuthSession = {
        accessToken: accessTokenRef.current,
        tokenType: 'Bearer',
        accessTokenExpiresAt: '',
        refreshToken: '',
        refreshTokenExpiresAt: '',
        user,
      };
      await hydrateLiveWorkspace(currentAuth, workspace);
      setPendingRegistration(null);
      setStage('jarvisIntro');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Your workspace could not be created. Please try again.';
      setOnboardingError(message);
      showToast(message);
    }
  };

  const completeSignIn = async (email: string, password: string) => {
    let authenticated: GatewayAuthSession | null = null;
    try {
      authenticated = await gatewayApi.auth.signIn(email, password);
      setLiveAccessToken(authenticated.accessToken);
      await saveRefreshSession(authenticated);
      const workspace = await gatewayApi.workspace.current();
      await hydrateLiveWorkspace(authenticated, workspace);
      setStage('workspace');
    } catch (error) {
      if (authenticated && error instanceof GatewayRequestError && error.status === 404) {
        setPendingRegistration({
          fullName: authenticated.user.fullName,
          businessName: '',
          email: authenticated.user.email,
          mobile: authenticated.user.mobileNumber,
          password: '',
          industry: '',
          goal: 'Generate more qualified leads',
        });
        setSession({
          userId: authenticated.user.id,
          workspaceId: '',
          ownerName: authenticated.user.fullName,
          businessName: 'your business',
          isDemo: false,
        });
        setOnboardingError('Your email is verified. Add your business name to finish creating the workspace.');
        setStage('businessSetup');
      } else {
        showToast(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
      }
    }
  };

  const createAgentRun = (prompt: string, selectedAgent?: SalesAgent) => {
    if (!prompt.trim()) {
      return;
    }

    if (!session?.isDemo) {
      gatewayApi.jarvis.createTask({
        title: selectedAgent ? `${selectedAgent.name} direct brief` : undefined,
        prompt: prompt.trim(),
      }).then(task => {
        const run = taskToRun(task);
        setAgentRuns(current => [run, ...current.filter(item => item.id !== run.id)]);
        if (task.status === 'BLOCKED_CONFIGURATION') {
          showToast(task.failureDetail ?? 'Jarvis is waiting for the Meta Model configuration.');
          return;
        }
        if (task.status === 'FAILED') {
          setAgents(current => current.map(agent => agent.id === 'jarvis'
            ? {...agent, status: 'Ready', currentTask: 'Waiting for your next brief'}
            : agent));
          showToast(task.failureDetail ?? 'Jarvis could not prepare this plan. Please try again.');
          return;
        }
        setAgents(current => current.map(agent => agent.id === 'jarvis'
          ? {...agent, status: task.status === 'AWAITING_OWNER_REVIEW' ? 'Waiting for review' : 'Working', currentTask: run.title}
          : agent));
        showToast(task.status === 'AWAITING_OWNER_REVIEW'
          ? 'Jarvis prepared a plan for your review.'
          : 'Jarvis received your brief.');
        gatewayApi.notifications.list({size: 50})
          .then(page => setAlerts(page.content.map(notificationToAlert)))
          .catch(() => undefined);
      }).catch(error => showToast(error instanceof Error ? error.message : 'Jarvis could not create the task.'));
      return;
    }

    localTomanApi.jarvis.createRun({
      prompt: prompt.trim(),
      createdBy: selectedAgent ? 'Owner' : 'Jarvis',
    }).then(run => {
      const nextRun: AgentRun = selectedAgent
        ? {
            ...run,
            title: `${selectedAgent.name} direct brief`,
            assignedAgentIds: ['jarvis', selectedAgent.id],
            createdBy: 'Owner',
            output: `${selectedAgent.name} received your brief. Jarvis is keeping the handoff and approval trail together.`,
          }
        : run;
      setAgentRuns(current => [nextRun, ...current]);
      setAgents(current =>
        current.map(agent =>
          nextRun.assignedAgentIds.includes(agent.id)
            ? {...agent, status: 'Working', currentTask: nextRun.title}
            : agent,
        ),
      );
      setAlerts(current => [
        {
          id: `alert-run-${nextRun.id}`,
          title: `${nextRun.title} is ready for review`,
          detail: nextRun.output,
          time: 'Just now',
          kind: 'review',
          unread: true,
        },
        ...current,
      ]);
      showToast(selectedAgent ? `${selectedAgent.name} received your direct brief` : 'Jarvis delegated your request to the right agents');
    }).catch(() => showToast('Jarvis could not start that local task. Please try again.'));
  };

  const connectSandboxIntegration = (integration: Integration) => {
    if (!session?.isDemo) {
      showToast(`${integration.provider} connection will be available after secure OAuth is enabled in the integration service.`);
      return;
    }

    localTomanApi.integrations.beginSecureConnection(integration).then(updated => {
      setIntegrations(current => current.map(item => (item.id === updated.id ? updated : item)));
      setAlerts(current => [
        {
          id: `alert-integration-${updated.id}`,
          title: `${updated.provider} sandbox connection prepared`,
          detail: 'OAuth and real provider access remain backend-owned. No external account was connected.',
          time: 'Just now',
          kind: 'insight',
          unread: true,
        },
        ...current,
      ]);
      showToast(`${updated.provider} is ready in the local sandbox`);
    }).catch(() => showToast(`The ${integration.provider} sandbox could not be prepared.`));
  };

  const logout = () => {
    if (session?.isDemo) {
      localTomanApi.auth.logout().catch(() => undefined);
    } else {
      gatewayApi.auth.logout().catch(() => undefined);
      clearLiveSession().catch(() => undefined);
    }
    setSession(null);
    resetForNewWorkspace();
    setDetail(null);
    setActiveTab('Home');
    setStage('welcome');
  };

  const openRecordingDemo = () => {
    clearLiveSession().catch(() => undefined);
    resetForNewWorkspace();
    localTomanApi.auth.signIn('', '').then(demoSession => {
      setSession(demoSession);
      setCampaigns(demoCampaigns.map(campaign => ({...campaign})));
      setLeads(demoLeads.map(lead => ({...lead})));
      setAlerts(demoAlerts.map(alert => ({...alert})));
      setAgents(demoAgents.map(agent => ({...agent})));
      setAgentRuns(demoAgentRuns.map(run => ({...run, assignedAgentIds: [...run.assignedAgentIds]})));
      setIntegrations(demoIntegrations.map(integration => ({...integration})));
      setMetrics({...demoWorkspaceMetrics});
      setDetail(null);
      setShowUpload(false);
      setActiveTab('Home');
      setStage('workspace');
      showToast('Jarvis is online and ready to help.');
      setTimeout(() => speakRecordingWelcome().catch(() => undefined), 450);
    }).catch(() => showToast('The recording demo could not be opened. Please try again.'));
  };

  if (stage === 'welcome') {
    return <WelcomeScreen onDemo={openRecordingDemo} onRegister={() => setStage('register')} onSignIn={() => setStage('signIn')} />;
  }

  if (stage === 'register') {
    return <RegistrationScreen onBack={() => setStage('welcome')} onContinue={registerOwner} />;
  }

  if (stage === 'verifyEmail') {
    return (
      <EmailVerificationScreen
        email={pendingRegistration?.email ?? ''}
        onBack={() => setStage('register')}
        onVerify={completeEmailVerification}
        onResend={() => {
          if (!pendingRegistration) {
            return Promise.reject(new Error('Your registration details are no longer available. Please register again.'));
          }
          return gatewayApi.auth.resendVerification(pendingRegistration.email)
            .then(() => showToast('A new verification code was sent to your work email.'));
        }}
      />
    );
  }

  if (stage === 'signIn') {
    return <LoginScreen onAuthenticated={completeSignIn} onBack={() => setStage('welcome')} onDemo={openRecordingDemo} />;
  }

  if (stage === 'businessSetup') {
    return (
      <BusinessSetupScreen
        ownerName={session?.ownerName ?? 'Business owner'}
        businessName={session?.businessName ?? 'Your business'}
        error={onboardingError}
        onBack={() => setStage('register')}
        onContinue={completeBusinessSetup}
      />
    );
  }

  if (stage === 'jarvisIntro') {
    return (
      <JarvisIntroductionScreen
        ownerName={session?.ownerName ?? 'Business owner'}
        businessName={session?.businessName ?? 'your business'}
        onContinue={() => setStage('workspace')}
      />
    );
  }

  if (detail?.kind === 'lead') {
    return (
      <AppShell activeTab={activeTab} onTabChange={setActiveTab} unreadCount={alerts.filter(item => item.unread).length}>
        <LeadDetailScreen
          lead={detail.lead}
          onBack={() => setDetail(null)}
          onCreateCampaign={() => {
            setDetail(null);
            setActiveTab('Jarvis');
          }}
        />
        {toast ? <Toast message={toast} /> : null}
      </AppShell>
    );
  }

  if (detail?.kind === 'campaign') {
    const currentCampaign = campaigns.find(item => item.id === detail.campaign.id) ?? detail.campaign;
    return (
      <AppShell activeTab={activeTab} onTabChange={setActiveTab} unreadCount={alerts.filter(item => item.unread).length}>
        <CampaignReviewScreen
          campaign={currentCampaign}
          onBack={() => setDetail(null)}
          onApprove={() => approveCampaign(currentCampaign.id)}
          onRevise={() => {
            setDetail(null);
            setActiveTab('Jarvis');
            showToast('Jarvis is ready to revise this campaign');
          }}
        />
        {toast ? <Toast message={toast} /> : null}
      </AppShell>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.app}>
        <View style={styles.appBody}>
          {activeTab === 'Home' ? (
            <DashboardScreen
              metrics={metrics}
              leads={leads}
              alerts={alerts}
              agentRuns={agentRuns}
              campaigns={campaigns}
              unreadCount={alerts.filter(item => item.unread).length}
              ownerName={session?.ownerName ?? 'Business owner'}
              workspaceName={session?.businessName ?? 'Your business'}
              isDemo={session?.isDemo ?? false}
              onOpenJarvis={() => setActiveTab('Jarvis')}
              onOpenApproval={() => goToCampaign()}
              onOpenAlerts={() => setActiveTab('Alerts')}
              onOpenCampaigns={() => setActiveTab('Campaigns')}
              onOpenAgents={() => setActiveTab('Agents')}
              onOpenSettings={() => setActiveTab('Settings')}
            />
          ) : null}
          {activeTab === 'Leads' ? (
            <LeadsScreen
              leads={leads}
              workspaceName={session?.businessName ?? 'your workspace'}
              onOpenLead={lead => setDetail({kind: 'lead', lead})}
              onOpenJarvis={() => setActiveTab('Jarvis')}
              onUpload={() => setShowUpload(true)}
            />
          ) : null}
          {activeTab === 'Jarvis' ? (
            <JarvisScreen
              workspaceName={session?.businessName ?? 'your business'}
              isDemo={session?.isDemo ?? false}
              hasBusinessData={Boolean(leads.length || documents.length)}
              onReviewCampaign={() => goToCampaign()}
              onUpload={() => setShowUpload(true)}
              onDelegateTask={createAgentRun}
              onCampaignCreated={() => {
                if (!session?.isDemo) {
                  showToast('Jarvis is submitting your brief to the Meta workflow.');
                  return;
                }
                setCampaigns(current => {
                  if (current.some(item => item.id === 'campaign-jarvis')) {
                    return current;
                  }
                  return [
                    {
                      id: 'campaign-jarvis',
                      title: 'High-intent consultation follow-up',
                      status: 'Needs approval',
                      audience: '12 hot leads',
                      channel: 'Email',
                      expectedOutcome: '4–6 consultation requests',
                      scheduledFor: 'Tomorrow, 12:00 PM',
                      description: 'A focused follow-up for leads who asked product or pricing questions.',
                      message:
                        'Hi {{first_name}}, I noticed you were exploring Luma Living. I can reserve a short design consultation and share the most relevant pieces for your space.',
                      why:
                        'These leads have a score above 85 and showed intent in the last seven days.',
                      progress: 'Ready for owner review',
                      color: Colors.amber,
                    },
                    ...current,
                  ];
                });
                showToast('Jarvis created a campaign proposal for your review');
              }}
            />
          ) : null}
          {activeTab === 'Agents' ? (
            <AgentsScreen
              agents={agents}
              integrations={integrations}
              runs={agentRuns}
              onConnectIntegration={connectSandboxIntegration}
              onCreateDirectTask={createAgentRun}
              onOpenCampaign={() => goToCampaign()}
              onOpenUpload={() => setShowUpload(true)}
              documents={documents}
              isDemo={session?.isDemo ?? false}
              onLogout={logout}
            />
          ) : null}
          {activeTab === 'Campaigns' ? (
            <CampaignsScreen
              campaigns={campaigns}
              onOpenCampaign={campaign => setDetail({kind: 'campaign', campaign})}
              onOpenJarvis={() => setActiveTab('Jarvis')}
            />
          ) : null}
          {activeTab === 'Alerts' ? (
            <AlertsScreen
              alerts={alerts}
              onOpenLead={leads[0] ? () => setDetail({kind: 'lead', lead: leads[0]}) : undefined}
              onOpenCampaign={() => goToCampaign()}
              onRead={alertId => {
                if (session?.isDemo) {
                  setAlerts(current => current.map(alert => alert.id === alertId ? {...alert, unread: false} : alert));
                  return;
                }
                gatewayApi.notifications.markRead(alertId)
                  .then(updated => setAlerts(current => current.map(alert => alert.id === updated.id ? notificationToAlert(updated) : alert)))
                  .catch(error => showToast(error instanceof Error ? error.message : 'Could not mark the notification as read.'));
              }}
            />
          ) : null}
          {activeTab === 'Settings' ? (
            <SettingsScreen
              session={session}
              preferences={notificationPreferences}
              documents={documents}
              onBack={() => setActiveTab('Home')}
              onOpenUpload={() => setShowUpload(true)}
              onSaveProfile={(ownerName, businessName) => {
                if (session?.isDemo) {
                  setSession(current => current ? {...current, ownerName, businessName} : current);
                  showToast('Demo workspace settings saved locally');
                  return;
                }
                if (!gatewaySettings) {
                  showToast('Workspace settings are still loading. Please try again.');
                  return;
                }
                gatewayApi.settings.update({
                  businessName,
                  industry: gatewaySettings.industry ?? undefined,
                  businessDescription: gatewaySettings.businessDescription ?? undefined,
                  timezone: gatewaySettings.timezone,
                  reviewNotificationsEnabled: notificationPreferences.reviews,
                  permissionNotificationsEnabled: notificationPreferences.permissions,
                  completedTaskNotificationsEnabled: notificationPreferences.completedTasks,
                  newLeadNotificationsEnabled: notificationPreferences.newLeads,
                }).then(updated => {
                  applyGatewaySettings(updated);
                  showToast('Business settings saved securely.');
                }).catch(error => showToast(error instanceof Error ? error.message : 'Could not save business settings.'));
              }}
              onTogglePreference={key => {
                const next = {...notificationPreferences, [key]: !notificationPreferences[key]};
                setNotificationPreferences(next);
                if (session?.isDemo || !gatewaySettings) {
                  return;
                }
                gatewayApi.settings.update({
                  businessName: gatewaySettings.businessName,
                  industry: gatewaySettings.industry ?? undefined,
                  businessDescription: gatewaySettings.businessDescription ?? undefined,
                  timezone: gatewaySettings.timezone,
                  reviewNotificationsEnabled: next.reviews,
                  permissionNotificationsEnabled: next.permissions,
                  completedTaskNotificationsEnabled: next.completedTasks,
                  newLeadNotificationsEnabled: next.newLeads,
                }).then(applyGatewaySettings).catch(error => {
                  setNotificationPreferences(notificationPreferences);
                  showToast(error instanceof Error ? error.message : 'Could not update notification settings.');
                });
              }}
              onLogout={logout}
            />
          ) : null}
        </View>

        <BottomTabs activeTab={activeTab} onTabChange={setActiveTab} unreadCount={alerts.filter(item => item.unread).length} />
        <UploadModal
          visible={showUpload}
          isDemo={session?.isDemo ?? false}
          onClose={() => setShowUpload(false)}
          onPickFromDevice={pickDocumentsFromDevice}
          onAddDemoDocument={addDemoDocument}
        />
        {toast ? <Toast message={toast} /> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  unreadCount: number;
}

function AppShell({children, activeTab, onTabChange, unreadCount}: AppShellProps) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView edges={['top']} style={styles.app}>
        <View style={styles.appBody}>{children}</View>
        <BottomTabs activeTab={activeTab} onTabChange={onTabChange} unreadCount={unreadCount} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OnboardingFrame({children}: {children: React.ReactNode}) {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.onboardingSafe}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OnboardingBrand({step}: {step?: string}) {
  return (
    <View style={styles.onboardingBrandRow}>
      <View style={styles.logoMark}>
        <Text style={styles.logoSpark}>✦</Text>
      </View>
      <View>
        <Text style={styles.onboardingBrand}>TOMAN</Text>
        {step ? <Text style={styles.onboardingStep}>{step}</Text> : null}
      </View>
    </View>
  );
}

function WelcomeScreen({
  onDemo,
  onRegister,
  onSignIn,
}: {
  onDemo: () => void;
  onRegister: () => void;
  onSignIn: () => void;
}) {
  return (
    <OnboardingFrame>
      <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.loginGlowOne} />
        <View style={styles.loginGlowTwo} />
        <OnboardingBrand step="AI SALES COMMAND CENTER" />

        <View style={styles.welcomeHero}>
          <Pill label="YOUR AI SALES MANAGER" tone="violet" />
          <Text style={styles.welcomeTitle}>Make every sales signal count.</Text>
          <Text style={styles.welcomeCopy}>
            TOMAN helps you turn customer data, ideas, and business knowledge into thoughtful campaigns — with Jarvis and a specialized agent team.
          </Text>
        </View>

        <View style={styles.welcomeJourney}>
          <JourneyPoint icon="1" title="Tell us about your business" copy="Set up your owner profile and sales focus." />
          <JourneyPoint icon="2" title="Meet Jarvis" copy="Learn how your AI sales manager works with you." />
          <JourneyPoint icon="3" title="Review before anything goes live" copy="You keep control of content, audiences, budgets, and posting." />
        </View>

        <TomanButton label="Start your workspace" onPress={onRegister} testID="welcome-register" icon="→" style={styles.welcomePrimaryButton} />
        <TomanButton label="Open interactive demo" onPress={onDemo} testID="welcome-demo" icon="▶" variant="secondary" style={styles.welcomeSecondaryButton} />
        <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.welcomeSignIn} testID="welcome-sign-in">
          <Text style={styles.welcomeSignInText}>Already have an account? <Text style={styles.welcomeSignInLink}>Sign in</Text></Text>
        </Pressable>
        <Text style={styles.welcomeSafety}>
          TOMAN keeps all business activity under owner control. Provider connections and publishing require the relevant secure authorization before anything goes live.
        </Text>
      </ScrollView>
    </OnboardingFrame>
  );
}

function JourneyPoint({icon, title, copy}: {icon: string; title: string; copy: string}) {
  return (
    <View style={styles.journeyPoint}>
      <View style={styles.journeyNumber}><Text style={styles.journeyNumberText}>{icon}</Text></View>
      <View style={styles.journeyBody}>
        <Text style={styles.journeyTitle}>{title}</Text>
        <Text style={styles.journeyCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function RegistrationScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (form: RegistrationForm) => Promise<void>;
}) {
  const [form, setForm] = useState<RegistrationForm>(emptyRegistration);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestLock = useRef(false);

  const update = <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm(current => ({...current, [key]: value}));
    setError('');
  };

  const submit = async () => {
    if (requestLock.current || submitting) {
      return;
    }
    const normalizedMobile = form.mobile.replace(/[\s()-]/g, '');
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    const looksLikeMobile = /^\+?[1-9][0-9]{7,14}$/.test(normalizedMobile);
    const strongPassword = form.password.length >= 10 && /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) && /\d/.test(form.password);
    if (!form.fullName.trim() || !form.businessName.trim() || !looksLikeEmail || !looksLikeMobile || !strongPassword) {
      setError('Add your name, business, a valid work email, an E.164-style mobile number, and a 10+ character password with upper-case, lower-case, and a number.');
      return;
    }
    requestLock.current = true;
    setSubmitting(true);
    try {
      await onContinue(form);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Your account could not be created. Please try again.');
    } finally {
      requestLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <OnboardingFrame>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.onboardingKeyboard}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.onboardingBack}><Text style={styles.onboardingBackText}>‹ Back</Text></Pressable>
          <OnboardingBrand step="STEP 1 OF 3" />
          <Text style={styles.formTitle}>Create your owner workspace.</Text>
          <Text style={styles.formCopy}>We will use this information to personalize Jarvis. TOMAN verifies your work email before it opens a real business workspace.</Text>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>YOUR NAME</Text>
            <TextInput autoCapitalize="words" onChangeText={value => update('fullName', value)} placeholder="e.g. Arjun Nair" placeholderTextColor={Colors.subtle} style={styles.input} testID="register-name" value={form.fullName} />
            <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
            <TextInput autoCapitalize="words" onChangeText={value => update('businessName', value)} placeholder="e.g. Luma Living" placeholderTextColor={Colors.subtle} style={styles.input} testID="register-business" value={form.businessName} />
            <Text style={styles.fieldLabel}>WORK EMAIL</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" onChangeText={value => update('email', value)} placeholder="you@business.com" placeholderTextColor={Colors.subtle} style={styles.input} testID="register-email" value={form.email} />
            <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
            <TextInput keyboardType="phone-pad" onChangeText={value => update('mobile', value)} placeholder="+91 98765 43210" placeholderTextColor={Colors.subtle} style={styles.input} testID="register-mobile" value={form.mobile} />
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput autoCapitalize="none" onChangeText={value => update('password', value)} placeholder="At least 10 characters" placeholderTextColor={Colors.subtle} secureTextEntry style={styles.input} testID="register-password" value={form.password} />
            <Text style={styles.registrationHint}>Password needs 10+ characters, an upper-case letter, a lower-case letter, and a number.</Text>
            {error ? <Text style={styles.loginError}>{error}</Text> : null}
            <TomanButton disabled={submitting} label={submitting ? 'Creating your account…' : 'Continue to business setup'} onPress={submit} testID="register-continue" icon="→" style={styles.formButton} />
          </View>
          <Text style={styles.onboardingFinePrint}>Your password is sent only to the Auth service over the configured gateway. TOMAN stores no password or Meta key in this app.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingFrame>
  );
}

function EmailVerificationScreen({
  email,
  onBack,
  onVerify,
  onResend,
}: {
  email: string;
  onBack: () => void;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const requestLock = useRef(false);

  const verify = async () => {
    if (requestLock.current || submitting || resending) {
      return;
    }
    if (!/^\d{3,10}$/.test(code.trim())) {
      setError('Enter the numeric code from your work email.');
      return;
    }
    setError('');
    requestLock.current = true;
    setSubmitting(true);
    try {
      await onVerify(code.trim());
    } catch (verificationError) {
      setError(verificationError instanceof Error
        ? verificationError.message
        : 'The verification code could not be accepted.');
    } finally {
      requestLock.current = false;
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (requestLock.current || submitting || resending) {
      return;
    }
    requestLock.current = true;
    setResending(true);
    setError('');
    try {
      await onResend();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the verification code.');
    } finally {
      requestLock.current = false;
      setResending(false);
    }
  };

  return (
    <OnboardingFrame>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.onboardingKeyboard}>
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.onboardingBack}><Text style={styles.onboardingBackText}>‹ Back</Text></Pressable>
          <OnboardingBrand step="VERIFY YOUR EMAIL" />
          <Text style={styles.formTitle}>Confirm it’s you.</Text>
          <Text style={styles.formCopy}>Enter the verification code sent to {email || 'your work email'} before creating your TOMAN workspace.</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
            <TextInput
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={10}
              editable={!submitting && !resending}
              onChangeText={value => {
                setCode(value);
                setError('');
              }}
              placeholder="6-digit code"
              placeholderTextColor={Colors.subtle}
              style={styles.input}
              testID="verify-email-code"
              value={code}
            />
            {error ? <Text style={styles.loginError}>{error}</Text> : null}
            {submitting || resending ? (
              <View accessibilityLiveRegion="polite" style={styles.verificationProgress}>
                <ActivityIndicator color={Colors.violet} size="small" />
                <Text style={styles.verificationProgressText}>{submitting ? 'Jarvis is securely checking your code…' : 'Sending a fresh verification code…'}</Text>
              </View>
            ) : null}
            <TomanButton
              disabled={submitting || resending}
              icon="✓"
              label={submitting ? 'Verifying…' : 'Verify and continue'}
              onPress={verify}
              style={styles.formButton}
              testID="verify-email-submit"
            />
            <TomanButton
              disabled={submitting || resending}
              label={resending ? 'Sending code…' : 'Resend code'}
              onPress={resend}
              style={styles.formButton}
              testID="verify-email-resend"
              variant="ghost"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </OnboardingFrame>
  );
}

function BusinessSetupScreen({
  ownerName,
  businessName,
  error,
  onBack,
  onContinue,
}: {
  ownerName: string;
  businessName: string;
  error: string | null;
  onBack: () => void;
  onContinue: (input: {businessName: string; goal: string}) => Promise<void>;
}) {
  const [focus, setFocus] = useState('Generate more qualified leads');
  const [selected, setSelected] = useState<string[]>(['Customer data']);
  const [workspaceName, setWorkspaceName] = useState(businessName === 'your business' ? '' : businessName);
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestLock = useRef(false);
  const options = ['Customer data', 'Business brochure', 'Social channels'];
  const toggle = (option: string) => setSelected(current => current.includes(option) ? current.filter(item => item !== option) : [...current, option]);
  const submit = async () => {
    if (requestLock.current || submitting) {
      return;
    }
    if (!workspaceName.trim()) {
      setFieldError('Enter your business name before continuing.');
      return;
    }
    setFieldError('');
    requestLock.current = true;
    setSubmitting(true);
    try {
      await onContinue({businessName: workspaceName.trim(), goal: focus});
    } finally {
      requestLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <OnboardingFrame>
      <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.onboardingBack}><Text style={styles.onboardingBackText}>‹ Back</Text></Pressable>
        <OnboardingBrand step="STEP 2 OF 3" />
        <Text style={styles.formTitle}>Set the first sales focus.</Text>
        <Text style={styles.formCopy}>Hi {ownerName.split(' ')[0]}. Jarvis will start with a safe plan for {workspaceName || 'your business'}, then your team can add data and channels whenever you are ready.</Text>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
          <TextInput autoCapitalize="words" onChangeText={setWorkspaceName} placeholder="e.g. Cornerrock" placeholderTextColor={Colors.subtle} style={styles.input} testID="setup-business-name" value={workspaceName} />
          <Text style={styles.fieldLabel}>PRIMARY GOAL</Text>
          {['Generate more qualified leads', 'Re-engage existing customers', 'Launch a new offer'].map(option => (
            <Pressable accessibilityRole="button" key={option} onPress={() => setFocus(option)} style={[styles.choiceRow, focus === option && styles.choiceRowActive]}>
              <View style={[styles.choiceRadio, focus === option && styles.choiceRadioActive]}>{focus === option ? <View style={styles.choiceRadioDot} /> : null}</View>
              <Text style={[styles.choiceText, focus === option && styles.choiceTextActive]}>{option}</Text>
            </Pressable>
          ))}
          <Text style={[styles.fieldLabel, styles.setupDataLabel]}>WHAT WOULD YOU LIKE TO PREPARE?</Text>
          {options.map(option => (
            <Pressable accessibilityRole="button" key={option} onPress={() => toggle(option)} style={[styles.choiceRow, selected.includes(option) && styles.choiceRowActive]}>
              <View style={[styles.choiceCheck, selected.includes(option) && styles.choiceCheckActive]}><Text style={styles.choiceCheckText}>{selected.includes(option) ? '✓' : ''}</Text></View>
              <Text style={[styles.choiceText, selected.includes(option) && styles.choiceTextActive]}>{option}</Text>
            </Pressable>
          ))}
          <View style={styles.setupHint}>
            <Text style={styles.setupHintIcon}>✦</Text>
            <Text style={styles.setupHintText}>You can securely add PDFs, spreadsheets, social accounts, and campaign channels from the workspace. They remain sandbox-only in this build.</Text>
          </View>
          {fieldError || error ? <Text accessibilityLiveRegion="polite" style={styles.loginError}>{fieldError || error}</Text> : null}
          <TomanButton disabled={submitting} label={submitting ? 'Creating your workspace…' : 'Meet Jarvis'} onPress={submit} testID="setup-continue" icon="✦" style={styles.formButton} />
        </View>
      </ScrollView>
    </OnboardingFrame>
  );
}

function JarvisIntroductionScreen({
  ownerName,
  businessName,
  onContinue,
}: {
  ownerName: string;
  businessName: string;
  onContinue: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [line, setLine] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const script = useMemo(() => [
    `Hi ${ownerName.split(' ')[0]}, I’m Jarvis — your AI sales manager.`,
    `I will turn ${businessName} insights into clear sales opportunities.`,
    'I delegate work to specialists, but I never send, post, call, or spend without your review.',
  ], [ownerName, businessName]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1.08, duration: 900, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 1, duration: 900, useNativeDriver: true}),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const speakLine = useCallback(async (nextLine: number) => {
    try {
      if (playbackTimer.current) {
        clearTimeout(playbackTimer.current);
        playbackTimer.current = null;
      }
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage('en-US');
      const availableVoices = await Tts.voices();
      const strongestEnglishVoice = availableVoices
        .filter(voice => !voice.notInstalled && voice.language.toLowerCase().startsWith('en'))
        .sort((left, right) => {
          const leftUs = left.language.toLowerCase() === 'en-us' ? 1 : 0;
          const rightUs = right.language.toLowerCase() === 'en-us' ? 1 : 0;
          return rightUs - leftUs || right.quality - left.quality || left.latency - right.latency;
        })[0];
      if (strongestEnglishVoice) {
        await Tts.setDefaultVoice(strongestEnglishVoice.id);
      }
      await Tts.setDefaultPitch(0.82);
      await Tts.setDefaultRate(0.44, true);
      await Tts.stop();
      setVoiceError('');
      setLine(nextLine);
      setIsPlaying(true);
      Tts.speak(script[nextLine]);
      // Some Android TTS engines do not implement the React Native listener
      // bridge consistently. Keep playback state local so an unavailable
      // native event method can never crash the introduction screen.
      playbackTimer.current = setTimeout(() => {
        setIsPlaying(false);
        playbackTimer.current = null;
      }, Math.max(2600, script[nextLine].length * 58));
    } catch {
      setIsPlaying(false);
      setVoiceError('Voice is unavailable on this device. You can still read Jarvis’s introduction.');
    }
  }, [script]);

  useEffect(() => {
    speakLine(0).catch(() => undefined);

    return () => {
      if (playbackTimer.current) {
        clearTimeout(playbackTimer.current);
        playbackTimer.current = null;
      }
      Tts.stop().catch(() => undefined);
    };
  }, [speakLine]);

  const playPreview = () => {
    const nextLine = isPlaying ? (line + 1) % script.length : line;
    speakLine(nextLine).catch(() => undefined);
  };

  return (
    <OnboardingFrame>
      <ScrollView contentContainerStyle={styles.jarvisIntroScroll} showsVerticalScrollIndicator={false}>
        <OnboardingBrand step="STEP 3 OF 3" />
        <Pill label="MEET YOUR AI SALES MANAGER" tone="violet" style={styles.introPill} />
        <Animated.View style={[styles.jarvisIntroOrbOuter, {transform: [{scale: pulse}]}]}>
          <View style={styles.jarvisIntroOrbMiddle}>
            <View style={styles.jarvisIntroOrb}><Text style={styles.jarvisIntroOrbText}>✦</Text></View>
          </View>
        </Animated.View>
        <Text style={styles.introName}>Jarvis</Text>
        <StatusDot color={isPlaying ? Colors.green : Colors.violet} label={isPlaying ? 'Jarvis is speaking' : voiceError ? 'Voice unavailable' : 'Ready to introduce itself'} />
        <View style={styles.introTranscript}>
          <Text style={styles.introTranscriptLabel}>JARVIS SAYS</Text>
          <Text style={styles.introTranscriptText}>{script[line]}</Text>
        </View>
        <TomanButton label={isPlaying ? 'Play next line' : 'Replay Jarvis'} onPress={playPreview} testID="jarvis-play-intro" variant="secondary" icon="▶" style={styles.introPlayButton} />
        <Text style={styles.introVoiceNote}>{voiceError || 'Jarvis speaks through your device’s built-in text-to-speech voice. Use Replay Jarvis to hear the introduction again.'}</Text>
        <View style={styles.introPromises}>
          <IntroPromise icon="◌" text="You can ask Jarvis, or brief any specialist directly." />
          <IntroPromise icon="✓" text="Every campaign, message, call, creative, schedule, and post comes back to you for review." />
          <IntroPromise icon="↗" text="Jarvis shows the work, the reasoning, and the business result in one place." />
        </View>
        <TomanButton label="Open my command center" onPress={onContinue} testID="intro-continue" icon="→" style={styles.introContinueButton} />
      </ScrollView>
    </OnboardingFrame>
  );
}

function IntroPromise({icon, text}: {icon: string; text: string}) {
  return (
    <View style={styles.introPromise}>
      <Text style={styles.introPromiseIcon}>{icon}</Text>
      <Text style={styles.introPromiseText}>{text}</Text>
    </View>
  );
}

function LoginScreen({
  onAuthenticated,
  onBack,
  onDemo,
}: {
  onAuthenticated: (email: string, password: string) => Promise<void>;
  onBack: () => void;
  onDemo: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestLock = useRef(false);

  const submit = async () => {
    if (requestLock.current || submitting) {
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your TOMAN work email and password.');
      return;
    }

    setError('');
    requestLock.current = true;
    setSubmitting(true);
    try {
      await onAuthenticated(email.trim(), password);
    } finally {
      requestLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.loginSafe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginKeyboard}>
          <ScrollView contentContainerStyle={styles.loginScroll} keyboardShouldPersistTaps="always">
            <View style={styles.loginGlowOne} />
            <View style={styles.loginGlowTwo} />
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.loginBack}>
              <Text style={styles.loginBackText}>‹ Back</Text>
            </Pressable>
            <View style={styles.loginTop}>
              <View style={styles.logoMark}>
                <Text style={styles.logoSpark}>✦</Text>
              </View>
              <Text style={styles.logoText}>TOMAN</Text>
              <Pill label="SECURE SIGN IN" tone="violet" style={styles.demoPill} />
            </View>

            <View style={styles.loginHero}>
              <Text style={styles.loginTitle}>Your AI sales{'\n'}command center.</Text>
              <Text style={styles.loginSubtitle}>
                Find the right lead, approve the right action, and let Jarvis make every sales moment count.
              </Text>
            </View>

            <View style={styles.loginCard}>
              <View style={styles.loginCardHeading}>
                <Text style={styles.loginCardTitle}>Sign in to TOMAN</Text>
                <StatusDot label="Gateway session" />
              </View>
              <Text style={styles.loginCardCopy}>
                Sign in with the account you verified during onboarding. Your access token stays in memory; only the rotating refresh session is kept in the native secure keystore.
              </Text>

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={text => {
                  setEmail(text);
                  setError('');
                }}
                placeholder="you@business.com"
                placeholderTextColor={Colors.subtle}
                style={styles.input}
                testID="login-email"
                value={email}
              />
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={text => {
                  setPassword(text);
                  setError('');
                }}
                placeholder="Your password"
                placeholderTextColor={Colors.subtle}
                secureTextEntry
                style={styles.input}
                testID="login-password"
                value={password}
              />
              {error ? <Text style={styles.loginError}>{error}</Text> : null}
              <TomanButton
                label={submitting ? 'Opening workspace…' : 'Sign in securely'}
                onPress={submit}
                testID="login-submit"
                icon="✦"
                disabled={submitting}
                style={styles.loginButton}
              />
              <TomanButton
                label="Open interactive demo"
                onPress={onDemo}
                testID="login-demo"
                icon="▶"
                variant="secondary"
                style={styles.welcomeSecondaryButton}
              />
              <Text style={styles.loginFootnote}>If your email is already verified but you have not created a workspace, TOMAN will take you back to business setup.</Text>
            </View>

            <Text style={styles.loginFootnote}>TOMAN keeps AI proposals under owner control. No external action can run without an owner approval flow.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

interface DashboardProps {
  metrics: WorkspaceMetrics;
  leads: Lead[];
  alerts: AlertItem[];
  agentRuns: AgentRun[];
  campaigns: Campaign[];
  unreadCount: number;
  ownerName: string;
  workspaceName: string;
  isDemo: boolean;
  onOpenJarvis: () => void;
  onOpenApproval: () => void;
  onOpenAlerts: () => void;
  onOpenCampaigns: () => void;
  onOpenAgents: () => void;
  onOpenSettings: () => void;
}

function DashboardScreen({
  metrics,
  leads,
  alerts,
  agentRuns,
  campaigns,
  unreadCount,
  ownerName,
  workspaceName,
  isDemo,
  onOpenJarvis,
  onOpenApproval,
  onOpenAlerts,
  onOpenCampaigns,
  onOpenAgents,
  onOpenSettings,
}: DashboardProps) {
  const approval = campaigns.find(item => item.status === 'Needs approval');
  const hasSalesData = leads.length > 0 || campaigns.length > 0;
  const recentAlerts = alerts.slice(0, 3);
  const activeWork = agentRuns.filter(run => run.status !== 'Complete').length;

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false} testID="dashboard-home">
      <AppHeader onOpenAlerts={onOpenAlerts} onOpenSettings={onOpenSettings} unreadCount={unreadCount} />

      <View style={styles.welcomeRow}>
        <View style={styles.dashboardWelcomeCopy}>
          <Text style={styles.greeting}>Good morning, {ownerName.split(' ')[0]}</Text>
          <Text style={styles.greetingSub}>Here is your sales momentum today.</Text>
        </View>
        <View style={styles.workspaceChip}>
          <View style={styles.workspaceDot} />
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.workspaceChipText}>{workspaceName}</Text>
        </View>
      </View>

      <View style={styles.revenueCard}>
        <View style={styles.revenueCardTop}>
          <View>
            <Text style={styles.revenueLabel}>REVENUE INFLUENCED</Text>
            <Text style={styles.revenueValue}>{metrics.revenue}</Text>
            <View style={styles.growthRow}>
              <Text style={styles.growthArrow}>{hasSalesData ? '↗' : '◌'}</Text>
              <Text style={styles.growthText}>{metrics.revenueHelper}</Text>
            </View>
          </View>
          <View style={styles.revenueIcon}>
            <Text style={styles.revenueIconText}>↗</Text>
          </View>
        </View>
        {hasSalesData ? <TrendBars /> : <View style={styles.emptyTrend}><Text style={styles.emptyTrendText}>Connect sales data to unlock your revenue trend.</Text></View>}
        <View style={styles.revenueFooter}>
          <Text style={styles.revenueFooterText}>{hasSalesData ? 'Your latest campaign and customer signals are summarized here.' : 'No revenue is estimated until TOMAN receives your approved business data.'}</Text>
          <Pressable accessibilityRole="button" onPress={onOpenCampaigns}>
            <Text style={styles.revenueLink}>Insights ›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricTile icon="✦" label="Qualified" value={metrics.qualifiedLeads} helper={metrics.qualifiedHelper} tone="violet" />
        <MetricTile icon="↗" label="Replies" value={metrics.replies} helper={metrics.repliesHelper} tone="green" />
        <MetricTile icon="◷" label="Meetings" value={metrics.meetings} helper={metrics.meetingsHelper} tone="amber" />
        <MetricTile icon="◎" label="Campaign ROI" value={metrics.roi} helper={metrics.roiHelper} tone="rose" />
      </View>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Your AI sales manager" title="Jarvis briefing" action="Open Jarvis" onAction={onOpenJarvis} />
      <View style={styles.jarvisBriefing}>
        <View style={styles.jarvisBadge}>
          <Text style={styles.jarvisBadgeIcon}>✦</Text>
        </View>
        <View style={styles.jarvisBriefingBody}>
          <Text style={styles.jarvisBriefingTitle}>{hasSalesData ? 'Jarvis found the next sales actions worth your attention.' : 'Give Jarvis your first sales brief.'}</Text>
          <Text style={styles.jarvisBriefingCopy}>
            {hasSalesData ? 'Review new signals, pending drafts, and recommended handoffs in one place.' : 'Upload a customer sheet or business PDF, then ask the Meta-powered agent team to create a safe draft.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onOpenJarvis} style={styles.briefingLinkRow}>
            <Text style={styles.briefingLink}>{hasSalesData ? 'Open Jarvis briefing' : 'Start with Jarvis'}</Text>
            <Text style={styles.briefingChevron}>→</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="A team working with you" title="Agent activity" action="Open agents" onAction={onOpenAgents} />
      <Pressable accessibilityRole="button" onPress={onOpenAgents} style={styles.agentSummaryCard}>
        <View style={styles.agentSummaryStack}>
          <View style={[styles.agentSummaryAvatar, {backgroundColor: Colors.violet}]}><Text style={styles.agentSummaryAvatarText}>✦</Text></View>
          <View style={[styles.agentSummaryAvatar, styles.agentSummaryAvatarOverlap, {backgroundColor: Colors.green}]}><Text style={styles.agentSummaryAvatarText}>↗</Text></View>
          <View style={[styles.agentSummaryAvatar, styles.agentSummaryAvatarOverlap, {backgroundColor: Colors.rose}]}><Text style={styles.agentSummaryAvatarText}>✎</Text></View>
        </View>
        <View style={styles.agentSummaryBody}>
          <Text style={styles.agentSummaryTitle}>{activeWork ? `${activeWork} agent task${activeWork === 1 ? '' : 's'} in motion` : 'Your agent team is ready to help'}</Text>
          <Text style={styles.agentSummaryCopy}>{activeWork ? 'Jarvis is tracking the handoffs and will return decisions to you for review.' : 'Ask Jarvis or brief a specialist when you are ready.'}</Text>
        </View>
        <Text style={styles.agentSummaryArrow}>›</Text>
      </Pressable>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Decision needed" title="Needs your approval" action="See all" onAction={onOpenCampaigns} />
      {approval ? (
        <Pressable accessibilityRole="button" onPress={onOpenApproval} style={styles.approvalCard}>
          <View style={styles.approvalTop}>
            <Pill label="AWAITING APPROVAL" tone="amber" />
            <Text style={styles.approvalArrow}>›</Text>
          </View>
          <Text style={styles.approvalTitle}>{approval.title}</Text>
          <Text style={styles.approvalDescription}>{approval.audience} · {approval.expectedOutcome}</Text>
          <View style={styles.approvalBottom}>
            <View style={styles.channelRow}>
              <Text style={styles.channelBadge}>{approval.channel}</Text>
            </View>
            <Text style={styles.approvalCTA}>Review now</Text>
          </View>
        </Pressable>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>All caught up.</Text>
          <Text style={styles.emptyCopy}>{isDemo ? 'Your approved demo actions are scheduled and ready to review.' : 'Jarvis will place campaign decisions here after a Meta agent prepares a draft.'}</Text>
        </Card>
      )}

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="What changed" title="Recent activity" action="View alerts" onAction={onOpenAlerts} />
      {recentAlerts.length ? (
        <View style={styles.activityCard}>
          {recentAlerts.map((alert, index) => (
            <React.Fragment key={alert.id}>
              {index ? <Divider /> : null}
              <ActivityRow icon={notificationIcon(alert.kind)} color={notificationColor(alert.kind)} title={alert.title} detail={alert.detail} time={alert.time} />
            </React.Fragment>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>No activity yet.</Text>
          <Text style={styles.emptyCopy}>Review, permission, completed-task, and new-lead notifications will appear here as your workspace connects to the backend.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

function AppHeader({onOpenAlerts, onOpenSettings, unreadCount}: {onOpenAlerts: () => void; onOpenSettings: () => void; unreadCount: number}) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.brandRow}>
        <View style={styles.headerLogo}>
          <Text style={styles.headerLogoText}>✦</Text>
        </View>
        <Text style={styles.headerBrand}>TOMAN</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.headerSettingsButton} testID="open-settings">
          <Text style={styles.headerSettingsIcon}>⚙</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onOpenAlerts} style={styles.bellButton} testID="open-notifications">
          <Text style={styles.bellIcon}>♢</Text>
          {unreadCount ? <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
        </Pressable>
      </View>
    </View>
  );
}

function MetricTile({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  helper: string;
  tone: 'violet' | 'green' | 'amber' | 'rose';
}) {
  const palette = {
    violet: {background: Colors.violetSoft, text: Colors.violet},
    green: {background: Colors.greenSoft, text: Colors.green},
    amber: {background: Colors.amberSoft, text: '#BE7800'},
    rose: {background: Colors.roseSoft, text: Colors.rose},
  }[tone];
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, {backgroundColor: palette.background}]}>
        <Text style={[styles.metricIconText, {color: palette.text}]}>{icon}</Text>
      </View>
      <Text style={styles.metricTileLabel}>{label}</Text>
      <Text style={styles.metricTileValue}>{value}</Text>
      <Text style={[styles.metricTileHelper, {color: palette.text}]}>{helper}</Text>
    </View>
  );
}

function ActivityRow({
  icon,
  color,
  title,
  detail,
  time,
}: {
  icon: string;
  color: string;
  title: string;
  detail: string;
  time: string;
}) {
  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, {backgroundColor: color + '18'}]}>
        <Text style={[styles.activityIconText, {color}]}>{icon}</Text>
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDetail}>{detail}</Text>
      </View>
      <Text style={styles.activityTime}>{time}</Text>
    </View>
  );
}

interface LeadsProps {
  leads: Lead[];
  workspaceName: string;
  onOpenLead: (lead: Lead) => void;
  onOpenJarvis: () => void;
  onUpload: () => void;
}

function LeadsScreen({leads, workspaceName, onOpenLead, onOpenJarvis, onUpload}: LeadsProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Hot' | 'Interested' | 'Follow-up' | 'New'>('All');
  const filteredLeads = useMemo(
    () =>
      leads.filter(lead => {
        const matchesFilter = filter === 'All' || lead.stage === filter;
        const matchesSearch = (lead.name + lead.company + lead.intent)
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    [filter, leads, query],
  );

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <ScreenTop title="Leads" subtitle={`AI-ranked opportunities in ${workspaceName}`} right="⇧" onRight={onUpload} />
      <View style={styles.searchField}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          onChangeText={setQuery}
          placeholder="Search people, companies, or intent"
          placeholderTextColor={Colors.subtle}
          style={styles.searchInput}
          value={query}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {(['All', 'Hot', 'Interested', 'Follow-up', 'New'] as const).map(item => (
          <Pressable
            accessibilityRole="button"
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.filterChip, filter === item && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.leadSummaryRow}>
        <Text style={styles.leadSummary}>{filteredLeads.length} opportunities</Text>
        <Pressable accessibilityRole="button" onPress={onOpenJarvis}>
          <Text style={styles.leadSummaryAction}>Ask Jarvis ›</Text>
        </Pressable>
      </View>

      {filteredLeads.map(lead => (
        <Pressable accessibilityRole="button" key={lead.id} onPress={() => onOpenLead(lead)} style={styles.leadCard}>
          <View style={styles.leadCardTop}>
            <Avatar initials={lead.initials} background={lead.stage === 'Hot' ? Colors.roseSoft : Colors.violetSoft} />
            <View style={styles.leadNameBlock}>
              <Text style={styles.leadName}>{lead.name}</Text>
              <Text style={styles.leadCompany}>{lead.company}</Text>
            </View>
            <ScoreCircle score={lead.score} />
          </View>
          <View style={styles.leadIntentRow}>
            <Pill label={lead.stage} tone={lead.stage === 'Hot' ? 'rose' : lead.stage === 'Interested' ? 'violet' : 'neutral'} />
            <Text numberOfLines={1} style={styles.leadIntent}>{lead.intent}</Text>
          </View>
          <View style={styles.leadActionRow}>
            <Text style={styles.leadActionLabel}>NEXT BEST ACTION</Text>
            <Text numberOfLines={1} style={styles.leadAction}>{lead.action}</Text>
          </View>
        </Pressable>
      ))}

      {!filteredLeads.length ? (
        <View style={styles.leadsEmptyState} testID="leads-empty-state">
          <View style={styles.leadsEmptyIcon}><Text style={styles.leadsEmptyIconText}>⇧</Text></View>
          <Text style={styles.leadsEmptyTitle}>Your lead list is ready for real data.</Text>
          <Text style={styles.leadsEmptyCopy}>Upload a customer sheet from your device or connect an approved channel. TOMAN will not add sample contacts to this workspace.</Text>
          <TomanButton label="Upload customer data" onPress={onUpload} icon="⇧" compact testID="leads-empty-upload" />
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={onUpload} style={styles.uploadStrip}>
        <View style={styles.uploadStripIcon}><Text style={styles.uploadStripIconText}>⇧</Text></View>
        <View style={styles.uploadStripBody}>
          <Text style={styles.uploadStripTitle}>Import a customer sheet or business PDF</Text>
          <Text style={styles.uploadStripCopy}>Choose real PDF, XLS, XLSX, or CSV files from this device.</Text>
        </View>
        <Text style={styles.uploadStripArrow}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

function ScoreCircle({score}: {score: number}) {
  const tone = score >= 90 ? Colors.rose : score >= 80 ? Colors.violet : Colors.amber;
  return (
    <View style={[styles.scoreCircle, {borderColor: tone}]}>
      <Text style={[styles.scoreValue, {color: tone}]}>{score}</Text>
      <Text style={styles.scoreLabel}>AI</Text>
    </View>
  );
}

function LeadDetailScreen({
  lead,
  onBack,
  onCreateCampaign,
}: {
  lead: Lead;
  onBack: () => void;
  onCreateCampaign: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <DetailHeader label="Lead details" onBack={onBack} />
      <View style={styles.leadProfile}>
        <Avatar initials={lead.initials} size={64} background={Colors.violetSoft} />
        <View style={styles.leadProfileBody}>
          <Text style={styles.leadProfileName}>{lead.name}</Text>
          <Text style={styles.leadProfileCompany}>{lead.company}</Text>
          <Pill label={lead.stage + ' · ' + lead.score + ' AI score'} tone={lead.stage === 'Hot' ? 'rose' : 'violet'} />
        </View>
      </View>

      <Card style={styles.detailCard}>
        <Text style={styles.detailEyebrow}>OPPORTUNITY</Text>
        <Text style={styles.detailValue}>{lead.value}</Text>
        <Text style={styles.detailSub}>{lead.intent}</Text>
        <Divider />
        <View style={styles.contactGrid}>
          <DetailKeyValue label="EMAIL" value={lead.email} />
          <DetailKeyValue label="PHONE" value={lead.phone} />
          <DetailKeyValue label="CONSENT" value={lead.consent} />
          <DetailKeyValue label="LAST ACTIVITY" value={lead.lastContact} />
        </View>
      </Card>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Jarvis summary" title="What matters now" />
      <View style={styles.leadJarvisCard}>
        <Text style={styles.leadJarvisIcon}>✦</Text>
        <Text style={styles.leadJarvisCopy}>{lead.summary}</Text>
      </View>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Recommended action" title={lead.action} />
      <Card>
        <Text style={styles.timelineTitle}>Sales timeline</Text>
        <TimelineItem title="Intent signal recorded" detail={lead.intent} time="Today" />
        <TimelineItem title="Contact record updated" detail={lead.consent} time="2 days ago" />
        <TimelineItem title="Source import completed" detail="Luma_Leads_October.xlsx" time="7 days ago" />
      </Card>

      <View style={styles.detailActions}>
        <TomanButton label="Draft message with Jarvis" onPress={onCreateCampaign} icon="✦" />
        <TomanButton label="Add to campaign" onPress={onCreateCampaign} variant="secondary" />
      </View>
    </ScrollView>
  );
}

function DetailKeyValue({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.detailKeyValue}>
      <Text style={styles.detailKey}>{label}</Text>
      <Text style={styles.detailKeyValueText}>{value}</Text>
    </View>
  );
}

function TimelineItem({title, detail, time}: {title: string; detail: string; time: string}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineDot} />
      </View>
      <View style={styles.timelineBody}>
        <Text style={styles.timelineItemTitle}>{title}</Text>
        <Text style={styles.timelineItemDetail}>{detail}</Text>
      </View>
      <Text style={styles.timelineTime}>{time}</Text>
    </View>
  );
}

interface JarvisProps {
  workspaceName: string;
  isDemo: boolean;
  hasBusinessData: boolean;
  onReviewCampaign: () => void;
  onUpload: () => void;
  onCampaignCreated: () => void;
  onDelegateTask: (prompt: string) => void;
}

function JarvisScreen({
  workspaceName,
  isDemo,
  hasBusinessData,
  onReviewCampaign,
  onUpload,
  onCampaignCreated,
  onDelegateTask,
}: JarvisProps) {
  const [prompt, setPrompt] = useState('');
  const [hasPlan, setHasPlan] = useState(false);
  const [message, setMessage] = useState(
    isDemo
      ? `I reviewed ${workspaceName}'s latest customer activity. I found a strong repeat-purchase opportunity in the festive collection.`
      : `I’m ready to learn how ${workspaceName} sells. Add business context or describe the sales result you want to create.`,
  );

  const createPlan = (suggestedPrompt?: string) => {
    const submitted = (suggestedPrompt ?? prompt).trim();
    if (!submitted) {
      return;
    }

    if (!isDemo) {
      setMessage('Jarvis is preparing a safe, owner-reviewable plan with the Meta agent service. Nothing will be sent, posted, called, or published without your approval.');
      setPrompt('');
      onDelegateTask(submitted);
      return;
    }

    setMessage(
      hasBusinessData
        ? 'Your brief is captured. The Meta agent workflow will prepare a draft, then return the audience, content, channels, and permissions for your review.'
        : 'Your brief is captured locally. Add customer data or a business document so the Meta agent workflow can prepare a grounded, reviewable proposal.',
    );
    setHasPlan(true);
    setPrompt('');
    onCampaignCreated();
    onDelegateTask(submitted);
  };

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <ScreenTop title="Jarvis" subtitle="Your Meta-powered AI sales manager" right="⇧" onRight={onUpload} />
      <View style={styles.jarvisHero}>
        <View style={styles.jarvisHeroIcon}><Text style={styles.jarvisHeroIconText}>✦</Text></View>
        <View style={styles.jarvisHeroCopy}>
          <Text style={styles.jarvisHeroTitle}>Jarvis is ready to grow {workspaceName}.</Text>
          <StatusDot label={isDemo ? 'Demo mode · approval controls on' : 'Workspace setup · approval controls on'} />
        </View>
      </View>

      <View style={styles.chatBubbleAssistant}>
        <Text style={styles.chatLabel}>JARVIS</Text>
        <Text style={styles.chatText}>{message}</Text>
      </View>

      {!hasPlan ? (
        <>
          <Text style={styles.suggestedLabel}>TRY ONE OF THESE</Text>
          <View style={styles.promptGrid}>
            <PromptSuggestion icon="↗" label="Create a campaign for high-intent leads" onPress={() => createPlan('Create a campaign for high-intent leads')} />
            <PromptSuggestion icon="◷" label="Who should I call today?" onPress={() => createPlan('Who should I call today?')} />
            <PromptSuggestion icon="◎" label="Summarise customer replies" onPress={() => createPlan('Summarise customer replies')} />
            <PromptSuggestion icon="▣" label="Turn my brochure into an ad" onPress={() => createPlan('Turn my brochure into an ad')} />
          </View>
        </>
      ) : (
          <View style={styles.jarvisPlanCard}>
          <View style={styles.planTopRow}>
            <Pill label="PROPOSAL · OWNER REVIEW REQUIRED" tone="amber" />
            <Text style={styles.planIcon}>✦</Text>
          </View>
          <Text style={styles.planTitle}>{isDemo ? 'Festive repeat-buyer campaign' : 'Your sales brief is being prepared'}</Text>
          <Text style={styles.planDescription}>{isDemo ? 'A warm, personalized follow-up for customers with high purchase intent.' : 'The backend will use your approved documents and connected sources to produce a reviewable proposal.'}</Text>
          <View style={styles.planMetricGrid}>
            <PlanMetric label="AUDIENCE" value={isDemo ? '48 customers' : 'Pending data'} />
            <PlanMetric label="CHANNEL" value={isDemo ? 'Email + WhatsApp' : 'Pending approval'} />
            <PlanMetric label="EXPECTED" value={isDemo ? '9–13 replies' : 'Not estimated'} />
          </View>
          <View style={styles.planWhy}>
            <Text style={styles.planWhyLabel}>WHY JARVIS RECOMMENDS THIS</Text>
            <Text style={styles.planWhyText}>{isDemo ? 'Recent engagement, previous premium purchases, and verified outreach consent align.' : 'Jarvis will explain the evidence only after the Ingestion and CRM services have processed your approved business data.'}</Text>
          </View>
          <View style={styles.handoffTimeline}>
            <Text style={styles.handoffLabel}>JARVIS HAS DELEGATED THIS WORK</Text>
            <View style={styles.handoffSteps}>
              <HandoffStep icon="✦" label="Plan" active />
              <Text style={styles.handoffArrow}>→</Text>
              <HandoffStep icon="✎" label="Create" active />
              <Text style={styles.handoffArrow}>→</Text>
              <HandoffStep icon="◷" label="Review" />
              <Text style={styles.handoffArrow}>→</Text>
              <HandoffStep icon="◎" label="Publish" />
            </View>
          </View>
          {isDemo ? <TomanButton label="Review campaign" onPress={onReviewCampaign} icon="→" /> : <TomanButton label="Add business context" onPress={onUpload} icon="⇧" />}
        </View>
      )}

      <View style={styles.composer}>
        <Pressable accessibilityRole="button" onPress={onUpload} style={styles.attachmentButton}>
          <Text style={styles.attachmentText}>+</Text>
        </Pressable>
        <TextInput
          multiline
          onChangeText={setPrompt}
          placeholder="Ask Jarvis anything about your sales..."
          placeholderTextColor={Colors.subtle}
          style={styles.composerInput}
          testID="jarvis-prompt-input"
          value={prompt}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => createPlan()}
          style={[styles.sendButton, !prompt.trim() && styles.sendButtonInactive]}>
          <Text style={styles.sendButtonText}>↑</Text>
        </Pressable>
      </View>
      <Text style={styles.composerNote}>Jarvis can draft and recommend. You always approve real-world actions.</Text>
    </ScrollView>
  );
}

function HandoffStep({icon, label, active = false}: {icon: string; label: string; active?: boolean}) {
  return (
    <View style={styles.handoffStep}>
      <View style={[styles.handoffIcon, active && styles.handoffIconActive]}><Text style={[styles.handoffIconText, active && styles.handoffIconTextActive]}>{icon}</Text></View>
      <Text style={[styles.handoffStepLabel, active && styles.handoffStepLabelActive]}>{label}</Text>
    </View>
  );
}

function PromptSuggestion({icon, label, onPress}: {icon: string; label: string; onPress: () => void}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.promptSuggestion}>
      <Text style={styles.promptIcon}>{icon}</Text>
      <Text style={styles.promptLabel}>{label}</Text>
      <Text style={styles.promptArrow}>→</Text>
    </Pressable>
  );
}

function PlanMetric({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.planMetric}>
      <Text style={styles.planMetricLabel}>{label}</Text>
      <Text style={styles.planMetricValue}>{value}</Text>
    </View>
  );
}

interface AgentsScreenProps {
  agents: SalesAgent[];
  runs: AgentRun[];
  integrations: Integration[];
  documents: SelectedBusinessDocument[];
  isDemo: boolean;
  onCreateDirectTask: (prompt: string, agent?: SalesAgent) => void;
  onConnectIntegration: (integration: Integration) => void;
  onOpenCampaign: () => void;
  onOpenUpload: () => void;
  onLogout: () => void;
}

function AgentsScreen({
  agents,
  runs,
  integrations,
  documents,
  isDemo,
  onCreateDirectTask,
  onConnectIntegration,
  onOpenCampaign,
  onOpenUpload,
  onLogout,
}: AgentsScreenProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('strategy');
  const [brief, setBrief] = useState('');
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId) ?? agents[0];
  const pendingRun = runs.find(run => run.status === 'Awaiting owner review');

  const sendBrief = () => {
    if (!brief.trim() || !selectedAgent) {
      return;
    }
    onCreateDirectTask(brief, selectedAgent);
    setBrief('');
  };

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false} testID="agents-screen">
      <ScreenTop title="Agent studio" subtitle="Ask Jarvis, or brief a specialist directly" right="⇧" onRight={onOpenUpload} />
      <View style={styles.agentStudioHero}>
        <View style={styles.agentStudioOrb}><Text style={styles.agentStudioOrbText}>✦</Text></View>
        <View style={styles.agentStudioHeroBody}>
          <Text style={styles.agentStudioTitle}>One plan. A team that moves it forward.</Text>
          <Text style={styles.agentStudioCopy}>Jarvis assigns each part of the work, records the handoffs, and returns every real-world action to you for approval.</Text>
        </View>
      </View>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Speak directly" title="Brief a specialist" />
      <Card style={styles.directBriefCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.agentPickerScroll}>
          {agents.filter(agent => agent.id !== 'jarvis').map(agent => (
            <Pressable accessibilityRole="button" key={agent.id} onPress={() => setSelectedAgentId(agent.id)} style={[styles.agentPicker, selectedAgent?.id === agent.id && styles.agentPickerActive]}>
              <View style={[styles.agentPickerIcon, {backgroundColor: agent.color + '1C'}]}><Text style={[styles.agentPickerIconText, {color: agent.color}]}>{agent.icon}</Text></View>
              <Text style={[styles.agentPickerText, selectedAgent?.id === agent.id && styles.agentPickerTextActive]}>{agent.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {selectedAgent ? <Text style={styles.directBriefHint}>To {selectedAgent.name}, {selectedAgent.role}</Text> : null}
        <View style={styles.directBriefComposer}>
          <TextInput multiline onChangeText={setBrief} placeholder="Give this agent a focused sales task…" placeholderTextColor={Colors.subtle} style={styles.directBriefInput} testID="agent-brief-input" value={brief} />
          <Pressable accessibilityRole="button" onPress={sendBrief} style={[styles.directBriefSend, !brief.trim() && styles.directBriefSendDisabled]} testID="agent-brief-send"><Text style={styles.directBriefSendText}>↑</Text></Pressable>
        </View>
        <Text style={styles.directBriefSafety}>Jarvis stays in the loop and will request your review before anything reaches a customer or channel.</Text>
      </Card>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Work in motion" title="Agent handoffs" action="Review queue" onAction={onOpenCampaign} />
      {runs.length ? runs.map(run => <AgentRunCard key={run.id} run={run} agents={agents} onPress={run.status === 'Awaiting owner review' && isDemo ? onOpenCampaign : undefined} />) : (
        <Card>
          <Text style={styles.emptyTitle}>No agent handoffs yet.</Text>
          <Text style={styles.emptyCopy}>Brief Jarvis or a specialist to begin. The Meta agent service will keep the audit trail on the backend.</Text>
        </Card>
      )}

      {pendingRun && isDemo ? <Pressable accessibilityRole="button" onPress={onOpenCampaign} style={styles.ownerReviewBanner}>
        <View style={styles.ownerReviewIcon}><Text style={styles.ownerReviewIconText}>✓</Text></View>
        <View style={styles.ownerReviewBody}><Text style={styles.ownerReviewTitle}>Your decision is needed</Text><Text style={styles.ownerReviewCopy}>{pendingRun.title} is ready for owner review.</Text></View>
        <Text style={styles.ownerReviewArrow}>›</Text>
      </Pressable> : null}

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Your specialized team" title="Agents ready to help" />
      {agents.map(agent => <AgentCard key={agent.id} agent={agent} onPress={() => setSelectedAgentId(agent.id === 'jarvis' ? 'strategy' : agent.id)} />)}

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Business connections" title="Channels & integrations" />
      <View style={styles.integrationNotice}>
        <Text style={styles.integrationNoticeIcon}>⌁</Text>
        <Text style={styles.integrationNoticeText}>{isDemo ? 'Connections are sandbox-only in this app. Real OAuth, publishing, analytics, email, WhatsApp, and calling will be handled only by authorized backend services.' : 'TOMAN never keeps provider passwords or ad credentials in the app. Secure OAuth, publishing, analytics, email, WhatsApp, and calling are backend-owned.'}</Text>
      </View>
      {integrations.map(integration => (
        <IntegrationCard key={integration.id} integration={integration} isDemo={isDemo} onConnect={() => onConnectIntegration(integration)} />
      ))}

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Business intelligence" title="Add your context" />
      <Pressable accessibilityRole="button" onPress={onOpenUpload} style={styles.dataContextCard}>
        <View style={styles.dataContextIcon}><Text style={styles.dataContextIconText}>⇧</Text></View>
        <View style={styles.dataContextBody}><Text style={styles.dataContextTitle}>Import a customer sheet or business PDF</Text><Text style={styles.dataContextCopy}>{documents.length ? `${documents.length} file${documents.length === 1 ? '' : 's'} selected locally for secure processing.` : 'Choose real PDF, XLS, XLSX, or CSV files from this device.'}</Text></View>
        <Text style={styles.dataContextArrow}>›</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton} testID="workspace-logout"><Text style={styles.logoutText}>{isDemo ? 'Sign out of local demo' : 'Sign out of workspace'}</Text></Pressable>
    </ScrollView>
  );
}

function AgentRunCard({run, agents, onPress}: {run: AgentRun; agents: SalesAgent[]; onPress?: () => void}) {
  const tone = run.status === 'Awaiting owner review' ? 'amber' : run.status === 'Complete' ? 'green' : run.status === 'Scheduled' ? 'violet' : 'neutral';
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} style={styles.agentRunCard}>
      <View style={styles.agentRunTop}><Pill label={run.status.toUpperCase()} tone={tone} /><Text style={styles.agentRunTime}>{run.createdAt}</Text></View>
      <Text style={styles.agentRunTitle}>{run.title}</Text>
      <Text style={styles.agentRunOutput}>{run.output}</Text>
      <View style={styles.agentRunFooter}>
        <View style={styles.runAvatarStack}>
          {run.assignedAgentIds.slice(0, 4).map((agentId, index) => {
            const agent = agents.find(item => item.id === agentId);
            return agent ? <View key={agentId} style={[styles.runAvatar, index > 0 && styles.runAvatarOverlap, {backgroundColor: agent.color}]}><Text style={styles.runAvatarText}>{agent.icon}</Text></View> : null;
          })}
        </View>
        <Text style={styles.agentRunFooterText}>{run.status === 'Awaiting owner review' ? 'Tap to review' : `${run.assignedAgentIds.length} agents involved`}</Text>
      </View>
    </Pressable>
  );
}

function AgentCard({agent, onPress}: {agent: SalesAgent; onPress: () => void}) {
  const statusColor = agent.status === 'Working' ? Colors.green : agent.status === 'Waiting for review' ? Colors.amber : Colors.violet;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.agentCard}>
      <View style={[styles.agentCardIcon, {backgroundColor: agent.color + '18'}]}><Text style={[styles.agentCardIconText, {color: agent.color}]}>{agent.icon}</Text></View>
      <View style={styles.agentCardBody}>
        <View style={styles.agentCardHeading}><Text style={styles.agentCardName}>{agent.name}</Text><StatusDot color={statusColor} label={agent.status} /></View>
        <Text style={styles.agentCardRole}>{agent.role}</Text>
        <Text style={styles.agentCardTask}>{agent.currentTask}</Text>
      </View>
      <Text style={styles.agentCardArrow}>›</Text>
    </Pressable>
  );
}

function IntegrationCard({integration, isDemo, onConnect}: {integration: Integration; isDemo: boolean; onConnect: () => void}) {
  const isSandbox = integration.status === 'Sandbox connected';
  return (
    <View style={styles.integrationCard}>
      <View style={[styles.integrationIcon, {backgroundColor: integration.color + '18'}]}><Text style={[styles.integrationIconText, {color: integration.color}]}>{integration.icon}</Text></View>
      <View style={styles.integrationBody}>
        <Text style={styles.integrationName}>{integration.provider}</Text>
        <Text style={styles.integrationCapability}>{integration.capability}</Text>
        <Text style={[styles.integrationStatus, {color: isSandbox ? Colors.green : Colors.muted}]}>{integration.status}{integration.account ? ` · ${integration.account}` : ''}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onConnect} style={[styles.integrationAction, isSandbox && styles.integrationActionConnected]} testID={`integration-${integration.id}`}>
        <Text style={[styles.integrationActionText, isSandbox && styles.integrationActionTextConnected]}>{isSandbox ? 'Ready' : isDemo ? 'Prepare' : 'Request'}</Text>
      </Pressable>
    </View>
  );
}

interface CampaignsProps {
  campaigns: Campaign[];
  onOpenCampaign: (campaign: Campaign) => void;
  onOpenJarvis: () => void;
}

function CampaignsScreen({campaigns, onOpenCampaign, onOpenJarvis}: CampaignsProps) {
  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <ScreenTop title="Campaigns" subtitle="Every message stays under owner control" />
      <View style={styles.campaignIntro}>
        <View style={styles.campaignIntroIcon}><Text style={styles.campaignIntroIconText}>✦</Text></View>
        <View style={styles.campaignIntroBody}>
          <Text style={styles.campaignIntroTitle}>Make the next action count.</Text>
          <Text style={styles.campaignIntroCopy}>Jarvis drafts. You approve the exact audience, content, channel, and schedule.</Text>
        </View>
      </View>
      <TomanButton label="Create with Jarvis" onPress={onOpenJarvis} icon="✦" style={styles.createCampaignButton} />

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Sales motion" title="Your campaigns" />
      {campaigns.map(campaign => (
        <Pressable accessibilityRole="button" key={campaign.id} onPress={() => onOpenCampaign(campaign)} style={styles.campaignCard}>
          <View style={styles.campaignColorBar}>
            <View style={[styles.campaignColorFill, {backgroundColor: campaign.color}]} />
          </View>
          <View style={styles.campaignCardBody}>
            <View style={styles.campaignCardTop}>
              <Pill label={campaign.status.toUpperCase()} tone={statusTone(campaign.status)} />
              <Text style={styles.campaignChevron}>›</Text>
            </View>
            <Text style={styles.campaignTitle}>{campaign.title}</Text>
            <Text style={styles.campaignMeta}>{campaign.audience} · {campaign.channel}</Text>
            <View style={styles.campaignFooter}>
              <Text style={styles.campaignProgress}>{campaign.progress}</Text>
              <Text style={styles.campaignExpected}>{campaign.expectedOutcome}</Text>
            </View>
          </View>
        </Pressable>
      ))}
      {!campaigns.length ? (
        <Card>
          <Text style={styles.emptyTitle}>No campaigns yet.</Text>
          <Text style={styles.emptyCopy}>Start a brief with Jarvis. TOMAN will show a campaign here only after the Meta agent workflow has prepared a reviewable draft.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function CampaignReviewScreen({
  campaign,
  onBack,
  onApprove,
  onRevise,
}: {
  campaign: Campaign;
  onBack: () => void;
  onApprove: () => void;
  onRevise: () => void;
}) {
  const isAwaitingApproval = campaign.status === 'Needs approval';
  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <DetailHeader label="Campaign review" onBack={onBack} />
      <Pill label={campaign.status.toUpperCase()} tone={statusTone(campaign.status)} />
      <Text style={styles.reviewTitle}>{campaign.title}</Text>
      <Text style={styles.reviewDescription}>{campaign.description}</Text>

      <View style={styles.reviewMetrics}>
        <Metric label="AUDIENCE" value={campaign.audience} accent={Colors.violetDeep} />
        <View style={styles.metricSeparator} />
        <Metric label="EXPECTED OUTCOME" value={campaign.expectedOutcome} accent={Colors.green} />
      </View>

      <Card style={styles.reviewCard}>
        <Text style={styles.reviewCardLabel}>CHANNEL &amp; DELIVERY</Text>
        <Text style={styles.reviewCardValue}>{campaign.channel}</Text>
        <Text style={styles.reviewCardHelper}>{campaign.scheduledFor}</Text>
      </Card>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Generated copy" title="Owner preview" />
      <Card>
        <View style={styles.messagePreviewHeader}>
          <Text style={styles.messagePreviewAvatar}>L</Text>
          <View>
            <Text style={styles.messagePreviewFrom}>Luma Living</Text>
            <Text style={styles.messagePreviewSubject}>A personal selection for you</Text>
          </View>
        </View>
        <Divider />
        <Text style={styles.messagePreviewText}>{campaign.message}</Text>
      </Card>

      <View style={styles.spacer24} />
      <View style={styles.reviewWhy}>
        <Text style={styles.reviewWhyIcon}>✦</Text>
        <View style={styles.reviewWhyBody}>
          <Text style={styles.reviewWhyLabel}>WHY JARVIS RECOMMENDS THIS</Text>
          <Text style={styles.reviewWhyText}>{campaign.why}</Text>
        </View>
      </View>

      <View style={styles.approvalSafety}>
        <Text style={styles.approvalSafetyIcon}>✓</Text>
        <Text style={styles.approvalSafetyText}>Consent, audience version, content version, and schedule will be rechecked before any real integration action.</Text>
      </View>

      {isAwaitingApproval ? (
        <View style={styles.reviewActions}>
          <TomanButton label="Approve & schedule" onPress={onApprove} testID="campaign-approve" icon="✓" />
          <TomanButton label="Ask Jarvis to revise" onPress={onRevise} variant="secondary" />
        </View>
      ) : (
        <View style={styles.scheduledState}>
          <Text style={styles.scheduledStateIcon}>✓</Text>
          <View>
            <Text style={styles.scheduledStateTitle}>This campaign is scheduled</Text>
            <Text style={styles.scheduledStateCopy}>{campaign.progress}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function statusTone(status: CampaignStatus): 'amber' | 'green' | 'violet' | 'neutral' {
  if (status === 'Needs approval') {
    return 'amber';
  }
  if (status === 'Scheduled' || status === 'Live' || status === 'Completed') {
    return 'green';
  }
  if (status === 'Draft') {
    return 'neutral';
  }
  return 'violet';
}

interface AlertsProps {
  alerts: AlertItem[];
  onOpenLead?: () => void;
  onOpenCampaign: () => void;
  onRead: (alertId: string) => void;
}

function AlertsScreen({alerts, onOpenLead, onOpenCampaign, onRead}: AlertsProps) {
  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
      <ScreenTop title="Alerts" subtitle="What needs your attention" />
      <View style={styles.alertHeadingRow}>
        <Text style={styles.alertHeading}>Today</Text>
        <Pill label={alerts.filter(item => item.unread).length + ' UNREAD'} tone="violet" />
      </View>
      {alerts.map(alert => {
        const icon = notificationIcon(alert.kind);
        const tone = notificationColor(alert.kind);
        return (
          <Pressable
            accessibilityRole="button"
            key={alert.id}
            onPress={() => {
              if (alert.unread) {
                onRead(alert.id);
              }
              if (alert.kind === 'approval') {
                onOpenCampaign();
              } else if (alert.kind === 'reply' || alert.kind === 'lead') {
                onOpenLead?.();
              }
            }}
            style={[styles.alertCard, alert.unread && styles.alertCardUnread]}>
            <View style={[styles.alertIcon, {backgroundColor: tone + '18'}]}>
              <Text style={[styles.alertIconText, {color: tone}]}>{icon}</Text>
            </View>
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertDetail}>{alert.detail}</Text>
              <Text style={styles.alertTime}>{alert.time}</Text>
            </View>
            {alert.unread ? <View style={[styles.alertUnreadDot, {backgroundColor: tone}]} /> : null}
          </Pressable>
        );
      })}
      {!alerts.length ? (
        <View style={styles.notificationEmptyState} testID="notifications-empty-state">
          <View style={styles.notificationEmptyIcon}><Text style={styles.notificationEmptyIconText}>♢</Text></View>
          <Text style={styles.notificationEmptyTitle}>You are all caught up.</Text>
          <Text style={styles.notificationEmptyCopy}>TOMAN will notify you here about owner reviews, permission requests, completed tasks, and incoming leads once the backend is connected.</Text>
        </View>
      ) : null}
      <View style={styles.alertFooter}>
        <Text style={styles.alertFooterIcon}>✓</Text>
        <Text style={styles.alertFooterText}>TOMAN records every workspace event in an audit-ready timeline.</Text>
      </View>
    </ScrollView>
  );
}

function notificationIcon(kind: AlertItem['kind']) {
  if (kind === 'reply' || kind === 'lead') {
    return '↗';
  }
  if (kind === 'approval' || kind === 'review') {
    return '✓';
  }
  if (kind === 'permission') {
    return '⌁';
  }
  if (kind === 'completed') {
    return '◎';
  }
  if (kind === 'insight') {
    return '✦';
  }
  return '◷';
}

function notificationColor(kind: AlertItem['kind']) {
  if (kind === 'reply' || kind === 'lead') {
    return Colors.green;
  }
  if (kind === 'approval' || kind === 'review') {
    return Colors.amber;
  }
  if (kind === 'permission') {
    return Colors.cyan;
  }
  if (kind === 'completed') {
    return Colors.green;
  }
  if (kind === 'insight') {
    return Colors.violet;
  }
  return Colors.cyan;
}

interface SettingsScreenProps {
  session: DemoSession | null;
  preferences: NotificationPreferences;
  documents: SelectedBusinessDocument[];
  onBack: () => void;
  onOpenUpload: () => void;
  onSaveProfile: (ownerName: string, businessName: string) => void;
  onTogglePreference: (key: keyof NotificationPreferences) => void;
  onLogout: () => void;
}

function SettingsScreen({
  session,
  preferences,
  documents,
  onBack,
  onOpenUpload,
  onSaveProfile,
  onTogglePreference,
  onLogout,
}: SettingsScreenProps) {
  const [ownerName, setOwnerName] = useState(session?.ownerName ?? '');
  const [businessName, setBusinessName] = useState(session?.businessName ?? '');
  const [message, setMessage] = useState('');

  const save = () => {
    if (!ownerName.trim() || !businessName.trim()) {
      setMessage('Add both your name and business name before saving.');
      return;
    }
    setMessage('');
    onSaveProfile(ownerName.trim(), businessName.trim());
  };

  return (
    <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false} testID="settings-screen">
      <DetailHeader label="Settings" onBack={onBack} />
      <View style={styles.settingsHero}>
        <View style={styles.settingsHeroIcon}><Text style={styles.settingsHeroIconText}>⚙</Text></View>
        <View style={styles.settingsHeroBody}>
          <Text style={styles.settingsHeroTitle}>Your workspace, your controls.</Text>
          <Text style={styles.settingsHeroCopy}>Manage the information TOMAN shows, notification preferences, and files awaiting backend processing.</Text>
        </View>
      </View>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Workspace profile" title="Owner & business" />
      <Card>
        <Text style={styles.fieldLabel}>{session?.isDemo ? 'OWNER NAME' : 'OWNER NAME · ACCOUNT MANAGED'}</Text>
        <TextInput autoCapitalize="words" editable={Boolean(session?.isDemo)} onChangeText={setOwnerName} placeholder="Your name" placeholderTextColor={Colors.subtle} style={styles.input} testID="settings-owner-name" value={ownerName} />
        <Text style={styles.fieldLabel}>BUSINESS NAME</Text>
        <TextInput autoCapitalize="words" onChangeText={setBusinessName} placeholder="Your business" placeholderTextColor={Colors.subtle} style={styles.input} testID="settings-business-name" value={businessName} />
        {message ? <Text style={styles.loginError}>{message}</Text> : null}
        <TomanButton label="Save workspace settings" onPress={save} compact testID="settings-save-profile" style={styles.settingsSaveButton} />
      </Card>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Stay informed" title="Notifications" />
      <Card style={styles.settingsCardNoPadding}>
        <NotificationPreferenceRow icon="✓" title="Reviews needed" copy="Campaigns, creatives, messages, and schedules need your decision." value={preferences.reviews} onValueChange={() => onTogglePreference('reviews')} />
        <Divider />
        <NotificationPreferenceRow icon="⌁" title="Permission requests" copy="An integration or channel needs your secure authorization." value={preferences.permissions} onValueChange={() => onTogglePreference('permissions')} />
        <Divider />
        <NotificationPreferenceRow icon="◎" title="Completed tasks" copy="An approved workflow has finished or its outcome is available." value={preferences.completedTasks} onValueChange={() => onTogglePreference('completedTasks')} />
        <Divider />
        <NotificationPreferenceRow icon="↗" title="New leads" copy="A connected source has added a newly qualified opportunity." value={preferences.newLeads} onValueChange={() => onTogglePreference('newLeads')} />
      </Card>
      <Text style={styles.settingsHint}>These controls are saved in the workspace preference contract. The current backend delivers an in-app notification center; device push can be added later with a configured provider.</Text>

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Business context" title="Selected documents" action="Add files" onAction={onOpenUpload} />
      {documents.length ? (
        <View style={styles.documentsList}>
          {documents.map(document => (
            <View key={document.id} style={styles.documentRow}>
              <View style={[styles.documentIcon, {backgroundColor: document.category === 'Customer sheet' ? Colors.greenSoft : Colors.roseSoft}]}>
                <Text style={[styles.documentIconText, {color: document.category === 'Customer sheet' ? Colors.green : Colors.rose}]}>{document.category === 'Customer sheet' ? 'X' : 'PDF'}</Text>
              </View>
              <View style={styles.documentBody}>
                <Text numberOfLines={1} style={styles.documentName}>{document.name}</Text>
                <Text style={styles.documentMeta}>{document.category} · {document.status}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onOpenUpload} style={styles.settingsUploadEmpty} testID="settings-add-documents">
          <View style={styles.settingsUploadEmptyIcon}><Text style={styles.settingsUploadEmptyIconText}>⇧</Text></View>
          <View style={styles.settingsUploadEmptyBody}>
            <Text style={styles.settingsUploadEmptyTitle}>No business documents selected</Text>
            <Text style={styles.settingsUploadEmptyCopy}>Add a PDF, XLS, or XLSX from this device. We never insert sample customer data into a real workspace.</Text>
          </View>
          <Text style={styles.settingsUploadEmptyArrow}>›</Text>
        </Pressable>
      )}

      <View style={styles.spacer24} />
      <SectionTitle eyebrow="Security" title="Account connection" />
      <Card>
        <StatusDot color={session?.isDemo ? Colors.amber : Colors.green} label={session?.isDemo ? 'Local demo session' : 'Authenticated workspace session'} />
        <Text style={styles.settingsSecurityCopy}>{session?.isDemo ? 'This is an isolated demo. Social providers and business data are simulated.' : 'A secure server session will use a short-lived access token and rotating refresh session. TOMAN does not use permanent client-side JWTs.'}</Text>
      </Card>

      <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logoutButton} testID="settings-logout"><Text style={styles.logoutText}>{session?.isDemo ? 'Sign out of local demo' : 'Sign out of workspace'}</Text></Pressable>
    </ScrollView>
  );
}

function NotificationPreferenceRow({
  icon,
  title,
  copy,
  value,
  onValueChange,
}: {
  icon: string;
  title: string;
  copy: string;
  value: boolean;
  onValueChange: () => void;
}) {
  return (
    <View style={styles.notificationPreferenceRow}>
      <View style={styles.notificationPreferenceIcon}><Text style={styles.notificationPreferenceIconText}>{icon}</Text></View>
      <View style={styles.notificationPreferenceBody}>
        <Text style={styles.notificationPreferenceTitle}>{title}</Text>
        <Text style={styles.notificationPreferenceCopy}>{copy}</Text>
      </View>
      <Switch accessibilityLabel={title} onValueChange={onValueChange} testID={`notification-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`} thumbColor={value ? '#FFFFFF' : '#FFFFFF'} trackColor={{false: '#D7DAE5', true: '#8F8AFF'}} value={value} />
    </View>
  );
}

function ScreenTop({
  title,
  subtitle,
  right,
  onRight,
  initials,
}: {
  title: string;
  subtitle: string;
  right?: string;
  onRight?: () => void;
  initials?: string;
}) {
  return (
    <View style={styles.screenTop}>
      <View>
        <Text style={styles.screenTitle}>{title}</Text>
        <Text style={styles.screenSubtitle}>{subtitle}</Text>
      </View>
      {right ? (
        <Pressable accessibilityRole="button" onPress={onRight} style={styles.topAction}>
          <Text style={styles.topActionText}>{right}</Text>
        </Pressable>
      ) : (
        <Avatar initials={initials ?? 'TM'} size={40} />
      )}
    </View>
  );
}

function DetailHeader({label, onBack}: {label: string; onBack: () => void}) {
  return (
    <View style={styles.detailHeader}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
      <Text style={styles.detailHeaderLabel}>{label}</Text>
      <View style={styles.detailHeaderSpacer} />
    </View>
  );
}

function BottomTabs({
  activeTab,
  onTabChange,
  unreadCount,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  unreadCount: number;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
      <View style={styles.bottomTabs}>
        {tabItems.map(item => {
          const isActive = item.key === activeTab;
          const isJarvis = item.key === 'Jarvis';
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{selected: isActive}}
              key={item.key}
              onPress={() => onTabChange(item.key)}
              style={styles.tabButton}
              testID={`tab-${item.key}`}>
              {isJarvis ? (
                <View style={[styles.jarvisTabOrb, isActive && styles.jarvisTabOrbActive]}>
                  <Text style={styles.jarvisTabIcon}>{item.icon}</Text>
                </View>
              ) : (
                <View style={styles.tabIconWrap}>
                  <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{item.icon}</Text>
                  {item.key === 'Alerts' && unreadCount ? <View style={styles.tabNotificationDot} /> : null}
                </View>
              )}
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function UploadModal({
  visible,
  isDemo,
  onClose,
  onPickFromDevice,
  onAddDemoDocument,
}: {
  visible: boolean;
  isDemo: boolean;
  onClose: () => void;
  onPickFromDevice: () => void;
  onAddDemoDocument: (fileName: string, category: SelectedBusinessDocument['category']) => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalDismiss} />
        <View style={styles.uploadModal}>
          <View style={styles.modalHandle} />
          <Text style={styles.uploadModalTitle}>Add business context</Text>
          <Text style={styles.uploadModalCopy}>Select PDFs, XLS, or XLSX files from this device. TOMAN will validate and store the file through the authenticated Ingestion service.</Text>
          <TomanButton label="Choose files from this device" onPress={onPickFromDevice} icon="⇧" testID="pick-business-documents" style={styles.uploadPickerButton} />
          <View style={styles.uploadTypeRow}>
            <Pill label="PDF" tone="rose" />
            <Pill label="XLS / XLSX" tone="green" style={styles.uploadTypePill} />
          </View>
          {isDemo ? (
            <>
              <View style={styles.modalRule} />
              <Text style={styles.demoSamplesLabel}>DEMO-ONLY SAMPLE FILES</Text>
              <Pressable accessibilityRole="button" onPress={() => onAddDemoDocument('Luma_Leads_October.xlsx', 'Customer sheet')} style={styles.demoFileRow} testID="add-demo-sheet">
                <View style={[styles.demoFileIcon, {backgroundColor: Colors.greenSoft}]}><Text style={[styles.demoFileIconText, {color: Colors.green}]}>X</Text></View>
                <View style={styles.demoFileBody}>
                  <Text style={styles.demoFileTitle}>Luma_Leads_October.xlsx</Text>
                  <Text style={styles.demoFileCopy}>Sample spreadsheet for the demo workspace only</Text>
                </View>
                <Text style={styles.demoFileArrow}>›</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => onAddDemoDocument('Luma_Product_Brochure.pdf', 'Business document')} style={styles.demoFileRow} testID="add-demo-pdf">
                <View style={[styles.demoFileIcon, {backgroundColor: Colors.roseSoft}]}><Text style={[styles.demoFileIconText, {color: Colors.rose}]}>PDF</Text></View>
                <View style={styles.demoFileBody}>
                  <Text style={styles.demoFileTitle}>Luma_Product_Brochure.pdf</Text>
                  <Text style={styles.demoFileCopy}>Sample product context for the demo workspace only</Text>
                </View>
                <Text style={styles.demoFileArrow}>›</Text>
              </Pressable>
            </>
          ) : null}
          <View style={styles.modalRule} />
          <Text style={styles.modalSafety}>No provider credential is stored in this app. Files remain selected locally until the authorized Ingestion service receives them over an authenticated connection.</Text>
          <TomanButton label="Cancel" onPress={onClose} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}

function Toast({message}: {message: string}) {
  return (
    <View pointerEvents="none" style={styles.toast}>
      <Text style={styles.toastIcon}>✓</Text>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: Colors.canvas,
    flex: 1,
  },
  appBody: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  screenScroll: {
    paddingBottom: 118,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  spacer24: {
    height: 24,
  },
  appHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerLogo: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 11,
    height: 32,
    justifyContent: 'center',
    marginRight: 9,
    width: 32,
  },
  headerLogoText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  headerBrand: {
    color: Colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  bellButton: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  bellIcon: {
    color: Colors.ink,
    fontSize: 23,
    lineHeight: 25,
  },
  bellBadge: {
    alignItems: 'center',
    backgroundColor: Colors.rose,
    borderColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -7,
    top: -7,
    width: 20,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  welcomeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dashboardWelcomeCopy: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: Colors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  greetingSub: {
    color: Colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  workspaceChip: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    maxWidth: '47%',
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  workspaceDot: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  workspaceChipText: {
    color: Colors.inkSoft,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  revenueCard: {
    backgroundColor: Colors.ink,
    borderRadius: 24,
    marginTop: 21,
    overflow: 'hidden',
    padding: 20,
  },
  revenueCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  revenueLabel: {
    color: '#BFC5E6',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  revenueValue: {
    color: '#FFFFFF',
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: -1.3,
    marginTop: 5,
  },
  growthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 5,
  },
  growthArrow: {
    color: '#5FE5B7',
    fontSize: 17,
    fontWeight: '900',
    marginRight: 4,
  },
  growthText: {
    color: '#5FE5B7',
    fontSize: 13,
    fontWeight: '800',
  },
  revenueIcon: {
    alignItems: 'center',
    backgroundColor: '#252F59',
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  revenueIconText: {
    color: '#8F8AFF',
    fontSize: 25,
    fontWeight: '900',
  },
  revenueFooter: {
    alignItems: 'center',
    borderTopColor: '#2D375F',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
  },
  revenueFooterText: {
    color: '#BFC5E6',
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    marginRight: 10,
  },
  revenueLink: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  metricTile: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
    width: '48.5%',
  },
  metricIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    marginBottom: 10,
    width: 28,
  },
  metricIconText: {
    fontSize: 15,
    fontWeight: '900',
  },
  metricTileLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  metricTileValue: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  metricTileHelper: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  jarvisBriefing: {
    backgroundColor: Colors.violetSoft,
    borderColor: '#DBD9FF',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  jarvisBadge: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    marginRight: 13,
    width: 44,
  },
  jarvisBadgeIcon: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  jarvisBriefingBody: {
    flex: 1,
  },
  jarvisBriefingTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  jarvisBriefingCopy: {
    color: Colors.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  briefingLinkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 11,
  },
  briefingLink: {
    color: Colors.violetDeep,
    fontSize: 12,
    fontWeight: '900',
  },
  briefingChevron: {
    color: Colors.violetDeep,
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 5,
  },
  approvalCard: {
    backgroundColor: Colors.surface,
    borderColor: '#F3DFAF',
    borderRadius: 20,
    borderWidth: 1,
    padding: 17,
  },
  approvalTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approvalArrow: {
    color: Colors.ink,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 26,
  },
  approvalTitle: {
    color: Colors.ink,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.25,
    marginTop: 13,
  },
  approvalDescription: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  approvalBottom: {
    alignItems: 'center',
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 13,
  },
  channelRow: {
    flexDirection: 'row',
  },
  channelBadge: {
    color: Colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 9,
  },
  approvalCTA: {
    color: Colors.violet,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyTitle: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyCopy: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  activityIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    marginRight: 11,
    width: 36,
  },
  activityIconText: {
    fontSize: 16,
    fontWeight: '900',
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activityDetail: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  activityTime: {
    color: Colors.subtle,
    fontSize: 11,
    fontWeight: '700',
  },
  screenTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  screenTitle: {
    color: Colors.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  screenSubtitle: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  topAction: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  topActionText: {
    color: Colors.violet,
    fontSize: 20,
    fontWeight: '900',
  },
  searchField: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    height: 52,
    paddingHorizontal: 14,
  },
  searchIcon: {
    color: Colors.muted,
    fontSize: 23,
    marginRight: 8,
  },
  searchInput: {
    color: Colors.ink,
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  chipScroll: {
    paddingVertical: 13,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.violet,
    borderColor: Colors.violet,
  },
  filterChipText: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  leadSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leadSummary: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  leadSummaryAction: {
    color: Colors.violet,
    fontSize: 12,
    fontWeight: '900',
  },
  leadCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 11,
    padding: 15,
  },
  leadCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  leadNameBlock: {
    flex: 1,
    marginLeft: 11,
  },
  leadName: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  leadCompany: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  scoreCircle: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 2,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 13,
  },
  scoreLabel: {
    color: Colors.muted,
    fontSize: 7,
    fontWeight: '900',
    lineHeight: 8,
  },
  leadIntentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 13,
  },
  leadIntent: {
    color: Colors.inkSoft,
    flex: 1,
    fontSize: 12,
    marginLeft: 8,
  },
  leadActionRow: {
    backgroundColor: Colors.canvas,
    borderRadius: 12,
    marginTop: 13,
    padding: 10,
  },
  leadActionLabel: {
    color: Colors.subtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  leadAction: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  uploadStrip: {
    alignItems: 'center',
    backgroundColor: Colors.ink,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: 8,
    padding: 14,
  },
  uploadStripIcon: {
    alignItems: 'center',
    backgroundColor: '#2C355B',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    marginRight: 11,
    width: 38,
  },
  uploadStripIconText: {
    color: '#8F8AFF',
    fontSize: 19,
    fontWeight: '900',
  },
  uploadStripBody: {
    flex: 1,
  },
  uploadStripTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  uploadStripCopy: {
    color: '#BEC5E6',
    fontSize: 11,
    marginTop: 3,
  },
  uploadStripArrow: {
    color: '#FFFFFF',
    fontSize: 26,
  },
  detailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  backButtonText: {
    color: Colors.ink,
    fontSize: 30,
    lineHeight: 33,
  },
  detailHeaderLabel: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  detailHeaderSpacer: {
    width: 42,
  },
  leadProfile: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  leadProfileBody: {
    flex: 1,
    marginLeft: 13,
  },
  leadProfileName: {
    color: Colors.ink,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  leadProfileCompany: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 3,
  },
  detailCard: {
    marginTop: 20,
  },
  detailEyebrow: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  detailValue: {
    color: Colors.ink,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 5,
  },
  detailSub: {
    color: Colors.violetDeep,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailKeyValue: {
    marginBottom: 14,
    paddingRight: 10,
    width: '50%',
  },
  detailKey: {
    color: Colors.subtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  detailKeyValueText: {
    color: Colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 4,
  },
  leadJarvisCard: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 18,
    flexDirection: 'row',
    padding: 16,
  },
  leadJarvisIcon: {
    color: Colors.violet,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 10,
  },
  leadJarvisCopy: {
    color: Colors.inkSoft,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  timelineTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 58,
  },
  timelineRail: {
    alignItems: 'center',
    marginRight: 10,
    paddingTop: 4,
    width: 12,
  },
  timelineDot: {
    backgroundColor: Colors.violet,
    borderRadius: 7,
    height: 9,
    width: 9,
  },
  timelineBody: {
    flex: 1,
  },
  timelineItemTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  timelineItemDetail: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 4,
  },
  timelineTime: {
    color: Colors.subtle,
    fontSize: 10,
  },
  detailActions: {
    gap: 10,
    marginTop: 24,
  },
  jarvisHero: {
    alignItems: 'center',
    backgroundColor: Colors.ink,
    borderRadius: 22,
    flexDirection: 'row',
    padding: 17,
  },
  jarvisHeroIcon: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    marginRight: 13,
    width: 52,
  },
  jarvisHeroIconText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },
  jarvisHeroCopy: {
    flex: 1,
  },
  jarvisHeroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
    marginBottom: 7,
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    marginTop: 18,
    padding: 15,
  },
  chatLabel: {
    color: Colors.violet,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  chatText: {
    color: Colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  suggestedLabel: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 9,
    marginTop: 22,
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  promptSuggestion: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 17,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 120,
    padding: 13,
    width: '48.4%',
  },
  promptIcon: {
    color: Colors.violet,
    fontSize: 17,
    fontWeight: '900',
  },
  promptLabel: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 13,
    paddingRight: 4,
  },
  promptArrow: {
    bottom: 11,
    color: Colors.violet,
    fontSize: 17,
    fontWeight: '900',
    position: 'absolute',
    right: 13,
  },
  jarvisPlanCard: {
    backgroundColor: Colors.violetSoft,
    borderColor: '#D8D6FF',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 19,
    padding: 17,
  },
  planTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planIcon: {
    color: Colors.violet,
    fontSize: 22,
    fontWeight: '900',
  },
  planTitle: {
    color: Colors.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.35,
    marginTop: 14,
  },
  planDescription: {
    color: Colors.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  planMetricGrid: {
    backgroundColor: '#FFFFFFA8',
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 15,
    padding: 12,
  },
  planMetric: {
    flex: 1,
  },
  planMetricLabel: {
    color: Colors.subtle,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  planMetricValue: {
    color: Colors.ink,
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 15,
    marginTop: 4,
  },
  planWhy: {
    marginBottom: 15,
    marginTop: 15,
  },
  planWhyLabel: {
    color: Colors.violetDeep,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  planWhyText: {
    color: Colors.inkSoft,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    minHeight: 59,
    padding: 8,
  },
  attachmentButton: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    marginRight: 7,
    width: 40,
  },
  attachmentText: {
    color: Colors.violet,
    fontSize: 22,
    fontWeight: '700',
  },
  composerInput: {
    color: Colors.ink,
    flex: 1,
    fontSize: 12,
    maxHeight: 96,
    minHeight: 40,
    paddingHorizontal: 3,
    paddingTop: 10,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    marginLeft: 5,
    width: 40,
  },
  sendButtonInactive: {
    backgroundColor: '#DADDEA',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  composerNote: {
    color: Colors.subtle,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  campaignIntro: {
    backgroundColor: Colors.ink,
    borderRadius: 21,
    flexDirection: 'row',
    padding: 16,
  },
  campaignIntroIcon: {
    alignItems: 'center',
    backgroundColor: '#2D375F',
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    marginRight: 12,
    width: 46,
  },
  campaignIntroIconText: {
    color: '#8F8AFF',
    fontSize: 21,
    fontWeight: '900',
  },
  campaignIntroBody: {
    flex: 1,
  },
  campaignIntroTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  campaignIntroCopy: {
    color: '#BFC5E6',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  createCampaignButton: {
    marginTop: 12,
  },
  campaignCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 11,
    overflow: 'hidden',
  },
  campaignColorBar: {
    backgroundColor: Colors.canvas,
    width: 5,
  },
  campaignColorFill: {
    flex: 1,
    width: 5,
  },
  campaignCardBody: {
    flex: 1,
    padding: 15,
  },
  campaignCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  campaignChevron: {
    color: Colors.subtle,
    fontSize: 26,
    lineHeight: 22,
  },
  campaignTitle: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 11,
  },
  campaignMeta: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  campaignFooter: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 11,
  },
  campaignProgress: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  campaignExpected: {
    color: Colors.green,
    fontSize: 10,
    fontWeight: '900',
  },
  reviewTitle: {
    color: Colors.ink,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: 13,
  },
  reviewDescription: {
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  reviewMetrics: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    padding: 15,
  },
  metricSeparator: {
    backgroundColor: Colors.line,
    marginHorizontal: 14,
    width: 1,
  },
  reviewCard: {
    marginTop: 10,
  },
  reviewCardLabel: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  reviewCardValue: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  reviewCardHelper: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  messagePreviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  messagePreviewAvatar: {
    alignItems: 'center',
    backgroundColor: Colors.ink,
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    height: 30,
    lineHeight: 30,
    marginRight: 10,
    textAlign: 'center',
    width: 30,
  },
  messagePreviewFrom: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  messagePreviewSubject: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  messagePreviewText: {
    color: Colors.inkSoft,
    fontSize: 13,
    lineHeight: 20,
  },
  reviewWhy: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 18,
    flexDirection: 'row',
    padding: 15,
  },
  reviewWhyIcon: {
    color: Colors.violet,
    fontSize: 21,
    fontWeight: '900',
    marginRight: 10,
  },
  reviewWhyBody: {
    flex: 1,
  },
  reviewWhyLabel: {
    color: Colors.violetDeep,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  reviewWhyText: {
    color: Colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  approvalSafety: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginTop: 14,
    paddingHorizontal: 5,
  },
  approvalSafetyIcon: {
    color: Colors.green,
    fontSize: 17,
    fontWeight: '900',
    marginRight: 7,
  },
  approvalSafetyText: {
    color: Colors.muted,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  reviewActions: {
    gap: 10,
    marginTop: 24,
  },
  scheduledState: {
    alignItems: 'center',
    backgroundColor: Colors.greenSoft,
    borderRadius: 17,
    flexDirection: 'row',
    marginTop: 24,
    padding: 15,
  },
  scheduledStateIcon: {
    color: Colors.green,
    fontSize: 21,
    fontWeight: '900',
    marginRight: 10,
  },
  scheduledStateTitle: {
    color: '#087054',
    fontSize: 13,
    fontWeight: '900',
  },
  scheduledStateCopy: {
    color: '#26896C',
    fontSize: 11,
    marginTop: 3,
  },
  alertHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  alertHeading: {
    color: Colors.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 14,
  },
  alertCardUnread: {
    borderColor: '#D9D7FF',
  },
  alertIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    marginRight: 11,
    width: 40,
  },
  alertIconText: {
    fontSize: 17,
    fontWeight: '900',
  },
  alertBody: {
    flex: 1,
    paddingRight: 5,
  },
  alertTitle: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  alertDetail: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  alertTime: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 7,
  },
  alertUnreadDot: {
    borderRadius: 10,
    height: 8,
    marginTop: 3,
    width: 8,
  },
  alertFooter: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 16,
    flexDirection: 'row',
    marginTop: 10,
    padding: 14,
  },
  alertFooterIcon: {
    color: Colors.violet,
    fontSize: 18,
    fontWeight: '900',
    marginRight: 8,
  },
  alertFooterText: {
    color: Colors.inkSoft,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  bottomSafe: {
    backgroundColor: Colors.surface,
  },
  bottomTabs: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: 67,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 54,
  },
  tabIconWrap: {
    height: 26,
    position: 'relative',
  },
  tabIcon: {
    color: Colors.subtle,
    fontSize: 21,
    fontWeight: '800',
  },
  tabIconActive: {
    color: Colors.violet,
  },
  tabNotificationDot: {
    backgroundColor: Colors.rose,
    borderRadius: 5,
    height: 7,
    position: 'absolute',
    right: -4,
    top: 0,
    width: 7,
  },
  jarvisTabOrb: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: Colors.violet,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.23,
    shadowRadius: 12,
    width: 42,
  },
  jarvisTabOrbActive: {
    backgroundColor: Colors.violet,
  },
  jarvisTabIcon: {
    color: Colors.violet,
    fontSize: 19,
    fontWeight: '900',
  },
  tabLabel: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  tabLabelActive: {
    color: Colors.violet,
  },
  modalBackdrop: {
    backgroundColor: '#10142688',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  uploadModal: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#DDE0E8',
    borderRadius: 4,
    height: 4,
    marginBottom: 18,
    width: 42,
  },
  uploadModalTitle: {
    color: Colors.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  uploadModalCopy: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 6,
  },
  demoFileRow: {
    alignItems: 'center',
    borderColor: Colors.line,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 13,
  },
  demoFileIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    marginRight: 10,
    width: 38,
  },
  demoFileIconText: {
    fontSize: 11,
    fontWeight: '900',
  },
  demoFileBody: {
    flex: 1,
  },
  demoFileTitle: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  demoFileCopy: {
    color: Colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  demoFileArrow: {
    color: Colors.subtle,
    fontSize: 25,
  },
  modalRule: {
    backgroundColor: Colors.line,
    height: 1,
    marginVertical: 15,
  },
  modalSafety: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  toast: {
    alignItems: 'center',
    backgroundColor: Colors.ink,
    borderRadius: 16,
    bottom: 100,
    flexDirection: 'row',
    left: 20,
    paddingHorizontal: 15,
    paddingVertical: 13,
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  toastIcon: {
    color: '#5FE5B7',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },
  toastText: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  loginSafe: {
    backgroundColor: Colors.ink,
    flex: 1,
  },
  loginKeyboard: {
    flex: 1,
  },
  loginScroll: {
    flexGrow: 1,
    overflow: 'hidden',
    padding: 24,
    paddingBottom: 30,
  },
  loginGlowOne: {
    backgroundColor: '#635BFF70',
    borderRadius: 180,
    height: 300,
    position: 'absolute',
    right: -105,
    top: -135,
    width: 300,
  },
  loginGlowTwo: {
    backgroundColor: '#16B8D440',
    borderRadius: 150,
    bottom: 120,
    height: 260,
    left: -170,
    position: 'absolute',
    width: 260,
  },
  loginTop: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 9,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    marginRight: 10,
    width: 38,
  },
  logoSpark: {
    color: Colors.violet,
    fontSize: 20,
    fontWeight: '900',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  demoPill: {
    marginLeft: 'auto',
  },
  loginHero: {
    marginBottom: 29,
    marginTop: 55,
  },
  loginTitle: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '900',
    letterSpacing: -1.25,
    lineHeight: 40,
  },
  loginSubtitle: {
    color: '#C7CBE2',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 15,
    maxWidth: 340,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.27,
    shadowRadius: 25,
  },
  loginCardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loginCardTitle: {
    color: Colors.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  loginCardCopy: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 17,
    marginTop: 8,
  },
  fieldLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FAFAFD',
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: Colors.ink,
    fontSize: 14,
    height: 50,
    paddingHorizontal: 13,
  },
  loginError: {
    color: Colors.rose,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 9,
  },
  registrationHint: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 7,
  },
  loginButton: {
    marginTop: 18,
  },
  credentialBox: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 12,
    marginTop: 13,
    padding: 11,
  },
  credentialCaption: {
    color: Colors.violetDeep,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  credentialValue: {
    color: Colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  loginFootnote: {
    color: '#AEB5D2',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 20,
    textAlign: 'center',
  },
  onboardingSafe: {
    backgroundColor: Colors.ink,
    flex: 1,
  },
  onboardingKeyboard: {
    flex: 1,
  },
  onboardingBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  onboardingBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  onboardingStep: {
    color: '#B9C0E7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  welcomeScroll: {
    flexGrow: 1,
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  welcomeHero: {
    marginTop: 68,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.6,
    lineHeight: 46,
    marginTop: 17,
  },
  welcomeCopy: {
    color: '#C8CEE8',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
  },
  welcomeJourney: {
    borderLeftColor: '#59617D',
    borderLeftWidth: 1,
    marginBottom: 30,
    marginLeft: 15,
    marginTop: 35,
    paddingLeft: 21,
  },
  journeyPoint: {
    flexDirection: 'row',
    marginBottom: 22,
    position: 'relative',
  },
  journeyNumber: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderColor: '#8D88FF',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    left: -38,
    position: 'absolute',
    top: 0,
    width: 32,
  },
  journeyNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  journeyBody: {
    flex: 1,
  },
  journeyTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  journeyCopy: {
    color: '#AEB5D2',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  welcomePrimaryButton: {
    marginTop: 2,
  },
  welcomeSecondaryButton: {
    marginTop: 12,
  },
  welcomeSignIn: {
    alignItems: 'center',
    paddingVertical: 17,
  },
  welcomeSignInText: {
    color: '#BBC3E0',
    fontSize: 12,
    fontWeight: '600',
  },
  welcomeSignInLink: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  welcomeSafety: {
    color: '#7E87A9',
    fontSize: 10,
    lineHeight: 15,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  onboardingBack: {
    alignSelf: 'flex-start',
    marginBottom: 22,
    paddingVertical: 5,
  },
  onboardingBackText: {
    color: '#C6CDF0',
    fontSize: 14,
    fontWeight: '800',
  },
  formScroll: {
    flexGrow: 1,
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.9,
    lineHeight: 35,
    marginTop: 34,
  },
  formCopy: {
    color: '#B9C0DB',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 25,
    padding: 20,
  },
  formButton: {
    marginTop: 21,
  },
  verificationProgress: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  verificationProgressText: {
    color: Colors.violetDeep,
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
  },
  onboardingFinePrint: {
    color: '#8C96B9',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 17,
    textAlign: 'center',
  },
  loginBack: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 5,
  },
  loginBackText: {
    color: '#C7CEED',
    fontSize: 13,
    fontWeight: '800',
  },
  choiceRow: {
    alignItems: 'center',
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 9,
    minHeight: 50,
    paddingHorizontal: 13,
  },
  choiceRowActive: {
    backgroundColor: Colors.violetSoft,
    borderColor: '#B2AEFF',
  },
  choiceRadio: {
    alignItems: 'center',
    borderColor: '#B9BFCD',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginRight: 11,
    width: 20,
  },
  choiceRadioActive: {
    borderColor: Colors.violet,
  },
  choiceRadioDot: {
    backgroundColor: Colors.violet,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  choiceCheck: {
    alignItems: 'center',
    borderColor: '#B9BFCD',
    borderRadius: 6,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginRight: 11,
    width: 20,
  },
  choiceCheckActive: {
    backgroundColor: Colors.violet,
    borderColor: Colors.violet,
  },
  choiceCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  choiceText: {
    color: Colors.inkSoft,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: Colors.violetDeep,
    fontWeight: '900',
  },
  setupDataLabel: {
    marginTop: 23,
  },
  setupHint: {
    backgroundColor: Colors.greenSoft,
    borderRadius: 13,
    flexDirection: 'row',
    marginTop: 16,
    padding: 12,
  },
  setupHintIcon: {
    color: Colors.green,
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },
  setupHintText: {
    color: '#23795F',
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  jarvisIntroScroll: {
    alignItems: 'center',
    flexGrow: 1,
    paddingBottom: 30,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  introPill: {
    marginTop: 31,
  },
  jarvisIntroOrbOuter: {
    alignItems: 'center',
    backgroundColor: '#282953',
    borderColor: '#514F9C',
    borderRadius: 94,
    borderWidth: 1,
    height: 188,
    justifyContent: 'center',
    marginTop: 29,
    shadowColor: Colors.violet,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.55,
    shadowRadius: 34,
    width: 188,
  },
  jarvisIntroOrbMiddle: {
    alignItems: 'center',
    backgroundColor: '#414096',
    borderRadius: 67,
    height: 134,
    justifyContent: 'center',
    width: 134,
  },
  jarvisIntroOrb: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 47,
    height: 94,
    justifyContent: 'center',
    width: 94,
  },
  jarvisIntroOrbText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
  },
  introName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 7,
    marginTop: 20,
  },
  introTranscript: {
    alignSelf: 'stretch',
    backgroundColor: '#202442',
    borderColor: '#383E6C',
    borderRadius: 19,
    borderWidth: 1,
    marginTop: 23,
    padding: 17,
  },
  introTranscriptLabel: {
    color: '#AFAAFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  introTranscriptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  introPlayButton: {
    alignSelf: 'stretch',
    marginTop: 13,
  },
  introVoiceNote: {
    color: '#959FC7',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  introPromises: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
  introPromise: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 12,
  },
  introPromiseIcon: {
    color: '#AFAAFF',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 9,
    marginTop: 1,
  },
  introPromiseText: {
    color: '#CBD1EA',
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  introContinueButton: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  agentSummaryCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  agentSummaryStack: {
    flexDirection: 'row',
    marginRight: 11,
  },
  agentSummaryAvatar: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  agentSummaryAvatarOverlap: {
    marginLeft: -9,
  },
  agentSummaryAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  agentSummaryBody: {
    flex: 1,
  },
  agentSummaryTitle: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 18,
  },
  agentSummaryCopy: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  agentSummaryArrow: {
    color: Colors.violet,
    fontSize: 24,
    marginLeft: 8,
  },
  handoffTimeline: {
    backgroundColor: '#F8F8FD',
    borderRadius: 14,
    marginBottom: 15,
    marginTop: 15,
    padding: 12,
  },
  handoffLabel: {
    color: Colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  handoffSteps: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  handoffStep: {
    alignItems: 'center',
  },
  handoffIcon: {
    alignItems: 'center',
    backgroundColor: '#E9EBF2',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  handoffIconActive: {
    backgroundColor: Colors.violetSoft,
  },
  handoffIconText: {
    color: Colors.subtle,
    fontSize: 12,
    fontWeight: '900',
  },
  handoffIconTextActive: {
    color: Colors.violet,
  },
  handoffStepLabel: {
    color: Colors.subtle,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },
  handoffStepLabelActive: {
    color: Colors.violetDeep,
  },
  handoffArrow: {
    color: '#AAB0C3',
    fontSize: 12,
    marginBottom: 13,
  },
  agentStudioHero: {
    backgroundColor: Colors.ink,
    borderRadius: 22,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 18,
  },
  agentStudioOrb: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 13,
    width: 48,
  },
  agentStudioOrbText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },
  agentStudioHeroBody: {
    flex: 1,
  },
  agentStudioTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },
  agentStudioCopy: {
    color: '#C6CCEA',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  directBriefCard: {
    padding: 14,
  },
  agentPickerScroll: {
    paddingRight: 3,
  },
  agentPicker: {
    alignItems: 'center',
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginRight: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  agentPickerActive: {
    backgroundColor: Colors.violetSoft,
    borderColor: '#B5B1FF',
  },
  agentPickerIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    marginRight: 5,
    width: 20,
  },
  agentPickerIconText: {
    fontSize: 11,
    fontWeight: '900',
  },
  agentPickerText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  agentPickerTextActive: {
    color: Colors.violetDeep,
  },
  directBriefHint: {
    color: Colors.violetDeep,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 13,
  },
  directBriefComposer: {
    alignItems: 'flex-end',
    backgroundColor: '#F8F8FC',
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 8,
    minHeight: 69,
    padding: 8,
  },
  directBriefInput: {
    color: Colors.ink,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    maxHeight: 85,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  directBriefSend: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  directBriefSendDisabled: {
    backgroundColor: '#D9DCE8',
  },
  directBriefSendText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  directBriefSafety: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 9,
  },
  agentRunCard: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 11,
    padding: 15,
  },
  agentRunTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agentRunTime: {
    color: Colors.subtle,
    fontSize: 10,
    fontWeight: '700',
  },
  agentRunTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 11,
  },
  agentRunOutput: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  agentRunFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  runAvatarStack: {
    flexDirection: 'row',
  },
  runAvatar: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  runAvatarOverlap: {
    marginLeft: -6,
  },
  runAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  agentRunFooterText: {
    color: Colors.violet,
    fontSize: 11,
    fontWeight: '800',
  },
  ownerReviewBanner: {
    alignItems: 'center',
    backgroundColor: Colors.amberSoft,
    borderColor: '#F8D98C',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 2,
    padding: 13,
  },
  ownerReviewIcon: {
    alignItems: 'center',
    backgroundColor: Colors.amber,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 10,
    width: 28,
  },
  ownerReviewIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  ownerReviewBody: {
    flex: 1,
  },
  ownerReviewTitle: {
    color: '#8D5900',
    fontSize: 12,
    fontWeight: '900',
  },
  ownerReviewCopy: {
    color: '#9D6D18',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  ownerReviewArrow: {
    color: '#9D6D18',
    fontSize: 23,
  },
  agentCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: Colors.line,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 9,
    padding: 13,
  },
  agentCardIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    marginRight: 11,
    width: 34,
  },
  agentCardIconText: {
    fontSize: 17,
    fontWeight: '900',
  },
  agentCardBody: {
    flex: 1,
  },
  agentCardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agentCardName: {
    color: Colors.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  agentCardRole: {
    color: Colors.violetDeep,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  agentCardTask: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  agentCardArrow: {
    color: Colors.violet,
    fontSize: 22,
    marginLeft: 7,
  },
  integrationNotice: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 14,
    flexDirection: 'row',
    marginBottom: 11,
    padding: 12,
  },
  integrationNoticeIcon: {
    color: Colors.violet,
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },
  integrationNoticeText: {
    color: Colors.violetDeep,
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
  },
  integrationCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: Colors.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 9,
    padding: 12,
  },
  integrationIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginRight: 10,
    width: 32,
  },
  integrationIconText: {
    fontSize: 14,
    fontWeight: '900',
  },
  integrationBody: {
    flex: 1,
  },
  integrationName: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  integrationCapability: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  integrationStatus: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 3,
  },
  integrationAction: {
    backgroundColor: Colors.violetSoft,
    borderRadius: 10,
    marginLeft: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  integrationActionConnected: {
    backgroundColor: Colors.greenSoft,
  },
  integrationActionText: {
    color: Colors.violetDeep,
    fontSize: 10,
    fontWeight: '900',
  },
  integrationActionTextConnected: {
    color: '#147354',
  },
  dataContextCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  dataContextIcon: {
    alignItems: 'center',
    backgroundColor: Colors.greenSoft,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    marginRight: 11,
    width: 34,
  },
  dataContextIconText: {
    color: Colors.green,
    fontSize: 18,
    fontWeight: '900',
  },
  dataContextBody: {
    flex: 1,
  },
  dataContextTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  dataContextCopy: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  dataContextArrow: {
    color: Colors.violet,
    fontSize: 22,
    marginLeft: 7,
  },
  logoutButton: {
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 27,
    padding: 14,
  },
  logoutText: {
    color: Colors.rose,
    fontSize: 12,
    fontWeight: '900',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerSettingsButton: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginRight: 10,
    width: 42,
  },
  headerSettingsIcon: {
    color: Colors.inkSoft,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyTrend: {
    alignItems: 'center',
    borderColor: '#2D375F',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 17,
    minHeight: 59,
    paddingHorizontal: 12,
  },
  emptyTrendText: {
    color: '#BFC5E6',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  leadsEmptyState: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: 12,
    padding: 22,
  },
  leadsEmptyIcon: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  leadsEmptyIconText: {
    color: Colors.violet,
    fontSize: 21,
    fontWeight: '900',
  },
  leadsEmptyTitle: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 13,
    textAlign: 'center',
  },
  leadsEmptyCopy: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 5,
    textAlign: 'center',
  },
  uploadPickerButton: {
    marginTop: 18,
  },
  uploadTypeRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  uploadTypePill: {
    marginLeft: 7,
  },
  demoSamplesLabel: {
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  notificationEmptyState: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: 4,
    padding: 24,
  },
  notificationEmptyIcon: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 18,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notificationEmptyIconText: {
    color: Colors.violet,
    fontSize: 22,
    fontWeight: '900',
  },
  notificationEmptyTitle: {
    color: Colors.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 13,
  },
  notificationEmptyCopy: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  settingsHero: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderColor: '#DBD9FF',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
  settingsHeroIcon: {
    alignItems: 'center',
    backgroundColor: Colors.violet,
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    marginRight: 13,
    width: 44,
  },
  settingsHeroIconText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  settingsHeroBody: {
    flex: 1,
  },
  settingsHeroTitle: {
    color: Colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  settingsHeroCopy: {
    color: Colors.inkSoft,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  settingsSaveButton: {
    marginTop: 5,
  },
  settingsCardNoPadding: {
    overflow: 'hidden',
    padding: 0,
  },
  notificationPreferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 14,
  },
  notificationPreferenceIcon: {
    alignItems: 'center',
    backgroundColor: Colors.violetSoft,
    borderRadius: 13,
    height: 31,
    justifyContent: 'center',
    marginRight: 10,
    width: 31,
  },
  notificationPreferenceIconText: {
    color: Colors.violet,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationPreferenceBody: {
    flex: 1,
    paddingRight: 8,
  },
  notificationPreferenceTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  notificationPreferenceCopy: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  settingsHint: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },
  documentsList: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  documentRow: {
    alignItems: 'center',
    borderBottomColor: Colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    padding: 13,
  },
  documentIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 34,
    justifyContent: 'center',
    marginRight: 11,
    width: 34,
  },
  documentIconText: {
    fontSize: 11,
    fontWeight: '900',
  },
  documentBody: {
    flex: 1,
  },
  documentName: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  documentMeta: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 3,
  },
  settingsUploadEmpty: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    padding: 14,
  },
  settingsUploadEmptyIcon: {
    alignItems: 'center',
    backgroundColor: Colors.greenSoft,
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    marginRight: 11,
    width: 34,
  },
  settingsUploadEmptyIconText: {
    color: Colors.green,
    fontSize: 17,
    fontWeight: '900',
  },
  settingsUploadEmptyBody: {
    flex: 1,
  },
  settingsUploadEmptyTitle: {
    color: Colors.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  settingsUploadEmptyCopy: {
    color: Colors.muted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  settingsUploadEmptyArrow: {
    color: Colors.violet,
    fontSize: 22,
    marginLeft: 7,
  },
  settingsSecurityCopy: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
});

export default App;
