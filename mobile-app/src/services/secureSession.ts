import * as Keychain from 'react-native-keychain';

import {GatewayAuthSession} from './tomanApi';

const SERVICE = 'ai.toman.sales.session';
const USERNAME = 'refresh-session';

/**
 * Only the rotating refresh token is stored in the native secure keystore.
 * Access JWTs remain in memory and are replaced after a refresh.
 */
export interface PersistedRefreshSession {
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export async function saveRefreshSession(session: GatewayAuthSession): Promise<void> {
  const payload: PersistedRefreshSession = {
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  };
  await Keychain.setGenericPassword(USERNAME, JSON.stringify(payload), {service: SERVICE});
}

export async function loadRefreshSession(): Promise<PersistedRefreshSession | null> {
  const credentials = await Keychain.getGenericPassword({service: SERVICE});
  if (!credentials) {
    return null;
  }
  try {
    const parsed = JSON.parse(credentials.password) as Partial<PersistedRefreshSession>;
    if (!parsed.refreshToken || !parsed.refreshTokenExpiresAt) {
      await clearRefreshSession();
      return null;
    }
    if (Date.parse(parsed.refreshTokenExpiresAt) <= Date.now()) {
      await clearRefreshSession();
      return null;
    }
    return {
      refreshToken: parsed.refreshToken,
      refreshTokenExpiresAt: parsed.refreshTokenExpiresAt,
    };
  } catch {
    await clearRefreshSession();
    return null;
  }
}

export async function clearRefreshSession(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}
