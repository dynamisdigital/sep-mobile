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

// DTOs de borda espelhando os contratos reais de `sep-api` (onboarding Sprints 6-7).
// Status e decisoes KYC/KYB/PLD pertencem ao backend: o mobile nao interpreta esses
// valores como regra de negocio, apenas os apresenta.

export type StatusOnboarding =
  | 'INICIADO'
  | 'DOCUMENTOS_RECEBIDOS'
  | 'EM_VERIFICACAO'
  | 'APROVADO'
  | 'REPROVADO'
  | 'PENDENCIA'
  | 'APROVADO_FINAL'
  | 'REPROVADO_PLD';

export type TipoDocumento =
  | 'RG'
  | 'CNH'
  | 'PASSAPORTE'
  | 'SELFIE'
  | 'CONTRATO_SOCIAL'
  | 'CCMEI'
  | 'COMPROVANTE_ENDERECO';

export type TipoSocietario = 'LTDA' | 'SA' | 'EIRELI' | 'MEI' | 'OUTROS';

export type PorteEmpresa = 'MEI' | 'ME' | 'EPP' | 'MEDIO' | 'GRANDE';

export type StatusPldRepresentante = 'PENDENTE' | 'LIMPO' | 'HIT';

export interface IniciarOnboardingPessoaRequest {
  cpf: string;
  nomeCompleto: string;
  dataNascimento: string; // yyyy-MM-dd
}

export interface IniciarOnboardingEmpresaRequest {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  tipoSocietario?: TipoSocietario;
  porte?: PorteEmpresa;
}

export interface OnboardingResponse {
  id: string;
  status: StatusOnboarding;
  dataCriacao: string;
  dataModificacao: string;
}

export interface EmpresaResponse {
  id: string;
  status: StatusOnboarding;
  cnpj: string;
  razaoSocial: string;
  dataCriacao: string;
  dataModificacao: string;
}

export interface DocumentoEnviadoResponse {
  id: string;
  tipo: TipoDocumento;
  dataEnvio: string;
  sha256: string;
}

export interface ResultadoOnboardingResponse {
  statusFinal: StatusOnboarding;
  motivo: string | null;
  dataResultado: string;
}

export interface StatusOnboardingResponse {
  id: string;
  status: StatusOnboarding;
  dataCriacao: string;
  dataModificacao: string;
  documentosEnviados: DocumentoEnviadoResponse[];
  resultado: ResultadoOnboardingResponse | null;
}

// Resumo publico do PLD: apenas status consolidado + data. Backend nunca expoe
// motivo/base/severidade nesta camada (LGPD Art. 16).
export interface ConsultaPldResumoResponse {
  statusPld: StatusPldRepresentante;
  dataConsulta: string | null;
}

// CPF do representante chega sempre mascarado pelo backend; o mobile nunca recebe CPF completo.
export interface RepresentanteLegalResponse {
  id: string;
  nome: string;
  cpfMascarado: string;
  cargo: string;
  pld: ConsultaPldResumoResponse | null;
}

export interface DadosEmpresaResponse {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipoSocietario: TipoSocietario | null;
  porte: PorteEmpresa | null;
}

export interface StatusOnboardingEmpresaResponse {
  id: string;
  status: StatusOnboarding;
  dataCriacao: string;
  dataModificacao: string;
  dadosEmpresa: DadosEmpresaResponse;
  documentosEnviados: DocumentoEnviadoResponse[];
  representantes: RepresentanteLegalResponse[];
  resultado: ResultadoOnboardingResponse | null;
}

// DTOs de borda espelhando os contratos reais de `sep-api` (credito Sprints 8-9).
// Score, parecer, elegibilidade e decisoes de credito pertencem ao backend: o mobile
// apenas apresenta esses valores; nunca calcula score, juros, CET, IOF ou transicao.

export type StatusProposta = 'EM_ANALISE' | 'PRE_APROVADA' | 'APROVADA' | 'REJEITADA' | 'PENDENCIA';

export type TipoOperacao = 'CAPITAL_GIRO' | 'OUTROS';

export type StatusConsentimento = 'PENDENTE' | 'AUTORIZADO' | 'NEGADO' | 'EXPIRADO';

export type DecisaoParecer = 'APROVAR' | 'REJEITAR' | 'PENDENCIA';

export interface CriarPropostaRequest {
  solicitacaoOnboardingId: string;
  tipoOperacao: TipoOperacao;
  valorSolicitado: number;
  prazoMeses: number;
}

// Score do motor interno: apenas espelha a resposta. O mobile nao recalcula nem explica a formula.
export interface ScoreInternoResponse {
  statusSugerido: StatusProposta;
  falhas: number;
  pendencias: number;
  dataCalculo: string;
}

// Parecer manual da mesa de credito: apenas espelha a resposta. `pareceristaId` chega no DTO
// mas nao deve ser exibido ao tomador (Task M-7.4).
export interface ParecerCreditoResponse {
  id: string;
  propostaId: string;
  pareceristaId: string;
  decisao: DecisaoParecer;
  justificativa: string;
  scoreMotorSnapshot: number | null;
  versao: number;
  dataParecer: string;
}

export interface PropostaResponse {
  id: string;
  tomadorId: string;
  solicitacaoOnboardingId: string;
  tipoOperacao: TipoOperacao;
  valorSolicitado: number;
  moeda: string;
  prazoMeses: number;
  status: StatusProposta;
  dataCriacao: string;
  dataModificacao: string;
  score: ScoreInternoResponse | null;
  parecer: ParecerCreditoResponse | null;
}

// Espelha Spring Page; o mobile usa apenas o subconjunto necessario para paginar a lista.
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
}

export interface IniciarConsentimentoOpenFinanceRequest {
  cpfCnpjTomador: string;
  redirectUri: string;
}

export interface IniciarConsentimentoOpenFinanceResponse {
  consentimentoId: string;
  status: StatusConsentimento;
  urlAutorizacao: string;
  dataExpiracao: string;
}

// Agregados sanitizados do snapshot Open Finance. Backend nunca expoe transacoes, conta,
// agencia, titular ou CPF/CNPJ nesta camada (LGPD).
export interface MovimentacaoConsolidadaResponse {
  mediaEntradasMensal: number;
  mediaSaidasMensal: number;
  saldoMedio: number;
  numeroMesesAvaliados: number | null;
  dataRecebimento: string | null;
}

export interface OpenFinanceStatusResponse {
  statusConsentimento: StatusConsentimento;
  dataInicio: string;
  dataAutorizacao: string | null;
  dataExpiracao: string | null;
  ultimaMovimentacao: MovimentacaoConsolidadaResponse | null;
}
