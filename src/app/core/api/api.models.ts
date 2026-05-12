export type UsuarioRole = 'ADMIN' | 'CLIENTE';

export interface UsuarioResponse {
  id: string;
  username: string;
  role: UsuarioRole;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
  // M-Sprint 5: flags de seguranca propagadas pelo backend.
  precisaRedefinirSenha: boolean;
  mfaHabilitado: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string | null;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string | null;
  usuario: UsuarioResponse | null;
  mfaRequired: boolean;
  mfaChallengeId: string | null;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface TotpVerifyRequest {
  mfaChallengeId: string;
  codigo: string;
}

// 5F-FIX-05: step-up authentication mobile.
export interface StepUpInitiateResponse {
  stepUpChallengeId: string;
}

export interface StepUpCompleteRequest {
  stepUpChallengeId: string;
  codigo: string;
}

export interface StepUpCompleteResponse {
  stepUpToken: string;
}

export interface UsuarioCreateRequest {
  username: string;
  password: string;
  role: UsuarioRole;
}

export interface UsuarioSenhaUpdateRequest {
  passwordAtual: string;
  novaSenha: string;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  traceId?: string;
}
