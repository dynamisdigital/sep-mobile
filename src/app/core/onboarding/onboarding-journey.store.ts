import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const JOURNEY_KEY = 'sep.onboarding.journey';

// Persiste apenas o ponteiro da jornada (tipo + id da solicitacao). Necessario porque
// o backend nao expoe consulta do onboarding corrente por usuario: sem este ponteiro,
// recarregar o app perderia a jornada e um novo POST do mesmo CPF/CNPJ retornaria 409.
// Nao guarda PII (CPF/CNPJ/dados ficam apenas no backend).
export interface OnboardingJourney {
  tipo: 'PF' | 'PJ';
  onboardingId: string;
}

@Injectable({ providedIn: 'root' })
export class OnboardingJourneyStore {
  async carregar(): Promise<OnboardingJourney | null> {
    const { value } = await Preferences.get({ key: JOURNEY_KEY });
    if (!value) {
      return null;
    }
    try {
      return validar(JSON.parse(value));
    } catch {
      return null;
    }
  }

  async salvar(journey: OnboardingJourney): Promise<void> {
    await Preferences.set({ key: JOURNEY_KEY, value: JSON.stringify(journey) });
  }

  async limpar(): Promise<void> {
    await Preferences.remove({ key: JOURNEY_KEY });
  }
}

// Valida a forma do ponteiro persistido: descarta conteudo parcial/corrompido em vez
// de propagar um onboardingId ausente para a jornada.
function validar(parsed: unknown): OnboardingJourney | null {
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'tipo' in parsed &&
    'onboardingId' in parsed
  ) {
    const { tipo, onboardingId } = parsed as Record<string, unknown>;
    if ((tipo === 'PF' || tipo === 'PJ') && typeof onboardingId === 'string' && onboardingId) {
      return { tipo, onboardingId };
    }
  }
  return null;
}
