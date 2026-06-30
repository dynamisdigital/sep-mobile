import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonButton, IonContent, IonInput, IonNote, IonSpinner } from '@ionic/angular/standalone';

import {
  ApiErrorResponse,
  MovimentacaoConsolidadaResponse,
  OpenFinanceStatusResponse,
  StatusConsentimento,
} from '../../../core/api/api.models';
import { CreditoMobileService } from '../../../core/credito/credito-mobile.service';
import { HeaderMobileComponent } from '../../../layout/header-mobile/header-mobile.component';

// CPF (11) ou CNPJ (14), somente numeros — espelha a validacao do backend.
const DOCUMENTO_PATTERN = /^\d{11}$|^\d{14}$/;

const ROTULOS_STATUS: Record<StatusConsentimento, string> = {
  PENDENTE: 'Pendente',
  AUTORIZADO: 'Autorizado',
  NEGADO: 'Negado',
  EXPIRADO: 'Expirado',
};

// Fluxo opt-in Open Finance (consentimento + retorno) no PWA. A mesma tela atende as duas
// rotas: no modo consentimento coleta o documento e faz o handoff; no modo retorno apenas
// consulta a API SEP. A API SEP e a unica fonte de verdade do status (query params do
// provider sao ignorados). O app nunca persiste documento nem agregados, e so exibe os
// agregados sanitizados devolvidos pelo backend (sem payload bruto/conta/agencia/titular).
@Component({
  selector: 'sep-open-finance',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonNote,
    IonButton,
    IonSpinner,
    HeaderMobileComponent,
  ],
  templateUrl: './open-finance.component.html',
  styleUrl: './open-finance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenFinanceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly credito = inject(CreditoMobileService);
  private readonly route = inject(ActivatedRoute);

  readonly retorno = signal(false);
  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly status = signal<OpenFinanceStatusResponse | null>(null);
  // 404 no GET: ainda nao ha consentimento — no modo consentimento, oferece o formulario.
  readonly semConsentimento = signal(false);
  readonly erro = signal<string | null>(null);

  readonly form = this.fb.group({
    documento: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.pattern(DOCUMENTO_PATTERN),
    ]),
  });

  private id = '';

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.retorno.set(this.route.snapshot.data['retorno'] === true);
    await this.consultar();
  }

  async consultar(): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.status.set(await this.credito.consultarOpenFinance(this.id));
      this.semConsentimento.set(false);
    } catch (err) {
      this.status.set(null);
      if (err instanceof HttpErrorResponse && err.status === 404 && !this.retorno()) {
        // Sem consentimento ainda: no modo consentimento oferece o formulario.
        this.semConsentimento.set(true);
      } else if (err instanceof HttpErrorResponse && err.status === 404) {
        // Retorno sem consentimento encontrado: pode ser propagacao em andamento.
        this.erro.set('Consentimento ainda nao encontrado. Atualize em instantes.');
      } else {
        this.erro.set(this.mensagem(err) ?? 'Nao foi possivel consultar o Open Finance.');
      }
    } finally {
      this.carregando.set(false);
    }
  }

  async iniciar(): Promise<void> {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    const cpfCnpjTomador = this.form.controls.documento.value;
    try {
      const consentimento = await this.credito.iniciarConsentimentoOpenFinance(this.id, {
        cpfCnpjTomador,
        redirectUri: this.redirectUri(),
      });
      this.form.reset();
      if (!urlSegura(consentimento.urlAutorizacao)) {
        this.erro.set('URL de autorizacao invalida. Handoff bloqueado por seguranca.');
        return;
      }
      this.navegarExterno(consentimento.urlAutorizacao);
    } catch (err) {
      this.form.reset();
      if (err instanceof HttpErrorResponse && err.status === 409) {
        // Ja existe consentimento PENDENTE: consulta o status em vez de criar outro.
        await this.consultar();
      } else {
        this.erro.set(this.mensagem(err) ?? 'Nao foi possivel iniciar o consentimento.');
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected agregados(): MovimentacaoConsolidadaResponse | null {
    return this.status()?.ultimaMovimentacao ?? null;
  }

  protected rotuloStatus(status: StatusConsentimento): string {
    return ROTULOS_STATUS[status];
  }

  protected valorFormatado(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  protected dataFormatada(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  }

  // Handoff na mesma aba (PWA). Isolado para permitir bloqueio quando a URL nao for http(s).
  protected navegarExterno(url: string): void {
    window.location.href = url;
  }

  // `redirectUri` e sempre gerada pela origem atual + rota interna de retorno; nunca digitada
  // pelo usuario nem derivada de query params do provider.
  private redirectUri(): string {
    return `${window.location.origin}/app/propostas/${this.id}/open-finance/retorno`;
  }

  private mensagem(err: unknown): string | null {
    return err instanceof HttpErrorResponse
      ? ((err.error as ApiErrorResponse | undefined)?.message ?? null)
      : null;
  }
}

// Aceita apenas http(s); bloqueia javascript:, data: e outros schemes antes do handoff.
function urlSegura(url: string): boolean {
  try {
    const protocolo = new URL(url).protocol;
    return protocolo === 'http:' || protocolo === 'https:';
  } catch {
    return false;
  }
}
