import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { UsuarioSenhaUpdateRequest } from '../api/api.models';

const API_BASE_URL = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  alterarSenha(id: string, payload: UsuarioSenhaUpdateRequest): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`${API_BASE_URL}/usuarios/${id}/senha`, payload));
  }
}
