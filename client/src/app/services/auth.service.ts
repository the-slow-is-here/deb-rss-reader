import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly user = signal<{ email: string } | null>(null);
  readonly loading = signal(true);

  async check(): Promise<void> {
    try {
      this.user.set(await firstValueFrom(this.http.get<{ email: string }>('/auth/me')));
    } catch {
      this.user.set(null);
    }
    this.loading.set(false);
  }

  async login(email: string, password: string): Promise<void> {
    const params = new URLSearchParams({ email, password });
    const res = await firstValueFrom(this.http.post<{ email: string }>(`/auth/login?${params}`, null));
    this.user.set(res);
  }

  async register(email: string, password: string): Promise<void> {
    const params = new URLSearchParams({ email, password });
    await firstValueFrom(this.http.post(`/auth/register?${params}`, null));
    await this.login(email, password);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/auth/logout', null));
    this.user.set(null);
  }
}
