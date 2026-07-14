import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<'light' | 'dark'>('light');
  readonly icon = signal<string>('🌙');

  constructor() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') this.applyTheme('dark');
    else { this.applyTheme('light'); }
  }

  toggle(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
  }

  private applyTheme(t: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', t);
    this.theme.set(t);
    this.icon.set(t === 'dark' ? '☀️' : '🌙');
    localStorage.setItem('theme', t);
  }
}
