import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  IonButton,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';

import { TipoDocumento } from '../../../core/api/api.models';

// Limite de tamanho identico ao backend (10 MB). A validacao local cobre apenas o
// obvio (tamanho); a aceitacao real do documento e decidida pelo backend.
const MAX_BYTES = 10 * 1024 * 1024;

const ROTULOS: Record<TipoDocumento, string> = {
  RG: 'RG',
  CNH: 'CNH',
  PASSAPORTE: 'Passaporte',
  SELFIE: 'Selfie',
  CONTRATO_SOCIAL: 'Contrato social',
  CCMEI: 'CCMEI',
  COMPROVANTE_ENDERECO: 'Comprovante de endereco',
};

// Componente apresentacional de upload: seleciona tipo e arquivo, valida tamanho local e
// emite o documento. O envio HTTP (FormData) e a atualizacao de status ficam no shell.
@Component({
  selector: 'sep-document-upload',
  standalone: true,
  imports: [IonSelect, IonSelectOption, IonButton, IonNote, IonSpinner],
  templateUrl: './document-upload.component.html',
  styleUrl: './document-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent {
  readonly tipos = input.required<TipoDocumento[]>();
  readonly enviando = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly enviar = output<{ tipo: TipoDocumento; arquivo: File }>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly tipoSelecionado = signal<TipoDocumento | null>(null);
  protected readonly arquivo = signal<File | null>(null);
  protected readonly erroLocal = signal<string | null>(null);

  protected readonly podeEnviar = computed(
    () => this.tipoSelecionado() !== null && this.arquivo() !== null,
  );

  protected rotulo(tipo: TipoDocumento): string {
    return ROTULOS[tipo];
  }

  protected tamanhoLegivel(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  aoSelecionarTipo(tipo: TipoDocumento): void {
    this.tipoSelecionado.set(tipo);
  }

  aoSelecionarArquivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    this.erroLocal.set(null);
    if (arquivo && arquivo.size > MAX_BYTES) {
      this.erroLocal.set('Arquivo excede o limite de 10 MB.');
      this.arquivo.set(null);
      return;
    }
    this.arquivo.set(arquivo);
  }

  enviarDocumento(): void {
    const tipo = this.tipoSelecionado();
    const arquivo = this.arquivo();
    if (!tipo || !arquivo || this.enviando()) {
      return;
    }
    this.enviar.emit({ tipo, arquivo });
  }

  limpar(): void {
    this.tipoSelecionado.set(null);
    this.arquivo.set(null);
    this.erroLocal.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = '';
    }
  }
}
