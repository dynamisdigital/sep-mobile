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

// --- Account lockout no login (M-Sprint 17 / backend Sprints 5 e 33) -----------------
// Espelha LockoutService + LockoutProperties do sep-api: `app.security.lockout.max-attempts`
// falhas trancam a conta por `lockout-minutes`.
//
// NAO e simulado: a janela de 15 min (`window-minutes`) e a duracao de 30 min do bloqueio. O mock
// nao tem relogio e nenhum smoke vive tanto. Consequencia pratica: o bloqueio dura ate o reload da
// pagina, que reavalia o modulo — nao expira sozinho. O que precisa ser fiel e a ordem de avaliacao
// e o limiar, que e o que torna /account-locked alcancavel offline.
const LOCKOUT_MAX_TENTATIVAS = 5;
const LOCKOUT_MINUTOS = 30;

// DIVERGENCIA DELIBERADA do backend, herdada da F-Sprint 21 no sep-app: aqui QUALQUER credencial
// recusada incrementa, inclusive username desconhecido, vazio ou fora do formato e-mail. No sep-api
// o AutenticarUsuarioUseCase chega a chamar `avaliarPosFalha` para usuario inexistente, mas
// LockoutService.STATUSES_FALHA so admite SENHA_INVALIDA e TOTP_INVALIDO — entao USUARIO_INEXISTENTE
// nao entra na contagem e um username desconhecido responde 401 para sempre; um username
// vazio/malformado nem chega ao use case, porque cai em 400 por bean validation (@NotBlank @Email em
// LoginRequestDto).
//
// DIRECAO DO RISCO — vale para esta divergencia E para a ausencia de relogio acima. O mock e mais
// ESTRITO que a producao: tranca onde o backend nao trancaria (username inexistente, 5 falhas
// espalhadas por mais de 15 min, tentativa apos os 30 min ja vencidos). Para um teste que afirma
// sucesso ou 401 isso e seguro — falha offline, passa em producao. Mas para um teste que afirma o
// BLOQUEIO, que e justamente o que este mock existe para viabilizar, a direcao se inverte: ele passa
// offline e a jornada pode nao existir em producao. Portanto todo teste de /account-locked deve usar
// um usuario que o backend tambem contaria — usuario EXISTENTE com senha errada, em tentativas
// consecutivas.
//
// TOTP_INVALIDO nao se aplica aqui: o mock nao expoe `/auth/totp/verify` (o handler de login devolve
// `mfaRequired: false`), entao a unica origem de falha e a senha. No sep-api os dois status somam no
// MESMO contador, chaveado por username.
const falhasDeLoginPorUsuario = new Map<string, number>();

// Restaura o contador de falhas para o estado de seed. Hoje nenhum chamador: o MSW nao esta plugado
// no Vitest (ver test-setup.ts) e cada teste Playwright carrega a pagina do zero, o que ja reavalia
// o modulo. Existe para que plugar o MSW no Vitest — follow-up registrado — nao exija tambem
// descobrir como isolar o estado entre specs.
export function resetLoginMockState(): void {
  falhasDeLoginPorUsuario.clear();
}

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
    const path = '/api/v1/auth/login';
    // O cast acima nao valida nada: em runtime o corpo e JSON arbitrario. Normalizar aqui evita que
    // `undefined` vire chave do Map e faca o tipo `Map<string, number>` mentir.
    const username = body.username ?? '';

    // Mesma posicao que o lockout ocupa em AutenticarUsuarioUseCase#executar: verificado ANTES de
    // resolver o usuario e de avaliar a credencial. Duas consequencias preservadas de proposito:
    // a 5a senha errada ainda responde 401 (o 423 so aparece na 6a requisicao) e a senha CORRETA
    // depois do bloqueio tambem responde 423, porque a credencial nem chega a ser avaliada.
    const falhas = falhasDeLoginPorUsuario.get(username) ?? 0;
    if (falhas >= LOCKOUT_MAX_TENTATIVAS) {
      return HttpResponse.json(
        errorResponse(
          423,
          'Locked',
          `Conta bloqueada temporariamente. Tente novamente em ${LOCKOUT_MINUTOS} minutos.`,
          path,
        ),
        { status: 423 },
      );
    }

    if (username === 'cliente@empresa.com' && body.password === 'senha-passphrase-segura') {
      // Sucesso NAO zera o contador: LockoutService le apenas instantes de falha na janela e nao ha
      // caminho de reset no sep-api.
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

    falhasDeLoginPorUsuario.set(username, falhas + 1);
    return HttpResponse.json(errorResponse(401, 'Unauthorized', 'Credenciais invalidas', path), {
      status: 401,
    });
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

// --- Cobranca / parcelas do tomador (Sprints 12-13 + 23/24; M-Sprint 9) --------------
// Estado minimo em localStorage (`mock.cobranca`) para sobreviver ao reload do step-up no
// e2e; reseedavel por teste (chave ausente = renegociacao PROPOSTA). Responde apenas para o
// contrato da formalizacao (`contrato-mock-1`, semeado ASSINADO pelo smoke de cobranca);
// demais ids -> 404/403 coerentes. A agenda original traz os 7 status de parcela; o aceite
// da renegociacao (exige X-Step-Up-Token, como no backend) substitui a agenda ativa de forma
// observavel e a recusa devolve a parcela ao status anterior. Valores sao fixos e ficticios
// (nenhum recalculo local); sem dados bancarios, operador, escrow ou justificativa.

const COBRANCA_KEY = 'mock.cobranca';
const AGENDA_ORIGINAL_ID = 'agenda-cobranca-1';
const AGENDA_SUBSTITUTA_ID = 'agenda-cobranca-2';
const RENEGOCIACAO_MOCK_ID = 'reneg-mock-1';
const PARCELA_EM_NEGOCIACAO_ID = 'parcela-cobranca-5';

type RenegociacaoEstado = 'PROPOSTA' | 'ACEITA' | 'RECUSADA';

interface CobrancaState {
  renegociacao: RenegociacaoEstado;
}

function lerCobranca(): CobrancaState {
  return lerEstado<CobrancaState>(COBRANCA_KEY, { renegociacao: 'PROPOSTA' });
}

function parcelaAgendaMock(numero: number, status: string, total: number) {
  return {
    id: `parcela-cobranca-${numero}`,
    numero,
    principal: total,
    juros: 0,
    multa: 0,
    encargos: 0,
    total,
    dataVencimento: `2026-0${Math.min(numero, 9)}-15`,
    status,
  };
}

// Agenda original: cobre os 7 status de parcela exigidos pelo smoke. A parcela 5 e a unica
// EM_NEGOCIACAO (renegociacao ativa); recusa devolve ATRASADA (statusParcelaAnterior).
function agendaOriginalMock(estado: CobrancaState) {
  const statusParcela5 =
    estado.renegociacao === 'PROPOSTA'
      ? 'EM_NEGOCIACAO'
      : estado.renegociacao === 'ACEITA'
        ? 'RENEGOCIADA'
        : 'ATRASADA';
  return {
    id: AGENDA_ORIGINAL_ID,
    contratoId: CONTRATO_FORMALIZACAO_ID,
    numeroParcelas: 7,
    valorTotal: 7000,
    dataGeracao: '2026-06-22T10:00:00-03:00',
    parcelas: [
      parcelaAgendaMock(1, 'PAGA', 1000),
      parcelaAgendaMock(2, 'PARCIALMENTE_PAGA', 1000),
      parcelaAgendaMock(3, 'PENDENTE', 1000),
      parcelaAgendaMock(4, 'ATRASADA', 1000),
      parcelaAgendaMock(5, statusParcela5, 1000),
      parcelaAgendaMock(6, 'INADIMPLENTE', 1000),
      parcelaAgendaMock(7, 'RENEGOCIADA', 1000),
    ],
  };
}

// Agenda substituta pos-aceite: 3 novas parcelas PENDENTE de 110 (termos da renegociacao).
function agendaSubstitutaMock() {
  return {
    id: AGENDA_SUBSTITUTA_ID,
    contratoId: CONTRATO_FORMALIZACAO_ID,
    numeroParcelas: 3,
    valorTotal: 330,
    dataGeracao: '2026-07-02T10:00:00-03:00',
    parcelas: [
      {
        id: 'parcela-substituta-1',
        numero: 1,
        principal: 110,
        juros: 0,
        multa: 0,
        encargos: 0,
        total: 110,
        dataVencimento: '2026-08-01',
        status: 'PENDENTE',
      },
      {
        id: 'parcela-substituta-2',
        numero: 2,
        principal: 110,
        juros: 0,
        multa: 0,
        encargos: 0,
        total: 110,
        dataVencimento: '2026-09-01',
        status: 'PENDENTE',
      },
      {
        id: 'parcela-substituta-3',
        numero: 3,
        principal: 110,
        juros: 0,
        multa: 0,
        encargos: 0,
        total: 110,
        dataVencimento: '2026-10-01',
        status: 'PENDENTE',
      },
    ],
  };
}

// Valor atualizado ficticio por parcela: mora/multa apenas nas vencidas; totalRecebido coerente
// com o historico (parcela 5 tem 1 recebimento parcial de 300 antes da negociacao).
function valorAtualizadoMock(parcelaId: string, estado: CobrancaState) {
  const base = {
    parcelaId,
    dataVencimento: '2026-05-15',
    principalOriginal: 1000,
    jurosOriginal: 0,
    jurosMora: 25,
    multa: 20,
    valorDevidoAtualizado: 1045,
    totalRecebido: 0,
    valorEmAberto: 1045,
  };
  switch (parcelaId) {
    case 'parcela-cobranca-4':
      return { ...base, numero: 4, status: 'ATRASADA' };
    case PARCELA_EM_NEGOCIACAO_ID: {
      const status =
        estado.renegociacao === 'PROPOSTA'
          ? 'EM_NEGOCIACAO'
          : estado.renegociacao === 'ACEITA'
            ? 'RENEGOCIADA'
            : 'ATRASADA';
      return {
        ...base,
        numero: 5,
        status,
        totalRecebido: 300,
        valorEmAberto: 745,
      };
    }
    case 'parcela-cobranca-6':
      return { ...base, numero: 6, status: 'INADIMPLENTE', jurosMora: 80, multa: 20 };
    default:
      return null;
  }
}

const cobrancaHandlers = [
  http.get(`${baseUrl}/cobranca/contratos/:contratoId/agenda`, ({ params }) => {
    const path = '/api/v1/cobranca/contratos/agenda';
    if (String(params['contratoId']) !== CONTRATO_FORMALIZACAO_ID) {
      return HttpResponse.json(errorResponse(404, 'Not Found', 'Agenda nao encontrada', path), {
        status: 404,
      });
    }
    const estado = lerCobranca();
    return HttpResponse.json(
      estado.renegociacao === 'ACEITA' ? agendaSubstitutaMock() : agendaOriginalMock(estado),
      { status: 200 },
    );
  }),

  http.get(`${baseUrl}/cobranca/parcelas/:id/recebimentos`, ({ params }) => {
    const parcelaId = String(params['id']);
    // Ownership 403 uniforme (sem UUID) para parcela desconhecida, como no backend B1.
    if (!valorAtualizadoMock(parcelaId, lerCobranca())) {
      return HttpResponse.json(
        errorResponse(
          403,
          'Forbidden',
          'Recurso de cobranca indisponivel',
          '/api/v1/cobranca/parcelas/recebimentos',
        ),
        { status: 403 },
      );
    }
    if (parcelaId !== PARCELA_EM_NEGOCIACAO_ID) {
      return HttpResponse.json([], { status: 200 });
    }
    return HttpResponse.json(
      [
        {
          recebimentoId: 'receb-mock-1',
          valorRecebido: 300,
          dataRecebimento: '2026-06-10T14:30:00-03:00',
          meioPagamento: 'PIX',
        },
      ],
      { status: 200 },
    );
  }),

  http.get(`${baseUrl}/cobranca/parcelas/:id/renegociacao-ativa`, ({ params }) => {
    const parcelaId = String(params['id']);
    const path = '/api/v1/cobranca/parcelas/renegociacao-ativa';
    if (!valorAtualizadoMock(parcelaId, lerCobranca())) {
      return HttpResponse.json(
        errorResponse(403, 'Forbidden', 'Recurso de cobranca indisponivel', path),
        { status: 403 },
      );
    }
    const estado = lerCobranca();
    if (parcelaId !== PARCELA_EM_NEGOCIACAO_ID || estado.renegociacao !== 'PROPOSTA') {
      return HttpResponse.json(
        errorResponse(
          404,
          'Not Found',
          'Nenhuma renegociacao ativa para a parcela informada',
          path,
        ),
        { status: 404 },
      );
    }
    return HttpResponse.json(
      {
        renegociacaoId: RENEGOCIACAO_MOCK_ID,
        parcelaId,
        status: 'PROPOSTA',
        novoValorParcela: 110,
        numeroParcelas: 3,
        valorTotalRenegociado: 330,
        novoVencimento: '2026-08-01',
        desconto: 50,
        dataProposta: '2026-07-01T10:00:00-03:00',
        dataExpiracao: '2026-07-08T10:00:00-03:00',
      },
      { status: 200 },
    );
  }),

  http.patch(`${baseUrl}/cobranca/renegociacoes/:id/aceite`, ({ params, request }) => {
    const path = '/api/v1/cobranca/renegociacoes/aceite';
    if (
      String(params['id']) !== RENEGOCIACAO_MOCK_ID ||
      lerCobranca().renegociacao !== 'PROPOSTA'
    ) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Renegociacao nao encontrada', path),
        { status: 404 },
      );
    }
    if (!request.headers.get('X-Step-Up-Token')) {
      return HttpResponse.json(errorResponse(403, 'Forbidden', 'step-up obrigatorio', path), {
        status: 403,
      });
    }
    salvarEstado(COBRANCA_KEY, { renegociacao: 'ACEITA' } satisfies CobrancaState);
    return HttpResponse.json({ id: RENEGOCIACAO_MOCK_ID, status: 'ACEITA' }, { status: 200 });
  }),

  http.patch(`${baseUrl}/cobranca/renegociacoes/:id/recusa`, ({ params }) => {
    const path = '/api/v1/cobranca/renegociacoes/recusa';
    if (
      String(params['id']) !== RENEGOCIACAO_MOCK_ID ||
      lerCobranca().renegociacao !== 'PROPOSTA'
    ) {
      return HttpResponse.json(
        errorResponse(404, 'Not Found', 'Renegociacao nao encontrada', path),
        { status: 404 },
      );
    }
    salvarEstado(COBRANCA_KEY, { renegociacao: 'RECUSADA' } satisfies CobrancaState);
    return HttpResponse.json({ id: RENEGOCIACAO_MOCK_ID, status: 'RECUSADA' }, { status: 200 });
  }),

  // Registrado por ultimo no grupo: o path com sufixo (recebimentos/renegociacao-ativa) casa
  // primeiro nos handlers acima; este cobre apenas o detalhe da parcela.
  http.get(`${baseUrl}/cobranca/parcelas/:id`, ({ params }) => {
    const detalhe = valorAtualizadoMock(String(params['id']), lerCobranca());
    if (!detalhe) {
      return HttpResponse.json(
        errorResponse(
          403,
          'Forbidden',
          'Recurso de cobranca indisponivel',
          '/api/v1/cobranca/parcelas',
        ),
        { status: 403 },
      );
    }
    return HttpResponse.json(detalhe, { status: 200 });
  }),
];

// ===================== Credora (Epic 10 - M-Sprint 10) =====================
// Estado semeavel por teste em `mock.credora` (localStorage). Default: usuario SEM credora
// (`presente: false`) para nao afetar os outros smokes — o smoke credora semeia `presente: true`.
// Sem CPF/dado bancario/Pix/payload de provider/tomador. Ids fixos e ficticios.

const CREDORA_KEY = 'mock.credora';
const OPORTUNIDADE_DISPONIVEL_ID = 'op-disponivel-1';
const OPORTUNIDADE_ENCERRADA_ID = 'op-encerrada-1';
const OPERACAO_CARTEIRA_ID = 'oper-carteira-1';

interface CredoraMockState {
  presente: boolean;
  elegibilidade: 'ELEGIVEL' | 'PENDENTE' | 'INELEGIVEL';
  interesse: 'ATIVO' | 'AUSENTE';
  carteiraVazia: boolean;
  // M-16.4: `LISTA` devolve os quatro estados de aporte; `VAZIA` prova o estado vazio (200 []).
  // Operacao alheia/inexistente continua caindo no 404 neutro do proprio handler.
  aportes: 'LISTA' | 'VAZIA';
}

function lerCredora(): CredoraMockState {
  return lerEstado<CredoraMockState>(CREDORA_KEY, {
    presente: false,
    elegibilidade: 'ELEGIVEL',
    interesse: 'AUSENTE',
    carteiraVazia: false,
    aportes: 'LISTA',
  });
}

function credoraErro(status: number, error: string, mensagem: string) {
  return HttpResponse.json(errorResponse(status, error, mensagem, '/api/v1/credores'), { status });
}

function credoraResponseMock(estado: CredoraMockState) {
  return {
    id: 'cred-mock-1',
    usuarioId: TOMADOR_ID,
    onboardingId: 'onb-credora-1',
    cnpj: '11.222.333/0001-81',
    razaoSocial: 'Credora Mock LTDA',
    status: estado.elegibilidade === 'ELEGIVEL' ? 'ATIVA' : 'CADASTRADA',
    elegibilidade: estado.elegibilidade,
    motivoInelegibilidade:
      estado.elegibilidade === 'INELEGIVEL' ? 'Pendencia documental do cadastro' : null,
    tipoCredora: 'EMPRESA',
    capacidadeAporte: 100000,
    dataCriacao: '2026-06-30T09:00:00-03:00',
    dataModificacao: '2026-06-30T09:00:00-03:00',
  };
}

function oportunidadesMock() {
  return [
    {
      id: OPORTUNIDADE_DISPONIVEL_ID,
      propostaId: 'prop-cred-1',
      contratoId: null,
      valor: 15000,
      prazoMeses: 12,
      taxaJurosMensal: 0.0199,
      status: 'DISPONIVEL',
      dataCriacao: '2026-06-25T09:00:00-03:00',
    },
    {
      id: OPORTUNIDADE_ENCERRADA_ID,
      propostaId: 'prop-cred-2',
      contratoId: 'contr-cred-2',
      valor: 8000,
      prazoMeses: 6,
      taxaJurosMensal: 0.0175,
      status: 'ENCERRADA',
      dataCriacao: '2026-05-10T09:00:00-03:00',
    },
  ];
}

function interesseMock() {
  return {
    id: 'int-mock-1',
    oportunidadeId: OPORTUNIDADE_DISPONIVEL_ID,
    status: 'ATIVO',
    dataCriacao: '2026-07-02T09:00:00-03:00',
  };
}

function operacoesMock() {
  return [
    {
      id: OPERACAO_CARTEIRA_ID,
      contratoId: 'contr-cred-9',
      oportunidadeId: OPORTUNIDADE_DISPONIVEL_ID,
      status: 'ASSOCIADA',
      justificativa: 'Associacao assistida operacional interna',
      valor: 15000,
      prazoMeses: 12,
      taxaJurosMensal: 0.0199,
      contratoStatus: 'ASSINADO',
      cobranca: {
        numeroParcelas: 12,
        valorTotal: 16000,
        parcelasPagas: 2,
        parcelasAtrasadas: 0,
        totalRecebido: 2600,
        proximoVencimento: '2026-08-15',
      },
      dataCriacao: '2026-07-01T09:00:00-03:00',
    },
  ];
}

// Aportes owner-scoped de uma operacao da propria credora (M-Sprint 16 / backend Sprint 29).
// Somente leitura: o mock nao expoe POST — registrar aporte exige FINANCEIRO/ADMIN, persona fora
// do mobile (Gate M-16.0). Ordem desc por dataCriacao, como o backend entrega; sem escrow,
// provider, idempotency key ou dado do tomador.
function aportesMock() {
  return [
    {
      id: 'aporte-cred-4',
      operacaoId: OPERACAO_CARTEIRA_ID,
      status: 'FALHOU',
      valor: 1500,
      dataCriacao: '2026-07-05T09:00:00-03:00',
      dataAtualizacao: '2026-07-05T10:30:00-03:00',
    },
    {
      id: 'aporte-cred-3',
      operacaoId: OPERACAO_CARTEIRA_ID,
      status: 'PENDENTE',
      valor: 2000,
      dataCriacao: '2026-07-04T09:00:00-03:00',
      dataAtualizacao: '2026-07-04T09:00:00-03:00',
    },
    {
      id: 'aporte-cred-2',
      operacaoId: OPERACAO_CARTEIRA_ID,
      status: 'EM_PROCESSAMENTO',
      valor: 3500,
      dataCriacao: '2026-07-03T09:00:00-03:00',
      dataAtualizacao: '2026-07-03T11:00:00-03:00',
    },
    {
      id: 'aporte-cred-1',
      operacaoId: OPERACAO_CARTEIRA_ID,
      status: 'LIQUIDADO',
      valor: 8000,
      dataCriacao: '2026-07-02T09:00:00-03:00',
      dataAtualizacao: '2026-07-02T14:00:00-03:00',
    },
  ];
}

const credoresHandlers = [
  http.get(`${baseUrl}/credores/me/elegibilidade`, () => {
    const estado = lerCredora();
    if (!estado.presente) {
      return credoraErro(404, 'Not Found', 'Usuario nao possui credora');
    }
    const credora = credoraResponseMock(estado);
    return HttpResponse.json(
      {
        status: credora.status,
        elegibilidade: credora.elegibilidade,
        motivoInelegibilidade: credora.motivoInelegibilidade,
      },
      { status: 200 },
    );
  }),

  http.get(`${baseUrl}/credores/me`, () => {
    const estado = lerCredora();
    if (!estado.presente) {
      return credoraErro(404, 'Not Found', 'Usuario nao possui credora');
    }
    return HttpResponse.json(credoraResponseMock(estado), { status: 200 });
  }),

  http.get(`${baseUrl}/credores/oportunidades`, () => {
    if (!lerCredora().presente) {
      return credoraErro(404, 'Not Found', 'Usuario nao possui credora');
    }
    return HttpResponse.json(oportunidadesMock(), { status: 200 });
  }),

  http.post(`${baseUrl}/credores/oportunidades/:id/interesses`, ({ params }) => {
    const estado = lerCredora();
    const id = String(params['id']);
    if (!estado.presente || id !== OPORTUNIDADE_DISPONIVEL_ID) {
      return credoraErro(404, 'Not Found', 'Credora ou oportunidade nao encontrada');
    }
    if (estado.elegibilidade !== 'ELEGIVEL') {
      return credoraErro(422, 'Unprocessable Entity', 'Credora nao elegivel');
    }
    if (estado.interesse === 'ATIVO') {
      return credoraErro(409, 'Conflict', 'Interesse ativo ja existe');
    }
    salvarEstado(CREDORA_KEY, { ...estado, interesse: 'ATIVO' } satisfies CredoraMockState);
    return HttpResponse.json(interesseMock(), { status: 201 });
  }),

  http.get(`${baseUrl}/credores/oportunidades/:id/interesses/me`, ({ params }) => {
    const estado = lerCredora();
    const id = String(params['id']);
    if (!estado.presente || id !== OPORTUNIDADE_DISPONIVEL_ID || estado.interesse !== 'ATIVO') {
      return credoraErro(404, 'Not Found', 'Nenhum interesse ativo encontrado');
    }
    return HttpResponse.json(interesseMock(), { status: 200 });
  }),

  http.delete(`${baseUrl}/credores/oportunidades/:id/interesses/me`, ({ params }) => {
    const estado = lerCredora();
    const id = String(params['id']);
    if (!estado.presente || id !== OPORTUNIDADE_DISPONIVEL_ID || estado.interesse !== 'ATIVO') {
      return credoraErro(404, 'Not Found', 'Nenhum interesse ativo encontrado');
    }
    salvarEstado(CREDORA_KEY, { ...estado, interesse: 'AUSENTE' } satisfies CredoraMockState);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${baseUrl}/credores/oportunidades/:id`, ({ params }) => {
    if (!lerCredora().presente) {
      return credoraErro(404, 'Not Found', 'Credora ou oportunidade nao encontrada');
    }
    const oportunidade = oportunidadesMock().find((o) => o.id === String(params['id']));
    return oportunidade
      ? HttpResponse.json(oportunidade, { status: 200 })
      : credoraErro(404, 'Not Found', 'Credora ou oportunidade nao encontrada');
  }),

  http.get(`${baseUrl}/credores/carteira`, () => {
    const estado = lerCredora();
    if (!estado.presente) {
      return credoraErro(404, 'Not Found', 'Usuario nao possui credora');
    }
    return HttpResponse.json(estado.carteiraVazia ? [] : operacoesMock(), { status: 200 });
  }),

  http.get(`${baseUrl}/credores/carteira/:id`, ({ params }) => {
    if (!lerCredora().presente) {
      return credoraErro(404, 'Not Found', 'Credora ou operacao nao encontrada');
    }
    const operacao = operacoesMock().find((o) => o.id === String(params['id']));
    return operacao
      ? HttpResponse.json(operacao, { status: 200 })
      : credoraErro(404, 'Not Found', 'Credora ou operacao nao encontrada');
  }),

  // Mesma ownership do detalhe da carteira: sem credora / operacao alheia / inexistente -> 404
  // neutro, sem enumerar. Lista vazia e 200 [], estado valido e distinto do 404.
  http.get(`${baseUrl}/credores/operacoes/:operacaoId/aportes`, ({ params }) => {
    const estado = lerCredora();
    if (!estado.presente) {
      return credoraErro(404, 'Not Found', 'Operacao nao encontrada');
    }
    const operacao = operacoesMock().find((o) => o.id === String(params['operacaoId']));
    if (!operacao) {
      return credoraErro(404, 'Not Found', 'Operacao nao encontrada');
    }
    return HttpResponse.json(estado.aportes === 'VAZIA' ? [] : aportesMock(), { status: 200 });
  }),
];

// Leituras Pix owner-scoped (M-Sprint 11 / backend Sprint 26 Gates P1-P3). Somente GET read-only;
// 404 neutro para recurso alheio/inexistente/sem Pix. Nenhuma rota operacional (desembolsos,
// referencias, recebimentos internos) e mockada aqui — o app nunca as consome.
const PIX_ATUALIZADO_EM = '2026-07-06T10:00:00-03:00';

// Estado Pix reseedavel por teste (`mock.pix`). `desembolso` controla o Gate P1 (um dos quatro
// status publicos ou `AUSENTE` para 404); `falhar` faz a proxima leitura Pix retornar 5xx uma unica
// vez (prova o caminho de retry). Default = happy path.
const PIX_KEY = 'mock.pix';

interface PixMockState {
  desembolso: string;
  falhar: boolean;
}

function lerPix(): PixMockState {
  return lerEstado<PixMockState>(PIX_KEY, { desembolso: 'EM_PROCESSAMENTO', falhar: false });
}

// Efeito de teste: se `falhar`, consome a flag (o retry seguinte sucede) e sinaliza 5xx.
function pixDeveFalhar(): boolean {
  const estado = lerPix();
  if (!estado.falhar) {
    return false;
  }
  salvarEstado(PIX_KEY, { ...estado, falhar: false });
  return true;
}

function erroPix(status: number, error: string, path: string) {
  return HttpResponse.json(errorResponse(status, error, 'Leitura Pix indisponivel', path), {
    status,
  });
}

const pixHandlers = [
  // P1 — status do desembolso Pix de um contrato proprio (reseedavel: status, `AUSENTE` e falha).
  http.get(`${baseUrl}/pix/contratos/:contratoId/desembolso`, ({ params }) => {
    const path = '/api/v1/pix/contratos/desembolso';
    if (pixDeveFalhar()) {
      return erroPix(500, 'Internal Server Error', path);
    }
    if (String(params['contratoId']) !== CONTRATO_FORMALIZACAO_ID) {
      return erroPix(404, 'Not Found', path);
    }
    const desembolso = lerPix().desembolso;
    if (desembolso === 'AUSENTE') {
      return erroPix(404, 'Not Found', path);
    }
    return HttpResponse.json(
      { status: desembolso, valor: 7000, atualizadoEm: PIX_ATUALIZADO_EM },
      { status: 200 },
    );
  }),

  // P2 — status Pix de uma parcela propria. Parcela 4 = AGUARDANDO; parcela 6 = DIVERGENTE (com
  // mensagem publica sanitizada); demais = 404 neutro (sem estado Pix).
  http.get(`${baseUrl}/pix/parcelas/:parcelaId/status`, ({ params }) => {
    const path = '/api/v1/pix/parcelas/status';
    if (pixDeveFalhar()) {
      return erroPix(500, 'Internal Server Error', path);
    }
    const parcelaId = String(params['parcelaId']);
    if (parcelaId === 'parcela-cobranca-4') {
      return HttpResponse.json(
        {
          status: 'AGUARDANDO',
          valor: 1000,
          atualizadoEm: PIX_ATUALIZADO_EM,
          mensagemPublica: null,
        },
        { status: 200 },
      );
    }
    if (parcelaId === 'parcela-cobranca-6') {
      return HttpResponse.json(
        {
          status: 'DIVERGENTE',
          valor: 1000,
          atualizadoEm: PIX_ATUALIZADO_EM,
          mensagemPublica: 'Pagamento Pix em verificacao. Se persistir, procure o suporte.',
        },
        { status: 200 },
      );
    }
    return erroPix(404, 'Not Found', path);
  }),

  // P3 — status Pix de uma operacao da propria carteira da credora. Mesma ownership do detalhe da
  // carteira: sem credora / operacao alheia / inexistente -> 404 neutro.
  http.get(`${baseUrl}/credores/carteira/:id/pix`, ({ params }) => {
    const path = '/api/v1/credores/carteira/pix';
    if (pixDeveFalhar()) {
      return erroPix(500, 'Internal Server Error', path);
    }
    if (!lerCredora().presente) {
      return erroPix(404, 'Not Found', path);
    }
    const operacao = operacoesMock().find((o) => o.id === String(params['id']));
    if (!operacao) {
      return erroPix(404, 'Not Found', path);
    }
    return HttpResponse.json(
      { status: 'LIQUIDADO', valor: 10000, atualizadoEm: PIX_ATUALIZADO_EM },
      { status: 200 },
    );
  }),
];

export const handlers = [
  ...baseHandlers,
  ...onboardingHandlers,
  ...creditoHandlers,
  ...stepUpHandlers,
  ...formalizacaoHandlers,
  ...cobrancaHandlers,
  ...pixHandlers,
  ...credoresHandlers,
];
