import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const ACCESS_TOKEN_KEY = 'sep.auth.accessToken';
const REFRESH_TOKEN_KEY = 'sep.auth.refreshToken';
const TRUST_DEVICE_KEY = 'sep.auth.trustDevice';
const PENDING_MFA_KEY = 'sep.auth.pendingMfaChallenge';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: ACCESS_TOKEN_KEY });
    return value ?? null;
  }

  async setToken(token: string): Promise<void> {
    await Preferences.set({ key: ACCESS_TOKEN_KEY, value: token });
  }

  async clearToken(): Promise<void> {
    await Preferences.remove({ key: ACCESS_TOKEN_KEY });
  }

  async getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return value ?? null;
  }

  async setRefreshToken(token: string): Promise<void> {
    await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
  }

  async clearRefreshToken(): Promise<void> {
    await Preferences.remove({ key: REFRESH_TOKEN_KEY });
  }

  async getTrustDevice(): Promise<boolean> {
    const { value } = await Preferences.get({ key: TRUST_DEVICE_KEY });
    return value === 'true';
  }

  async setTrustDevice(trust: boolean): Promise<void> {
    await Preferences.set({ key: TRUST_DEVICE_KEY, value: trust ? 'true' : 'false' });
  }

  async clearTrustDevice(): Promise<void> {
    await Preferences.remove({ key: TRUST_DEVICE_KEY });
  }

  async getPendingMfaChallenge(): Promise<string | null> {
    const { value } = await Preferences.get({ key: PENDING_MFA_KEY });
    return value ?? null;
  }

  async setPendingMfaChallenge(challengeId: string): Promise<void> {
    await Preferences.set({ key: PENDING_MFA_KEY, value: challengeId });
  }

  async clearPendingMfaChallenge(): Promise<void> {
    await Preferences.remove({ key: PENDING_MFA_KEY });
  }

  async clearAll(): Promise<void> {
    await this.clearToken();
    await this.clearRefreshToken();
    await this.clearPendingMfaChallenge();
  }
}
