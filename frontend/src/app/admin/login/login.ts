import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../core/services/api';
import { JWT_STORAGE_KEY } from '../../core/interceptors/auth-interceptor';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly api    = inject(Api);
  private readonly router = inject(Router);

  username = '';
  password = '';
  loading  = false;
  error: string | null = null;

  submit(): void {
    if (this.loading || !this.username || !this.password) return;
    this.loading = true;
    this.error   = null;

    this.api.login(this.username, this.password).subscribe({
      next: ({ token }) => {
        sessionStorage.setItem(JWT_STORAGE_KEY, token);
        this.router.navigate(['/admin/exhibitions']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.status === 401
          ? 'Falscher Benutzername oder falsches Passwort.'
          : 'Verbindungsfehler. Bitte versuche es nochmal.';
      },
    });
  }
}
