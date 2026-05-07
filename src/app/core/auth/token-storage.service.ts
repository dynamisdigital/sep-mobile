import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'sep.auth.accessToken';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value ?? null;
  }

  async setToken(token: string): Promise<void> {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }

  async clearToken(): Promise<void> {
    await Preferences.remove({ key: TOKEN_KEY });
  }
}
