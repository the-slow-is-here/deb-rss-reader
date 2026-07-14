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
    await firstValueFrom(this.http.post(`/feeds?url=${encodeURIComponent(url)}`, null));
  }

  async removeFeed(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/feeds/${id}`));
  }

  async refreshFeed(id: string): Promise<{ articleCount: number }> {
    return firstValueFrom(this.http.post<{ articleCount: number }>(`/feeds/${id}/refresh`, null));
  }

  async refreshAll(): Promise<{ articleCount: number }> {
    return firstValueFrom(this.http.post<{ articleCount: number }>('/feeds/refresh-all', null));
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
}
