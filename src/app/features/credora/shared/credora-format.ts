// Formatadores de borda da jornada credora. `number` aqui e so apresentacao: nao ha aritmetica
// financeira (o Intl faz a formatacao; a taxa vem do backend como fracao e usa `style: 'percent'`,
// igual ao consumidor web F-11, para evitar divergencia de exibicao).

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

// taxaJurosMensal e uma fracao (ex.: 0.0199 => "1,99% a.m."). `style: 'percent'` aplica a escala
// de apresentacao; o app nao multiplica manualmente nem interpreta a taxa.
export function formatarTaxaMensal(taxa: number): string {
  const percentual = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(taxa);
  return `${percentual} a.m.`;
}

// Data com offset (OffsetDateTime ISO) apenas para exibicao; sem aritmetica de data.
export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

// LocalDate (yyyy-MM-dd, ex.: proximoVencimento) fixa meio-dia local para exibir sem deslocamento
// de fuso. Apenas apresentacao; nenhuma aritmetica de data.
export function formatarDataLocal(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${data}T12:00:00`));
}
