import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  readonly user = signal<{ email: string } | null>(null);
  readonly isGuest = signal(false);
  readonly loading = signal(true);

  private checked = false;

  async check(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ email: string | null; isGuest: boolean }>('/auth/me'));
      if (res.isGuest) {
        this.user.set({ email: 'guest' });        // persist guest across refresh
        this.isGuest.set(true);
      } else if (res.email) {
        this.user.set({ email: res.email });
        this.isGuest.set(false);
      } else {
        this.user.set(null);
        this.isGuest.set(false);
      }
    } catch {
      // No session cookie → auto-create guest
      if (!this.checked) {
        try {
          await this.guestLogin();
          this.loading.set(false);
          this.checked = true;
          return;
        } catch { /* network down, treat as unauthenticated */ }
      }
      this.user.set(null);
      this.isGuest.set(false);
    }
    this.loading.set(false);
    this.checked = true;
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ email: string; isGuest: boolean }>('/auth/login', { email, password })
    );
    this.user.set({ email: res.email });
    this.isGuest.set(res.isGuest);
  }

  async register(email: string, password: string): Promise<void> {
    await firstValueFrom(this.http.post('/auth/register', { email, password }));
  }

  async guestLogin(): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ email: null; isGuest: boolean }>('/auth/guest', null)
    );
    this.user.set({ email: 'guest' });
    this.isGuest.set(true);
  }

  async convert(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ email: string; isGuest: boolean }>('/auth/convert', { email, password })
    );
    this.user.set({ email: res.email });
    this.isGuest.set(false);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/auth/logout', null));
    this.user.set(null);
    this.isGuest.set(false);
    this.loading.set(false);
    this.checked = true;
  }
}
