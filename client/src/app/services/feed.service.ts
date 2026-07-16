import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Feed } from '../models/feed';

@Injectable({ providedIn: 'root' })
export class FeedService {
  private http = inject(HttpClient);

  readonly feeds = signal<Feed[]>([]);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly allMode = signal(true);

  async loadFeeds(): Promise<void> {
    const data = await firstValueFrom(this.http.get<Feed[]>('/feeds'));
    this.feeds.set(data);
    this.selectedIds.set(new Set());
    this.allMode.set(true);
  }

  async addFeed(url: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/feeds?url=${encodeURIComponent(url)}`, null));
    } catch (err: any) {
      if (err?.error?.error) throw err; // rethrow with error code from body
      throw err;
    }
  }

  async removeFeed(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/feeds/${id}`));
  }

  async refreshFeed(id: string): Promise<{ articleCount: number }> {
    return firstValueFrom(this.http.post<{ articleCount: number }>(`/feeds/${id}/refresh`, null));
  }

  async refreshAll(): Promise<{ articleCount: number; failed?: { id: string; title: string; error: string }[] }> {
    return firstValueFrom(this.http.post<{ articleCount: number; failed?: { id: string; title: string; error: string }[] }>('/feeds/refresh-all', null));
  }

  async updateFeed(id: string, title: string, url?: string, color?: string | null): Promise<void> {
    await firstValueFrom(this.http.patch(`/feeds/${id}`, { title, url, color }));
    await this.loadFeeds();
  }

  toggleAllMode(): void {
    if (this.allMode()) {
      this.allMode.set(false);
    } else {
      this.allMode.set(true);
      this.selectedIds.set(new Set());
    }
  }

  toggleFeed(id: string): void {
    this.allMode.set(false);
    const ids = new Set(this.selectedIds());
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    this.selectedIds.set(ids);
  }

  getSelectedIdsParam(): string | null {
    if (this.allMode()) return null;
    if (this.selectedIds().size === 0) return null;
    return [...this.selectedIds()].join(',');
  }

  // ── Optimistic toggles: update UI instantly, sync in background ──
  async starFeed(id: string): Promise<{ starred: boolean }> {
    const prev = this.feeds();
    this.feeds.update(list => list.map(f => f.id === id ? { ...f, starred: !f.starred } : f));
    try {
      const res = await firstValueFrom(this.http.post<{ starred: boolean }>(`/feeds/${id}/star`, null));
      return res;
    } catch {
      this.feeds.set(prev); // rollback
      throw new Error('Failed to update star');
    }
  }

  async toggleEmailNotifications(id: string): Promise<{ emailNotifications: boolean }> {
    const prev = this.feeds();
    this.feeds.update(list => list.map(f => f.id === id ? { ...f, emailNotifications: !f.emailNotifications } : f));
    try {
      const res = await firstValueFrom(this.http.post<{ emailNotifications: boolean }>(`/feeds/${id}/email-notifications`, null));
      return res;
    } catch {
      this.feeds.set(prev); // rollback
      throw new Error('Failed to update email notifications');
    }
  }
}
