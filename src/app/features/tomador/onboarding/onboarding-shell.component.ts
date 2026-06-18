import {
  ChangeDetectionStrategy,
  Component,
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
import { OnboardingMobileService } from '../../../core/onboarding/onboarding-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';
import { DocumentUploadComponent } from './document-upload.component';
import { mensagemOnboardingErro } from './onboarding-error';
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

// Shell da jornada de onboarding do tomador. Orquestra a selecao PF/PJ, o inicio do
// onboarding e o avanco de etapas. Sem persistencia entre recargas: o backend nao expoe
// consulta do onboarding corrente por usuario (apenas por id), entao a jornada vive em
// memoria na sessao, como na web. Decisoes KYC/KYB/PLD pertencem ao backend.
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
  ],
  templateUrl: './onboarding-shell.component.html',
  styleUrl: './onboarding-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingShellComponent {
  private readonly onboarding = inject(OnboardingMobileService);

  protected readonly passos = PASSOS;

  readonly tipo = signal<TipoOnboarding | null>(null);
  readonly onboardingId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly status = signal<OnboardingStatus | null>(null);
  readonly enviandoDocumento = signal(false);
  readonly documentoError = signal<string | null>(null);

  private readonly uploader = viewChild(DocumentUploadComponent);

  readonly etapa = computed<Etapa>(() => {
    if (this.onboardingId()) return 'documentos';
    if (this.tipo()) return 'dados';
    return 'selecionar';
  });

  readonly tiposDocumento = computed<TipoDocumento[]>(() => {
    const tipo = this.tipo();
    if (tipo === 'PF') return TIPOS_DOCUMENTO_PF;
    if (tipo === 'PJ') return TIPOS_DOCUMENTO_PJ;
    return [];
  });

  protected readonly etapaAtualIndice = computed(() =>
    PASSOS.findIndex((passo) => passo.etapa === this.etapa()),
  );

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

  private async iniciar(chamada: () => Promise<{ id: string }>): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const resposta = await chamada();
      this.onboardingId.set(resposta.id);
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
    try {
      this.status.set(
        tipo === 'PF'
          ? await this.onboarding.consultarPessoa(id)
          : await this.onboarding.consultarEmpresa(id),
      );
    } catch (err) {
      this.errorMessage.set(mensagemOnboardingErro(err, 'Nao foi possivel carregar o status.'));
    }
  }
}
