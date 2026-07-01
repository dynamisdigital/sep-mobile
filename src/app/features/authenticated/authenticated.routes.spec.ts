import { describe, expect, it } from 'vitest';

import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { AUTHENTICATED_ROUTES } from './authenticated.routes';

describe('AUTHENTICATED_ROUTES', () => {
  const parent = AUTHENTICATED_ROUTES[0];
  const children = parent.children ?? [];

  it('protege a area autenticada com authGuard', () => {
    expect(parent.canActivate).toContain(authGuard);
  });

  it('registra a rota onboarding sob o shell autenticado, com lazy load', () => {
    const onboarding = children.find((route) => route.path === 'onboarding');
    expect(onboarding).toBeDefined();
    expect(onboarding?.loadComponent).toBeTypeOf('function');
  });

  it('rota propostas aponta para a lista (substitui o placeholder) e mantem a tab', async () => {
    const propostas = children.find((route) => route.path === 'propostas');
    expect(propostas).toBeDefined();
    expect(propostas?.data?.['tab']).toBe('propostas');
    const loaded = (await propostas?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('PropostasListComponent');
  });

  it('restringe a rota propostas a CLIENTE (ADMIN nao acessa a jornada do tomador)', () => {
    const propostas = children.find((route) => route.path === 'propostas');
    expect(propostas?.canActivate).toContain(roleGuard);
    expect(propostas?.data?.['roles']).toEqual(['CLIENTE']);
  });

  it('registra a rota de criacao propostas/nova restrita a CLIENTE com lazy load', async () => {
    const nova = children.find((route) => route.path === 'propostas/nova');
    expect(nova).toBeDefined();
    expect(nova?.canActivate).toContain(roleGuard);
    expect(nova?.data?.['roles']).toEqual(['CLIENTE']);
    expect(nova?.data?.['tab']).toBe('propostas');
    const loaded = (await nova?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('PropostaCreateComponent');
  });

  it('registra a rota de detalhe propostas/:id restrita a CLIENTE com lazy load', async () => {
    const detalhe = children.find((route) => route.path === 'propostas/:id');
    expect(detalhe).toBeDefined();
    expect(detalhe?.canActivate).toContain(roleGuard);
    expect(detalhe?.data?.['roles']).toEqual(['CLIENTE']);
    expect(detalhe?.data?.['tab']).toBe('propostas');
    const loaded = (await detalhe?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('PropostaDetailComponent');
  });

  it('coloca propostas/nova antes de propostas/:id (literal nao e capturado pelo parametro)', () => {
    const paths = children.map((route) => route.path);
    expect(paths.indexOf('propostas/nova')).toBeLessThan(paths.indexOf('propostas/:id'));
  });

  it('registra as rotas Open Finance (consentimento e retorno) restritas a CLIENTE', async () => {
    const consent = children.find((route) => route.path === 'propostas/:id/open-finance');
    const retorno = children.find((route) => route.path === 'propostas/:id/open-finance/retorno');
    expect(consent?.canActivate).toContain(roleGuard);
    expect(consent?.data?.['roles']).toEqual(['CLIENTE']);
    expect(retorno?.data?.['retorno']).toBe(true);
    const loaded = (await consent?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('OpenFinanceComponent');
  });

  it('registra a entrada de formalizacao restrita a CLIENTE com lazy load', async () => {
    const lista = children.find((route) => route.path === 'formalizacao');
    expect(lista).toBeDefined();
    expect(lista?.canActivate).toContain(roleGuard);
    expect(lista?.data?.['roles']).toEqual(['CLIENTE']);
    expect(lista?.data?.['tab']).toBe('propostas');
    const loaded = (await lista?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('FormalizacaoListComponent');
  });

  it('registra o detalhe do contrato por proposta restrito a CLIENTE com lazy load', async () => {
    const porProposta = children.find(
      (route) => route.path === 'formalizacao/proposta/:propostaId',
    );
    expect(porProposta).toBeDefined();
    expect(porProposta?.canActivate).toContain(roleGuard);
    expect(porProposta?.data?.['roles']).toEqual(['CLIENTE']);
    expect(porProposta?.data?.['tab']).toBe('propostas');
    const loaded = (await porProposta?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('ContratoDetailComponent');
  });

  it('registra o detalhe do contrato por id restrito a CLIENTE com lazy load', async () => {
    const porContrato = children.find(
      (route) => route.path === 'formalizacao/contratos/:contratoId',
    );
    expect(porContrato).toBeDefined();
    expect(porContrato?.canActivate).toContain(roleGuard);
    expect(porContrato?.data?.['roles']).toEqual(['CLIENTE']);
    const loaded = (await porContrato?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('ContratoDetailComponent');
  });

  it('rota parcelas aponta para a entrada (substitui o placeholder), restrita a CLIENTE', async () => {
    const parcelas = children.find((route) => route.path === 'parcelas');
    expect(parcelas).toBeDefined();
    expect(parcelas?.canActivate).toContain(roleGuard);
    expect(parcelas?.data?.['roles']).toEqual(['CLIENTE']);
    expect(parcelas?.data?.['tab']).toBe('parcelas');
    const loaded = (await parcelas?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('ParcelasEntryComponent');
  });

  it('registra a agenda por proposta restrita a CLIENTE com lazy load', async () => {
    const porProposta = children.find((route) => route.path === 'parcelas/proposta/:propostaId');
    expect(porProposta).toBeDefined();
    expect(porProposta?.canActivate).toContain(roleGuard);
    expect(porProposta?.data?.['roles']).toEqual(['CLIENTE']);
    expect(porProposta?.data?.['tab']).toBe('parcelas');
    const loaded = (await porProposta?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('AgendaDetailComponent');
  });

  it('registra a agenda por contrato restrita a CLIENTE com lazy load', async () => {
    const porContrato = children.find((route) => route.path === 'parcelas/contratos/:contratoId');
    expect(porContrato).toBeDefined();
    expect(porContrato?.canActivate).toContain(roleGuard);
    expect(porContrato?.data?.['roles']).toEqual(['CLIENTE']);
    expect(porContrato?.data?.['tab']).toBe('parcelas');
    const loaded = (await porContrato?.loadComponent?.()) as { name: string };
    expect(loaded.name).toContain('AgendaDetailComponent');
  });
});
