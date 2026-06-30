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
  // MFA habilitado: o aceite contratual (M-8) exige step-up. Apenas change-password e o aceite
  // consomem esta flag, ambos na submissao; os demais smokes nao tocam step-up.
  mfaHabilitado: true,
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

const baseHandlers = [
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

// --- Onboarding (KYC PF / KYB PJ) ---------------------------------------------------
// Estado em memoria para dev + e2e. Cenarios por documento de entrada:
//   - documento so com zeros  -> erro (409 ao iniciar);
//   - documento so com uns     -> pendencia (verificar resulta em PENDENCIA);
//   - qualquer outro           -> caminho feliz (verificar -> EM_VERIFICACAO).

type OnbScenario = 'feliz' | 'pendencia';

interface OnbState {
  id: string;
  tipo: 'PF' | 'PJ';
  status: string;
  docs: { id: string; tipo: string; dataEnvio: string; sha256: string }[];
  resultado: { statusFinal: string; motivo: string | null; dataResultado: string } | null;
  cenario: OnbScenario;
  empresa: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    tipoSocietario: string | null;
    porte: string | null;
  } | null;
}

const onboardings = new Map<string, OnbState>();
let onboardingSeq = 0;

function soDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

function cenarioDoDocumento(documento: string): OnbScenario | 'erro' {
  const digitos = soDigitos(documento);
  if (/^0+$/.test(digitos)) return 'erro';
  if (/^1+$/.test(digitos)) return 'pendencia';
  return 'feliz';
}

function statusPessoaResponse(estado: OnbState) {
  return {
    id: estado.id,
    status: estado.status,
    dataCriacao: '2026-04-24T18:30:00-03:00',
    dataModificacao: '2026-04-24T18:30:00-03:00',
    documentosEnviados: estado.docs,
    resultado: estado.resultado,
  };
}

function statusEmpresaResponse(estado: OnbState) {
  return {
    id: estado.id,
    status: estado.status,
    dataCriacao: '2026-04-24T18:30:00-03:00',
    dataModificacao: '2026-04-24T18:30:00-03:00',
    dadosEmpresa: estado.empresa,
    documentosEnviados: estado.docs,
    representantes: [],
    resultado: estado.resultado,
  };
}

function registrarDocumento(estado: OnbState, tipo: string): void {
  estado.docs.push({
    id: `doc-${estado.id}-${estado.docs.length + 1}`,
    tipo,
    dataEnvio: new Date().toISOString(),
    sha256: 'mock-sha256',
  });
  estado.status = 'DOCUMENTOS_RECEBIDOS';
}

function aplicarVerificacao(estado: OnbState): void {
  if (estado.cenario === 'pendencia') {
    estado.status = 'PENDENCIA';
    estado.resultado = {
      statusFinal: 'PENDENCIA',
      motivo: 'Documentos ilegiveis. Reenvie os documentos.',
      dataResultado: new Date().toISOString(),
    };
    return;
  }
  estado.status = 'EM_VERIFICACAO';
}

const onboardingHandlers = [
  http.post(`${baseUrl}/onboarding/pessoa`, async ({ request }) => {
    const body = (await request.json()) as { cpf: string };
    const path = '/api/v1/onboarding/pessoa';
    const cenario = cenarioDoDocumento(body.cpf);
    if (cenario === 'erro') {
      return HttpResponse.json(
        errorResponse(409, 'Conflict', 'Ja existe onboarding ativo para este CPF', path),
        { status: 409 },
      );
    }
    const id = `pf-mock-${++onboardingSeq}`;
    onboardings.set(id, {
      id,
      tipo: 'PF',
      status: 'INICIADO',
      docs: [],
      resultado: null,
      cenario,
      empresa: null,
    });
    return HttpResponse.json(
      {
        id,
        status: 'INICIADO',
        dataCriacao: '2026-04-24T18:30:00-03:00',
        dataModificacao: '2026-04-24T18:30:00-03:00',
      },
      { status: 201 },
    );
  }),

  http.post(`${baseUrl}/onboarding/empresa`, async ({ request }) => {
    const body = (await request.json()) as {
      cnpj: string;
      razaoSocial: string;
      nomeFantasia?: string;
      tipoSocietario?: string;
      porte?: string;
    };
    const path = '/api/v1/onboarding/empresa';
    const cenario = cenarioDoDocumento(body.cnpj);
    if (cenario === 'erro') {
      return HttpResponse.json(
        errorResponse(409, 'Conflict', 'Ja existe onboarding ativo para este CNPJ', path),
        { status: 409 },
      );
    }
    const id = `pj-mock-${++onboardingSeq}`;
    onboardings.set(id, {
      id,
      tipo: 'PJ',
      status: 'INICIADO',
      docs: [],
      resultado: null,
      cenario,
      empresa: {
        cnpj: body.cnpj,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia ?? null,
        tipoSocietario: body.tipoSocietario ?? null,
        porte: body.porte ?? null,
      },
    });
    return HttpResponse.json(
      {
        id,
        status: 'INICIADO',
        cnpj: body.cnpj,
        razaoSocial: body.razaoSocial,
        dataCriacao: '2026-04-24T18:30:00-03:00',
        dataModificacao: '2026-04-24T18:30:00-03:00',
      },
      { status: 201 },
    );
  }),

  http.post(`${baseUrl}/onboarding/pessoa/:id/documentos`, async ({ params, request }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/pessoa'),
        { status: 404 },
      );
    }
    const form = await request.formData();
    registrarDocumento(estado, String(form.get('tipo')));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${baseUrl}/onboarding/empresa/:id/documentos`, async ({ params, request }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/empresa'),
        { status: 404 },
      );
    }
    const form = await request.formData();
    registrarDocumento(estado, String(form.get('tipo')));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${baseUrl}/onboarding/pessoa/:id/verificar`, ({ params }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/pessoa'),
        { status: 404 },
      );
    }
    aplicarVerificacao(estado);
    return new HttpResponse(null, { status: 202 });
  }),

  http.post(`${baseUrl}/onboarding/empresa/:id/verificar`, ({ params }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/empresa'),
        { status: 404 },
      );
    }
    aplicarVerificacao(estado);
    return new HttpResponse(null, { status: 202 });
  }),

  http.get(`${baseUrl}/onboarding/pessoa/:id`, ({ params }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/pessoa'),
        { status: 404 },
      );
    }
    return HttpResponse.json(statusPessoaResponse(estado), { status: 200 });
  }),

  http.get(`${baseUrl}/onboarding/empresa/:id`, ({ params }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/empresa'),
        { status: 404 },
      );
    }
    return HttpResponse.json(statusEmpresaResponse(estado), { status: 200 });
  }),

  http.get(`${baseUrl}/onboarding/empresa/:id/representantes`, ({ params }) => {
    const estado = onboardings.get(String(params['id']));
    if (!estado) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Solicitacao nao encontrada', '/api/v1/onboarding/empresa'),
        { status: 404 },
      );
    }
    return HttpResponse.json([], { status: 200 });
  }),
];

// --- Credito + Open Finance (Sprints 8-9) -------------------------------------------
// Estado em memoria para dev + e2e. Gatilhos por `solicitacaoOnboardingId`:
//   - so zeros  -> 422 (onboarding nao esta APROVADO_FINAL);
//   - 'inexistente' -> 404. Qualquer outro -> 201 (proposta EM_ANALISE).
// O consentimento Open Finance simula autorizacao instantanea: o provider "redireciona"
// de volta pela propria redirectUri do app, deixando o status AUTORIZADO com agregados
// ficticios (sem PII bancaria real: nada de conta/agencia/titular/documento).

const TOMADOR_ID = usuarioCliente.id;

interface PropostaMock {
  id: string;
  tomadorId: string;
  solicitacaoOnboardingId: string;
  tipoOperacao: string;
  valorSolicitado: number;
  moeda: string;
  prazoMeses: number;
  status: string;
  dataCriacao: string;
  dataModificacao: string;
  score: null;
  parecer: null;
}

interface OpenFinanceMock {
  statusConsentimento: string;
  dataInicio: string;
  dataAutorizacao: string | null;
  dataExpiracao: string | null;
  ultimaMovimentacao: {
    mediaEntradasMensal: number;
    mediaSaidasMensal: number;
    saldoMedio: number;
    numeroMesesAvaliados: number;
    dataRecebimento: string;
  } | null;
}

// Estado persistido em localStorage (quando disponivel) para sobreviver ao reload do handoff
// Open Finance no e2e; em node (vitest server) cai para memoria via try/catch.
const PROPOSTAS_KEY = 'mock.credito.propostas';
const OPEN_FINANCE_KEY = 'mock.credito.openfinance';

function lerEstado<T>(chave: string, padrao: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
}

function salvarEstado(chave: string, valor: unknown): void {
  try {
    globalThis.localStorage?.setItem(chave, JSON.stringify(valor));
  } catch {
    // node (vitest): sem localStorage — os handlers de credito nao sao usados la.
  }
}

function lerPropostas(): PropostaMock[] {
  return lerEstado<PropostaMock[]>(PROPOSTAS_KEY, []);
}

function lerOpenFinance(): Record<string, OpenFinanceMock> {
  return lerEstado<Record<string, OpenFinanceMock>>(OPEN_FINANCE_KEY, {});
}

function pageResponse<T>(lista: T[], page: number, size: number) {
  const inicio = page * size;
  const conteudo = lista.slice(inicio, inicio + size);
  return {
    content: conteudo,
    totalElements: lista.length,
    totalPages: Math.max(1, Math.ceil(lista.length / size)),
    number: page,
    size,
    first: page === 0,
    last: inicio + size >= lista.length,
    numberOfElements: conteudo.length,
    empty: conteudo.length === 0,
  };
}

const creditoHandlers = [
  http.get(`${baseUrl}/credito/propostas`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Number(url.searchParams.get('page') ?? '0');
    const size = Number(url.searchParams.get('size') ?? '20');
    const lista = lerPropostas().filter((p) => !status || p.status === status);
    return HttpResponse.json(pageResponse(lista, page, size), { status: 200 });
  }),

  http.get(`${baseUrl}/credito/propostas/:id`, ({ params }) => {
    const proposta = lerPropostas().find((p) => p.id === String(params['id']));
    if (!proposta) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Proposta nao encontrada', '/api/v1/credito/propostas'),
        { status: 404 },
      );
    }
    return HttpResponse.json(proposta, { status: 200 });
  }),

  http.post(`${baseUrl}/credito/propostas`, async ({ request }) => {
    const body = (await request.json()) as {
      solicitacaoOnboardingId: string;
      tipoOperacao: string;
      valorSolicitado: number;
      prazoMeses: number;
    };
    const path = '/api/v1/credito/propostas';
    const onboardingId = soDigitos(body.solicitacaoOnboardingId);
    if (/^0+$/.test(onboardingId)) {
      return HttpResponse.json(
        errorResponse(422, 'Unprocessable Entity', 'Onboarding nao esta APROVADO_FINAL', path),
        { status: 422 },
      );
    }
    if (body.solicitacaoOnboardingId === 'inexistente') {
      return HttpResponse.json(errorResponse(404, 'Not Found', 'Onboarding nao encontrado', path), {
        status: 404,
      });
    }
    const lista = lerPropostas();
    const id = `prop-mock-${lista.length + 1}`;
    const agora = new Date().toISOString();
    const proposta: PropostaMock = {
      id,
      tomadorId: TOMADOR_ID,
      solicitacaoOnboardingId: body.solicitacaoOnboardingId,
      tipoOperacao: body.tipoOperacao,
      valorSolicitado: body.valorSolicitado,
      moeda: 'BRL',
      prazoMeses: body.prazoMeses,
      status: 'EM_ANALISE',
      dataCriacao: agora,
      dataModificacao: agora,
      score: null,
      parecer: null,
    };
    salvarEstado(PROPOSTAS_KEY, [...lista, proposta]);
    return HttpResponse.json(proposta, { status: 201 });
  }),

  http.post(
    `${baseUrl}/credito/propostas/:id/open-finance/consentimento`,
    async ({ params, request }) => {
      const id = String(params['id']);
      const path = '/api/v1/credito/propostas';
      if (!lerPropostas().some((p) => p.id === id)) {
        return HttpResponse.json(errorResponse(404, 'Not Found', 'Proposta nao encontrada', path), {
          status: 404,
        });
      }
      const mapa = lerOpenFinance();
      if (mapa[id]?.statusConsentimento === 'PENDENTE') {
        return HttpResponse.json(
          errorResponse(409, 'Conflict', 'Ja existe consentimento PENDENTE', path),
          { status: 409 },
        );
      }
      const body = (await request.json()) as { cpfCnpjTomador: string; redirectUri: string };
      const agora = new Date().toISOString();
      // Consentimento nasce PENDENTE (consistente com a resposta), sem agregados ainda.
      mapa[id] = {
        statusConsentimento: 'PENDENTE',
        dataInicio: agora,
        dataAutorizacao: null,
        dataExpiracao: null,
        ultimaMovimentacao: null,
      };
      salvarEstado(OPEN_FINANCE_KEY, mapa);
      // O provider mock "redireciona" de volta pela propria redirectUri do app.
      return HttpResponse.json(
        {
          consentimentoId: `consent-mock-${id}`,
          status: 'PENDENTE',
          urlAutorizacao: body.redirectUri,
          dataExpiracao: null,
        },
        { status: 201 },
      );
    },
  ),

  http.get(`${baseUrl}/credito/propostas/:id/open-finance`, ({ params }) => {
    const id = String(params['id']);
    const mapa = lerOpenFinance();
    const estado = mapa[id];
    if (!estado) {
      return HttpResponse.json(
        errorResponse(
          404,
          'Not Found',
          'Consentimento nao encontrado',
          '/api/v1/credito/propostas',
        ),
        { status: 404 },
      );
    }
    // Simula a autorizacao concluindo durante o handoff: o primeiro GET apos PENDENTE
    // avanca para AUTORIZADO com agregados ficticios e persiste o novo estado.
    if (estado.statusConsentimento === 'PENDENTE') {
      const agora = new Date().toISOString();
      estado.statusConsentimento = 'AUTORIZADO';
      estado.dataAutorizacao = agora;
      estado.ultimaMovimentacao = {
        mediaEntradasMensal: 8500,
        mediaSaidasMensal: 6200,
        saldoMedio: 3400,
        numeroMesesAvaliados: 6,
        dataRecebimento: agora,
      };
      salvarEstado(OPEN_FINANCE_KEY, mapa);
    }
    return HttpResponse.json(estado, { status: 200 });
  }),
];

// --- Step-up authentication (5F-FIX-05) --------------------------------------------
// Challenge + token ficticios. O token e de uso unico no store do app; aqui o complete
// devolve sempre o mesmo valor para o e2e. Nenhum segredo real e usado.
const stepUpHandlers = [
  http.post(`${baseUrl}/auth/step-up/initiate`, () =>
    HttpResponse.json({ stepUpChallengeId: 'mock-step-up-challenge' }, { status: 200 }),
  ),

  http.post(`${baseUrl}/auth/step-up/complete`, () =>
    HttpResponse.json({ stepUpToken: 'mock-step-up-token' }, { status: 200 }),
  ),
];

// --- Formalizacao / contratos (Sprints 10-11; M-Sprint 8) ---------------------------
// Estado minimo em localStorage para sobreviver ao reload do step-up no e2e (em node cai
// para memoria). So responde para a proposta/contrato semeados pelo smoke; demais ids -> 404,
// entao os outros smokes nao sao afetados. Dados e PDF integralmente ficticios; nenhum
// conteudo real, token ou PII e persistido. O envelope avanca a cada consulta ate ASSINADO.

const PROPOSTA_FORMALIZACAO_ID = 'prop-formalizacao-1';
const CONTRATO_FORMALIZACAO_ID = 'contrato-mock-1';
const FORMALIZACAO_KEY = 'mock.formalizacao';

interface FormalizacaoState {
  status: string;
}

function lerFormalizacao(): FormalizacaoState {
  return lerEstado<FormalizacaoState>(FORMALIZACAO_KEY, { status: 'AGUARDANDO_ACEITE' });
}

function versaoContratoMock(numero: number) {
  return {
    id: `versao-mock-${numero}`,
    numero,
    conteudoTexto:
      `Versao ${numero} - condicoes gerais ficticias do contrato de mutuo. ` +
      'Este texto e apenas um exemplo para leitura no aplicativo.',
    hashSha256: `mockhash000000000000000000000000000000000000000000000000000000${numero}`,
    dataGeracao: '2026-06-20T10:00:00-03:00',
    parecerOrigemId: null,
    clausulas: [
      {
        id: `cl-${numero}-1`,
        ordem: 1,
        titulo: 'OBJETO',
        texto: 'O objeto do contrato e ficticio.',
      },
      { id: `cl-${numero}-2`, ordem: 2, titulo: 'PRAZO', texto: 'O prazo do contrato e ficticio.' },
    ],
  };
}

function contratoMock(status: string) {
  return {
    id: CONTRATO_FORMALIZACAO_ID,
    propostaId: PROPOSTA_FORMALIZACAO_ID,
    tomadorId: TOMADOR_ID,
    tipo: 'MUTUO',
    status,
    versaoVigente: versaoContratoMock(2),
    aceite: null,
    dataCriacao: '2026-06-20T10:00:00-03:00',
    dataModificacao: '2026-06-20T10:05:00-03:00',
  };
}

function contratoNaoEncontrado(path: string) {
  return HttpResponse.json(errorResponse(404, 'Not Found', 'Contrato nao encontrado', path), {
    status: 404,
  });
}

const formalizacaoHandlers = [
  http.get(`${baseUrl}/contratos/proposta/:propostaId`, ({ params }) => {
    if (String(params['propostaId']) !== PROPOSTA_FORMALIZACAO_ID) {
      return contratoNaoEncontrado('/api/v1/contratos/proposta');
    }
    return HttpResponse.json(contratoMock(lerFormalizacao().status), { status: 200 });
  }),

  http.get(`${baseUrl}/contratos/:id/versoes`, ({ params }) => {
    if (String(params['id']) !== CONTRATO_FORMALIZACAO_ID) {
      return contratoNaoEncontrado('/api/v1/contratos/versoes');
    }
    return HttpResponse.json([versaoContratoMock(1), versaoContratoMock(2)], { status: 200 });
  }),

  http.patch(`${baseUrl}/contratos/:id/aceite`, ({ params, request }) => {
    const path = '/api/v1/contratos/aceite';
    if (String(params['id']) !== CONTRATO_FORMALIZACAO_ID) {
      return contratoNaoEncontrado(path);
    }
    if (!request.headers.get('X-Step-Up-Token')) {
      return HttpResponse.json(errorResponse(403, 'Forbidden', 'step-up obrigatorio', path), {
        status: 403,
      });
    }
    salvarEstado(FORMALIZACAO_KEY, { status: 'ACEITO' });
    return HttpResponse.json(contratoMock('ACEITO'), { status: 200 });
  }),

  http.get(`${baseUrl}/contratos/:id/assinatura/status`, ({ params }) => {
    if (String(params['id']) !== CONTRATO_FORMALIZACAO_ID) {
      return contratoNaoEncontrado('/api/v1/contratos/assinatura/status');
    }
    const atual = lerFormalizacao().status;
    // Avanca o ciclo a cada consulta: ACEITO -> EM_ASSINATURA -> ASSINADO (e permanece).
    const proximo =
      atual === 'ACEITO' ? 'EM_ASSINATURA' : atual === 'EM_ASSINATURA' ? 'ASSINADO' : atual;
    salvarEstado(FORMALIZACAO_KEY, { status: proximo });
    const statusEnvelope =
      proximo === 'EM_ASSINATURA' ? 'ENVIADO' : proximo === 'ASSINADO' ? 'ASSINADO' : null;
    return HttpResponse.json(
      {
        statusContrato: proximo,
        statusEnvelope,
        idEnvelopeExterno: statusEnvelope ? 'env-ext-mock' : null,
        dataAtualizacaoProvider: statusEnvelope ? '2026-06-21T09:00:00-03:00' : null,
      },
      { status: 200 },
    );
  }),

  http.get(`${baseUrl}/contratos/:id/documento-assinado`, ({ params }) => {
    const path = '/api/v1/contratos/documento-assinado';
    if (String(params['id']) !== CONTRATO_FORMALIZACAO_ID) {
      return contratoNaoEncontrado(path);
    }
    if (lerFormalizacao().status !== 'ASSINADO') {
      return HttpResponse.json(
        errorResponse(409, 'Conflict', 'Documento ainda nao assinado', path),
        { status: 409 },
      );
    }
    return new HttpResponse('%PDF-1.4 documento ficticio assinado', {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contrato-${CONTRATO_FORMALIZACAO_ID}-assinado.pdf"`,
        'X-Document-Hash-Sha256': 'mockdochash0000000000000000000000000000000000000000000000000001',
      },
    });
  }),

  http.get(`${baseUrl}/contratos/:id`, ({ params }) => {
    if (String(params['id']) !== CONTRATO_FORMALIZACAO_ID) {
      return contratoNaoEncontrado('/api/v1/contratos');
    }
    return HttpResponse.json(contratoMock(lerFormalizacao().status), { status: 200 });
  }),
];

export const handlers = [
  ...baseHandlers,
  ...onboardingHandlers,
  ...creditoHandlers,
  ...stepUpHandlers,
  ...formalizacaoHandlers,
];
