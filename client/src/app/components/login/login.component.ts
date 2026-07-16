import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LocaleService } from '../../services/locale.service';
import { extractErrorMessage } from '../../services/auth-error';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly localeService = inject(LocaleService);

  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    if (!this.email.trim() || !this.password) { this.error.set(this.localeService.t('login.errorRequired')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) { this.error.set(this.localeService.t('login.errorEmail')); return; }
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      await this.router.navigate(['/']);
    } catch (err: any) {
      this.error.set(extractErrorMessage(err));
    }
    this.loading.set(false);
  }
}
