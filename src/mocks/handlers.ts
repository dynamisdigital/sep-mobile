import { http, HttpResponse } from 'msw';

const baseUrl = 'http://localhost:8080/api/v1';

// Mocks alinhados com PRD §21 (contratos iniciais).
// Mobile cobre perfil CLIENTE (escopo tomador/credora).
// Stubs para a M-Sprint 0; M-Sprint 2/3 substituem por mocks reais.
export const handlers = [
  http.post(`${baseUrl}/auth/login`, () =>
    HttpResponse.json({
      accessToken: 'mock-jwt-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      usuario: {
        id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
        username: 'cliente@empresa.com',
        role: 'CLIENTE',
        dataCriacao: '2026-04-24T18:30:00-03:00',
        dataModificacao: '2026-04-24T18:30:00-03:00',
        criadoPor: 'system',
        modificadoPor: 'system',
      },
    }),
  ),

  http.get(`${baseUrl}/auth/me`, () =>
    HttpResponse.json({
      id: '1f0799c0-98b9-6d9d-bc4a-7d6f5b771001',
      username: 'cliente@empresa.com',
      role: 'CLIENTE',
      dataCriacao: '2026-04-24T18:30:00-03:00',
      dataModificacao: '2026-04-24T18:30:00-03:00',
      criadoPor: 'system',
      modificadoPor: 'system',
    }),
  ),
];
