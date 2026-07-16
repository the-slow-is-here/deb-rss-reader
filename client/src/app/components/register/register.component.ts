import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LocaleService } from '../../services/locale.service';
import { extractErrorMessage } from '../../services/auth-error';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styles: [`:host { position: fixed; inset: 0; z-index: 100; }`]
})
export class RegisterComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly localeService = inject(LocaleService);

  email = '';
  password = '';
  confirm = '';
  error = signal('');
  backendErrors = signal<string[]>([]);
  loading = signal(false);
  isConvertMode = signal(false);

  ngOnInit(): void {
    this.isConvertMode.set(this.route.snapshot.queryParamMap.get('convert') === 'true');
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.backendErrors.set([]);

    if (this.isConvertMode()) {
      // Conversion: just need email + password to upgrade guest account
      if (!this.email.trim() || !this.password) { this.error.set(this.localeService.t('register.errorRequired')); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) { this.error.set(this.localeService.t('register.errorEmail')); return; }
      if (this.password !== this.confirm) { this.error.set(this.localeService.t('register.errorMismatch')); return; }
      this.loading.set(true);
      try {
        await this.auth.convert(this.email, this.password);
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
      return;
    }

    // Normal registration
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
