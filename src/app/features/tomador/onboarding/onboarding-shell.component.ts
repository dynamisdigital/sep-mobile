import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import {
  IniciarOnboardingEmpresaRequest,
  IniciarOnboardingPessoaRequest,
  StatusOnboardingEmpresaResponse,
  StatusOnboardingResponse,
  TipoDocumento,
} from '../../../core/api/api.models';
import { OnboardingJourneyStore } from '../../../core/onboarding/onboarding-journey.store';
import { OnboardingMobileService } from '../../../core/onboarding/onboarding-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { DocumentUploadComponent } from './document-upload.component';
import { mensagemOnboardingErro } from './onboarding-error';
import { OnboardingStatusComponent } from './onboarding-status.component';
import { PessoaFisicaFormComponent } from './pessoa-fisica-form.component';
import { PessoaJuridicaFormComponent } from './pessoa-juridica-form.component';

type TipoOnboarding = 'PF' | 'PJ';
type Etapa = 'selecionar' | 'dados' | 'documentos' | 'status';
type OnboardingStatus = StatusOnboardingResponse | StatusOnboardingEmpresaResponse;

const TIPOS_DOCUMENTO_PF: TipoDocumento[] = ['RG', 'CNH', 'PASSAPORTE', 'SELFIE'];
const TIPOS_DOCUMENTO_PJ: TipoDocumento[] = ['CONTRATO_SOCIAL', 'CCMEI', 'COMPROVANTE_ENDERECO'];

interface PassoJornada {
  etapa: Exclude<Etapa, 'selecionar'>;
  rotulo: string;
}

const PASSOS: readonly PassoJornada[] = [
  { etapa: 'dados', rotulo: 'Dados' },
  { etapa: 'documentos', rotulo: 'Documentos' },
  { etapa: 'status', rotulo: 'Status' },
];

// Shell da jornada de onboarding do tomador. Orquestra selecao PF/PJ, inicio, envio de
// documentos e acompanhamento de status. O backend nao expoe consulta do onboarding
// corrente por usuario (apenas por id); por isso o ponteiro {tipo,id} e persistido via
// OnboardingJourneyStore para sobreviver a recargas (sem PII). Decisoes KYC/KYB/PLD
// pertencem ao backend; a tela apenas reflete o status retornado.
@Component({
  selector: 'sep-onboarding-shell',
  standalone: true,
  imports: [
    IonContent,
    RouterLink,
    HeaderMobileComponent,
    PessoaFisicaFormComponent,
    PessoaJuridicaFormComponent,
    DocumentUploadComponent,
    OnboardingStatusComponent,
  ],
  templateUrl: './onboarding-shell.component.html',
  styleUrl: './onboarding-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingShellComponent implements OnInit {
  private readonly onboarding = inject(OnboardingMobileService);
  private readonly journeyStore = inject(OnboardingJourneyStore);

  protected readonly passos = PASSOS;

  readonly tipo = signal<TipoOnboarding | null>(null);
  readonly onboardingId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly status = signal<OnboardingStatus | null>(null);
  readonly carregandoStatus = signal(false);
  readonly enviandoDocumento = signal(false);
  readonly documentoError = signal<string | null>(null);
  readonly verificando = signal(false);
  readonly mostrarStatus = signal(false);

  private readonly uploader = viewChild(DocumentUploadComponent);

  readonly etapa = computed<Etapa>(() => {
    if (this.onboardingId()) {
      return this.mostrarStatus() ? 'status' : 'documentos';
    }
    return this.tipo() ? 'dados' : 'selecionar';
  });

  readonly tiposDocumento = computed<TipoDocumento[]>(() => {
    const tipo = this.tipo();
    if (tipo === 'PF') return TIPOS_DOCUMENTO_PF;
    if (tipo === 'PJ') return TIPOS_DOCUMENTO_PJ;
    return [];
  });

  // Representantes existem apenas na resposta PJ; narrowing seguro sobre a uniao.
  readonly representantes = computed(() => {
    const atual = this.status();
    return atual && 'representantes' in atual ? atual.representantes : [];
  });

  protected readonly etapaAtualIndice = computed(() =>
    PASSOS.findIndex((passo) => passo.etapa === this.etapa()),
  );

  async ngOnInit(): Promise<void> {
    const journey = await this.journeyStore.carregar();
    if (!journey) {
      return;
    }
    this.tipo.set(journey.tipo);
    this.onboardingId.set(journey.onboardingId);
    await this.carregarStatus();
  }

  selecionarTipo(tipo: TipoOnboarding): void {
    this.errorMessage.set(null);
    this.tipo.set(tipo);
  }

  voltarSelecao(): void {
    this.errorMessage.set(null);
    this.tipo.set(null);
  }

  async onIniciarPessoa(request: IniciarOnboardingPessoaRequest): Promise<void> {
    await this.iniciar(() => this.onboarding.iniciarPessoa(request));
  }

  async onIniciarEmpresa(request: IniciarOnboardingEmpresaRequest): Promise<void> {
    await this.iniciar(() => this.onboarding.iniciarEmpresa(request));
  }

  async onEnviarDocumento(evento: { tipo: TipoDocumento; arquivo: File }): Promise<void> {
    const id = this.onboardingId();
    const tipo = this.tipo();
    if (!id || !tipo) {
      return;
    }
    this.documentoError.set(null);
    this.enviandoDocumento.set(true);
    try {
      if (tipo === 'PF') {
        await this.onboarding.enviarDocumentoPessoa(id, evento.tipo, evento.arquivo);
      } else {
        await this.onboarding.enviarDocumentoEmpresa(id, evento.tipo, evento.arquivo);
      }
      this.uploader()?.limpar();
      await this.carregarStatus();
    } catch (err) {
      this.documentoError.set(mensagemOnboardingErro(err, 'Nao foi possivel enviar o documento.'));
    } finally {
      this.enviandoDocumento.set(false);
    }
  }

  async onVerificar(): Promise<void> {
    const id = this.onboardingId();
    const tipo = this.tipo();
    if (!id || !tipo) {
      return;
    }
    this.errorMessage.set(null);
    this.verificando.set(true);
    try {
      if (tipo === 'PF') {
        await this.onboarding.verificarPessoa(id);
      } else {
        await this.onboarding.verificarEmpresa(id);
      }
      await this.carregarStatus();
    } catch (err) {
      this.errorMessage.set(mensagemOnboardingErro(err, 'Nao foi possivel iniciar a verificacao.'));
    } finally {
      this.verificando.set(false);
    }
  }

  irParaStatus(): void {
    this.errorMessage.set(null);
    this.mostrarStatus.set(true);
  }

  voltarDocumentos(): void {
    this.mostrarStatus.set(false);
  }

  atualizarStatus(): Promise<void> {
    return this.carregarStatus();
  }

  async recomecar(): Promise<void> {
    await this.journeyStore.limpar();
    this.tipo.set(null);
    this.onboardingId.set(null);
    this.status.set(null);
    this.mostrarStatus.set(false);
    this.errorMessage.set(null);
    this.documentoError.set(null);
  }

  private async iniciar(chamada: () => Promise<{ id: string }>): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const resposta = await chamada();
      this.onboardingId.set(resposta.id);
      const tipo = this.tipo();
      if (tipo) {
        await this.journeyStore.salvar({ tipo, onboardingId: resposta.id });
      }
      await this.carregarStatus();
    } catch (err) {
      this.errorMessage.set(mensagemOnboardingErro(err, 'Nao foi possivel iniciar o onboarding.'));
    } finally {
      this.submitting.set(false);
    }
  }

  private async carregarStatus(): Promise<void> {
    const id = this.onboardingId();
    const tipo = this.tipo();
    if (!id || !tipo) {
      return;
    }
    this.carregandoStatus.set(true);
    try {
      this.status.set(
        tipo === 'PF'
          ? await this.onboarding.consultarPessoa(id)
          : await this.onboarding.consultarEmpresa(id),
      );
    } catch (err) {
      this.errorMessage.set(mensagemOnboardingErro(err, 'Nao foi possivel carregar o status.'));
    } finally {
      this.carregandoStatus.set(false);
    }
  }
}
