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

// Score do motor interno: apenas espelha a resposta. O mobile nao recalcula nem explica a
// formula; `valor` chega no DTO por fidelidade, mas nao e exibido ao tomador (Task M-7.4).
export interface ScoreInternoResponse {
  valor: number;
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

// DTOs de borda espelhando os contratos reais de `sep-api` (formalizacao Sprints 10-11).
// Ownership, versionamento, regra contratual, assinatura e validade juridica pertencem ao
// backend: o mobile apenas apresenta os snapshots, nunca calcula status, hash ou validade.
// Campos sensiveis (`tomadorId`, `parecerOrigemId`, `ipOrigem`, `userAgentOrigem`,
// `idEnvelopeExterno`) chegam por fidelidade ao contrato mas nunca sao exibidos ao tomador.

export type StatusFormalizacao =
  | 'GERADO'
  | 'AGUARDANDO_ACEITE'
  | 'ACEITO'
  | 'EM_ASSINATURA'
  | 'ASSINADO'
  | 'RECUSADO'
  | 'CANCELADO';

export type StatusEnvelope =
  | 'RASCUNHO'
  | 'ENVIADO'
  | 'VISUALIZADO'
  | 'ASSINADO'
  | 'RECUSADO'
  | 'EXPIRADO';

export type TipoContrato = 'MUTUO' | 'CCB' | 'OUTROS';

export interface ClausulaContratoResponse {
  id: string;
  ordem: number;
  titulo: string;
  texto: string;
}

export interface VersaoContratoResponse {
  id: string;
  numero: number;
  conteudoTexto: string;
  hashSha256: string;
  dataGeracao: string;
  parecerOrigemId: string | null;
  clausulas: ClausulaContratoResponse[];
}

// `ipOrigem` e `userAgentOrigem` chegam por fidelidade ao backend, mas nao agregam valor ao
// tomador e nao devem ser exibidos.
export interface AceiteContratoResponse {
  id: string;
  versaoId: string;
  tomadorId: string;
  dataAceite: string;
  ipOrigem: string;
  userAgentOrigem: string;
}

export interface ContratoResponse {
  id: string;
  propostaId: string;
  tomadorId: string;
  tipo: TipoContrato;
  status: StatusFormalizacao;
  versaoVigente: VersaoContratoResponse | null;
  aceite: AceiteContratoResponse | null;
  dataCriacao: string;
  dataModificacao: string;
}

// `idEnvelopeExterno` identifica o envelope no provider externo e nao deve ser exibido.
export interface StatusAssinaturaResponse {
  statusContrato: StatusFormalizacao;
  statusEnvelope: StatusEnvelope | null;
  idEnvelopeExterno: string | null;
  dataAtualizacaoProvider: string | null;
}

// DTOs de borda espelhando os contratos reais de `sep-api` (cobranca Sprints 12-13).
// Ownership, calculo de saldo/juros/mora/multa, dias de atraso, status e transicoes pertencem
// ao backend: o mobile apenas apresenta os snapshots recebidos, nunca recalcula valor monetario,
// deriva status por data/valor nem persiste a resposta. Valores monetarios chegam como `number`
// apenas como representacao de borda; nenhuma aritmetica monetaria ocorre no app.

export type StatusParcela =
  | 'PENDENTE'
  | 'PARCIALMENTE_PAGA'
  | 'PAGA'
  | 'ATRASADA'
  | 'INADIMPLENTE'
  | 'EM_NEGOCIACAO'
  | 'RENEGOCIADA';

// Parcela estatica da agenda. `total` e o valor da parcela no momento da geracao; valores
// atualizados (mora/multa/saldo) vem de ValorAtualizadoParcelaResponse no detalhe.
export interface ParcelaResponse {
  id: string;
  numero: number;
  principal: number;
  juros: number;
  multa: number;
  encargos: number;
  total: number;
  dataVencimento: string; // yyyy-MM-dd
  status: StatusParcela;
}

// Agenda gerada apos contrato assinado. Composicao e ordenacao vem prontas do backend.
export interface AgendaPagamentoResponse {
  id: string;
  contratoId: string;
  numeroParcelas: number;
  valorTotal: number;
  dataGeracao: string; // ISO-8601 com offset
  parcelas: ParcelaResponse[];
}

// Snapshot do valor atualizado de uma parcela calculado no backend contra 'agora'. O mobile
// nao soma campos para validar total nem substitui ausentes por calculo local.
export interface ValorAtualizadoParcelaResponse {
  parcelaId: string;
  numero: number;
  status: StatusParcela;
  dataVencimento: string; // yyyy-MM-dd
  principalOriginal: number;
  jurosOriginal: number;
  jurosMora: number;
  multa: number;
  valorDevidoAtualizado: number;
  totalRecebido: number;
  valorEmAberto: number;
}

// Recebimento visivel ao tomador (Sprint 23 backend — B1 da M-9). Espelha o
// RecebimentoTomadorResponse owner-scoped: apenas 4 campos publicos. Nao modela escrow,
// operador, idempotency key, identificador externo, observacao ou flag tecnica — o contrato
// B1 nao os retorna e o mobile nao os exibe. Ordenacao (dataRecebimento DESC) vem do backend.
export interface RecebimentoTomadorResponse {
  recebimentoId: string;
  valorRecebido: number;
  dataRecebimento: string; // ISO-8601 com offset
  meioPagamento: string;
}

// Somente PROPOSTA chega ao tomador pela consulta ativa; os demais estados resultam em 404.
export type StatusRenegociacao = 'PROPOSTA' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA';

// Termos da renegociacao ativa visiveis ao tomador (Sprint 24 backend — B2 da M-9). Espelha o
// RenegociacaoTomadorResponse owner-scoped: 10 campos publicos. `valorTotalRenegociado` vem
// calculado do backend — o mobile NUNCA deriva `valor x quantidade`. Nao modela tomadorId,
// propostaPor, IDs de agenda, statusParcelaAnterior ou justificativa (o contrato B2 nao os
// retorna). As respostas dos PATCHes de aceite/recusa (DTO interno) nao sao modeladas: o app
// usa apenas o status HTTP e reconsulta agenda/parcela.
export interface RenegociacaoTomadorResponse {
  renegociacaoId: string;
  parcelaId: string;
  status: StatusRenegociacao;
  novoValorParcela: number;
  numeroParcelas: number;
  valorTotalRenegociado: number;
  novoVencimento: string; // yyyy-MM-dd
  desconto: number;
  dataProposta: string; // ISO-8601 com offset
  dataExpiracao: string; // ISO-8601 com offset
}

// ===== Credora (Epic 10 — jornada da empresa credora; backend Sprints 16-17 + 25) =====
// Espelham os contratos REST reais de /api/v1/credores (perfil/elegibilidade, oportunidades,
// interesse e carteira). `number` e representacao de borda: NAO autoriza aritmetica financeira
// no app — valores/taxas/totais chegam calculados do backend. Sem requests ou DTOs dos endpoints
// ADMIN (cadastro, sync, associacao de carteira), fora do recorte mobile da M-10.

export type StatusCredora = 'CADASTRADA' | 'ATIVA' | 'SUSPENSA';
export type StatusElegibilidade = 'PENDENTE' | 'ELEGIVEL' | 'INELEGIVEL';
export type TipoCredora = 'EMPRESA' | 'INSTITUICAO_FINANCEIRA';
export type StatusOportunidade = 'DISPONIVEL' | 'ENCERRADA';
export type StatusInteresseCredora = 'ATIVO' | 'CANCELADO';
export type StatusOperacaoFinanciada = 'ASSOCIADA' | 'ENCERRADA';

export interface EmpresaCredoraResponse {
  id: string;
  usuarioId: string;
  onboardingId: string;
  cnpj: string; // formatado pelo backend
  razaoSocial: string;
  status: StatusCredora;
  elegibilidade: StatusElegibilidade;
  motivoInelegibilidade: string | null;
  tipoCredora: TipoCredora;
  capacidadeAporte: number | null;
  dataCriacao: string; // ISO-8601 com offset
  dataModificacao: string; // ISO-8601 com offset
}

export interface ElegibilidadeResponse {
  status: StatusCredora;
  elegibilidade: StatusElegibilidade;
  motivoInelegibilidade: string | null;
}

export interface OportunidadeResponse {
  id: string;
  propostaId: string;
  contratoId: string | null;
  valor: number;
  prazoMeses: number;
  taxaJurosMensal: number;
  status: StatusOportunidade;
  dataCriacao: string; // ISO-8601 com offset
}

export interface InteresseResponse {
  id: string;
  oportunidadeId: string;
  status: StatusInteresseCredora;
  dataCriacao: string; // ISO-8601 com offset
}

export interface CarteiraCobrancaResumo {
  numeroParcelas: number;
  valorTotal: number;
  parcelasPagas: number;
  parcelasAtrasadas: number;
  totalRecebido: number;
  proximoVencimento: string | null; // yyyy-MM-dd
}

export interface OperacaoCarteiraResponse {
  id: string;
  contratoId: string;
  oportunidadeId: string | null;
  status: StatusOperacaoFinanciada;
  justificativa: string;
  valor: number | null;
  prazoMeses: number | null;
  taxaJurosMensal: number | null;
  contratoStatus: string | null;
  cobranca: CarteiraCobrancaResumo | null;
  dataCriacao: string; // ISO-8601 com offset
}
