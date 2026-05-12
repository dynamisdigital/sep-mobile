import { http, HttpResponse } from 'msw';

import type {
  ApiErrorResponse,
  LoginRequest,
  TokenResponse,
  UsuarioCreateRequest,
  UsuarioResponse,
} from '../app/core/api/api.models';

const baseUrl = 'http://localhost:8080/api/v1';

const MOCK_TOKEN = 'mock-jwt-token';
const MOCK_REFRESH = 'mock-refresh-token';

const usuarioCliente: UsuarioResponse = {
  id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
  username: 'cliente@empresa.com',
  role: 'CLIENTE',
  dataCriacao: '2026-04-24T18:30:00-03:00',
  dataModificacao: '2026-04-24T18:30:00-03:00',
  criadoPor: 'system',
  modificadoPor: 'system',
  precisaRedefinirSenha: false,
  mfaHabilitado: false,
};

function errorResponse(
  status: number,
  error: string,
  message: string,
  path: string,
): ApiErrorResponse {
  return {
    timestamp: new Date().toISOString(),
    status,
    error,
    message,
    path,
  };
}

export const handlers = [
  http.post(`${baseUrl}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    if (body.username === 'cliente@empresa.com' && body.password === 'senha-passphrase-segura') {
      const tokenResponse: TokenResponse = {
        accessToken: MOCK_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 900,
        refreshToken: MOCK_REFRESH,
        usuario: usuarioCliente,
        mfaRequired: false,
        mfaChallengeId: null,
      };
      return HttpResponse.json(tokenResponse, { status: 200 });
    }
    return HttpResponse.json(
      errorResponse(401, 'Unauthorized', 'Credenciais invalidas', '/api/v1/auth/login'),
      { status: 401 },
    );
  }),

  http.get(`${baseUrl}/auth/me`, ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (auth === `Bearer ${MOCK_TOKEN}`) {
      return HttpResponse.json(usuarioCliente, { status: 200 });
    }
    return HttpResponse.json(
      errorResponse(401, 'Unauthorized', 'Token invalido ou ausente', '/api/v1/auth/me'),
      { status: 401 },
    );
  }),

  http.post(`${baseUrl}/usuarios`, async ({ request }) => {
    const body = (await request.json()) as UsuarioCreateRequest;
    const path = '/api/v1/usuarios';

    if (body.username === 'duplicado@empresa.com') {
      return HttpResponse.json(errorResponse(409, 'Conflict', 'username ja existe', path), {
        status: 409,
      });
    }
    if (!body.password || body.password.length < 12) {
      return HttpResponse.json(
        errorResponse(
          400,
          'Bad Request',
          'Senha nao atende a politica de seguranca: minimo 12 caracteres OU passphrase 4+ palavras',
          path,
        ),
        { status: 400 },
      );
    }
    if (body.role !== 'ADMIN' && body.role !== 'CLIENTE') {
      return HttpResponse.json(
        errorResponse(400, 'Bad Request', 'role deve ser ADMIN ou CLIENTE', path),
        { status: 400 },
      );
    }

    const novoUsuario: UsuarioResponse = {
      id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771010',
      username: body.username,
      role: body.role,
      dataCriacao: '2026-04-24T18:30:00-03:00',
      dataModificacao: '2026-04-24T18:30:00-03:00',
      criadoPor: 'system',
      modificadoPor: 'system',
      precisaRedefinirSenha: false,
      mfaHabilitado: false,
    };
    return HttpResponse.json(novoUsuario, { status: 201 });
  }),
];
