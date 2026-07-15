import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly sidebarOpen = signal(false);
  readonly viewMode = signal<'feeds' | 'playlists'>('feeds');
  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
}
