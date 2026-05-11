import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';

import { BiometricService } from '../../../../core/auth/biometric.service';

@Component({
  selector: 'sep-setup-biometric',
  standalone: true,
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonText, IonButton, IonToggle],
  templateUrl: './setup-biometric.component.html',
  styleUrls: ['./setup-biometric.component.scss'],
})
export class SetupBiometricComponent implements OnInit {
  private readonly biometric = inject(BiometricService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  readonly disponivel = signal<boolean | null>(null);
  readonly confiado = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    this.disponivel.set(await this.biometric.checkAvailability());
    this.confiado.set(await this.biometric.isTrustedDevice());
  }

  async alternar(novoEstado: boolean): Promise<void> {
    if (novoEstado) {
      const ok = await this.biometric.authenticate(
        'Confirme sua identidade para confiar neste dispositivo no SEP.',
      );
      if (!ok) {
        const toast = await this.toastCtrl.create({
          message: 'Biometria indisponivel ou cancelada.',
          duration: 2500,
          position: 'top',
        });
        await toast.present();
        this.confiado.set(false);
        return;
      }
      await this.biometric.trustDevice();
      this.confiado.set(true);
    } else {
      await this.biometric.forgetDevice();
      this.confiado.set(false);
    }
  }

  async voltar(): Promise<void> {
    await this.router.navigateByUrl('/app/perfil');
  }
}
