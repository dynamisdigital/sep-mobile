import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TipoDocumento } from '../../../core/api/api.models';
import { DocumentUploadComponent } from './document-upload.component';

// Ionic (ion-select) nao monta no happy-dom; testamos a logica via instancia.
function build(): DocumentUploadComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const injector = TestBed.inject(EnvironmentInjector);
  return runInInjectionContext(injector, () => new DocumentUploadComponent());
}

function fileEvent(arquivo: File): Event {
  return { target: { files: [arquivo] } } as unknown as Event;
}

function arquivoComTamanho(bytes: number): File {
  const arquivo = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
  Object.defineProperty(arquivo, 'size', { value: bytes });
  return arquivo;
}

describe('DocumentUploadComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('nao emite sem tipo e arquivo selecionados', () => {
    const component = build();
    const emitido = vi.fn();
    component.enviar.subscribe(emitido);
    component.enviarDocumento();
    expect(emitido).not.toHaveBeenCalled();
  });

  it('arquivo acima de 10 MB e rejeitado e bloqueia o envio', () => {
    const component = build();
    const emitido = vi.fn();
    component.enviar.subscribe(emitido);
    component.aoSelecionarTipo('RG');
    component.aoSelecionarArquivo(fileEvent(arquivoComTamanho(11 * 1024 * 1024)));
    component.enviarDocumento();
    expect(emitido).not.toHaveBeenCalled();
  });

  it('emite tipo e arquivo validos', () => {
    const component = build();
    let emitido: { tipo: TipoDocumento; arquivo: File } | undefined;
    component.enviar.subscribe((evento) => (emitido = evento));
    const arquivo = arquivoComTamanho(2 * 1024 * 1024);
    component.aoSelecionarTipo('SELFIE');
    component.aoSelecionarArquivo(fileEvent(arquivo));
    component.enviarDocumento();
    expect(emitido).toEqual({ tipo: 'SELFIE', arquivo });
  });

  it('limpar reseta a selecao e bloqueia novo envio', () => {
    const component = build();
    const emitido = vi.fn();
    component.enviar.subscribe(emitido);
    component.aoSelecionarTipo('RG');
    component.aoSelecionarArquivo(fileEvent(arquivoComTamanho(1024)));
    component.limpar();
    component.enviarDocumento();
    expect(emitido).not.toHaveBeenCalled();
  });
});
