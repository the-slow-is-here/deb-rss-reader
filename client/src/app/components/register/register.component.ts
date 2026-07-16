import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LocaleService } from '../../services/locale.service';
import { extractErrorMessage } from '../../services/auth-error';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly localeService = inject(LocaleService);

  email = '';
  password = '';
  confirm = '';
  error = signal('');
  backendErrors = signal<string[]>([]);
  loading = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    this.backendErrors.set([]);
    if (!this.email.trim() || !this.password) { this.error.set(this.localeService.t('register.errorRequired')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) { this.error.set(this.localeService.t('register.errorEmail')); return; }
    if (this.password !== this.confirm) { this.error.set(this.localeService.t('register.errorMismatch')); return; }
    this.loading.set(true);
    try {
      await this.auth.register(this.email, this.password);
      await this.auth.login(this.email, this.password);
      await this.router.navigate(['/']);
    } catch (err: any) {
      const body = err?.error;
      if (body?.errors && Array.isArray(body.errors) && body.errors.length) {
        this.backendErrors.set(body.errors);
      } else {
        this.error.set(extractErrorMessage(err));
      }
    }
    this.loading.set(false);
  }
}
