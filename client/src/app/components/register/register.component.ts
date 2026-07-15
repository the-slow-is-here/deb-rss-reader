import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
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

  email = '';
  password = '';
  confirm = '';
  error = signal('');
  backendErrors: string[] = [];
  loading = false;

  async submit(): Promise<void> {
    this.error.set('');
    this.backendErrors = [];
    if (!this.email.trim() || !this.password) { this.error.set('Email and password are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) { this.error.set('Please enter a valid email address.'); return; }
    if (this.password !== this.confirm) { this.error.set('Passwords do not match.'); return; }
    this.loading = true;
    try {
      await this.auth.register(this.email, this.password);
      await this.auth.login(this.email, this.password);
      await this.router.navigate(['/']);
    } catch (err: any) {
      const body = err?.error;
      if (body?.errors && Array.isArray(body.errors) && body.errors.length) {
        this.backendErrors = body.errors;
      } else {
        this.error.set(extractErrorMessage(err));
      }
    }
    this.loading = false;
  }
}
