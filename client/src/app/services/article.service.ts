import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Article } from '../models/article';
import { FeedService } from './feed.service';

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private http = inject(HttpClient);
  private feedService = inject(FeedService);

  readonly articles = signal<Article[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly searchQuery = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly pageSize = 20;

  async loadArticles(replace = false, feedIdsParam: string | null = null): Promise<void> {
    if (!this.feedService.allMode() && this.feedService.selectedIds().size === 0) {
      this.articles.set([]);
      this.totalCount.set(0);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    if (replace) this.page.set(1);

    const params = new URLSearchParams({ page: String(this.page()), pageSize: String(this.pageSize) });
    if (feedIdsParam) params.set('feedIds', feedIdsParam);
    if (this.searchQuery()) params.set('q', this.searchQuery());
    if (this.dateFrom()) params.set('dateFrom', this.dateFrom());
    if (this.dateTo()) params.set('dateTo', this.dateTo());

    const data = await firstValueFrom(
      this.http.get<{ articles: Article[]; totalCount: number }>(`/articles?${params}`)
    );
    this.articles.set(data.articles);
    this.totalCount.set(data.totalCount);
    this.loading.set(false);
  }

  goToPage(n: number, feedIdsParam: string | null = null): void {
    this.page.set(n);
    this.loadArticles(false, feedIdsParam);
  }
}
