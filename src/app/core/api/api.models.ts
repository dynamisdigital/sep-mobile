export type UsuarioRole = 'ADMIN' | 'CLIENTE';

export interface UsuarioResponse {
  id: string;
  username: string;
  role: UsuarioRole;
  dataCriacao: string;
  dataModificacao: string;
  criadoPor: string;
  modificadoPor: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  usuario: UsuarioResponse;
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
