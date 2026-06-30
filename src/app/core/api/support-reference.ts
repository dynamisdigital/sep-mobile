import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from './api.models';

const VALID_TRACE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function withSupportReference(error: HttpErrorResponse): HttpErrorResponse {
  if (error.status < 500 || !isApiError(error.error)) {
    return error;
  }

  const traceId = error.error.traceId;
  if (typeof traceId !== 'string' || !VALID_TRACE_ID.test(traceId)) {
    return error;
  }

  const reference = `Código de suporte: ${traceId}.`;
  const message = error.error.message.trim();
  if (message.includes(reference)) {
    return error;
  }

  return new HttpErrorResponse({
    error: {
      ...error.error,
      message: `${message || 'Erro interno.'} ${reference}`,
    },
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
    redirected: error.redirected,
  });
}

function isApiError(value: unknown): value is ApiErrorResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return typeof (value as Partial<ApiErrorResponse>).message === 'string';
}
