import { Component, inject, effect, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ArticleCardComponent } from '../article-card/article-card.component';
import { ToastComponent } from '../toast/toast.component';
import { ModalComponent } from '../modal/modal.component';
import { SuggestedFeedsComponent } from '../suggested-feeds/suggested-feeds.component';
import { FeedService } from '../../services/feed.service';
import { ArticleService } from '../../services/article.service';
import { AuthService } from '../../services/auth.service';
import { UiService } from '../../services/ui.service';
import { ToastService } from '../../services/toast.service';
import { PlaylistService } from '../../services/playlist.service';
import { LocaleService } from '../../services/locale.service';
import { Feed } from '../../models/feed';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, HeaderComponent, SidebarComponent, ArticleCardComponent, ToastComponent, ModalComponent, SuggestedFeedsComponent],
  templateUrl: './home.component.html',
  styleUrls: []
})
export class HomeComponent implements OnDestroy {
  readonly feedService = inject(FeedService);
  readonly articleService = inject(ArticleService);
  readonly authService = inject(AuthService);
  readonly uiService = inject(UiService);
  readonly toastService = inject(ToastService);
  readonly playlistService = inject(PlaylistService);
  readonly localeService = inject(LocaleService);

  guestBannerDismissed = signal(false);
  modalVisible = false;
  modalMessage = '';
  private feedToDelete: Feed | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private isVisible = true;

  readonly HUES = [8, 24, 40, 160, 172, 190, 204, 340];
  stationColor(id: string): string {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${this.HUES[h % this.HUES.length]} 72% 52%)`;
  }

  constructor() {
    effect(() => {
      if (this.authService.user() && !this.authService.loading()) {
        this.articleService.loading.set(true);
        this.feedService.loadFeeds().then(() => {
          this.articleService.loadArticles(true, null);
        });
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });

    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible';
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(async () => {
      if (!this.isVisible || !this.authService.user()) return;
      try {
        const res = await this.feedService.refreshAll();
        if (res.articleCount > 0) {
          this.articleService.invalidateCache();
          await this.articleService.loadArticles(false, this.feedService.getSelectedIdsParam());
        }
      } catch { /* silent */ }
    }, 10 * 60 * 1000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  onDeleteRequest(f: Feed): void {
    this.feedToDelete = f;
    this.modalMessage = this.localeService.t('modal.confirmFeed', { name: f.title || f.url });
    this.modalVisible = true;
  }

  async onConfirmDelete(): Promise<void> {
    this.modalVisible = false;
    if (!this.feedToDelete) return;
    try {
      await this.feedService.removeFeed(this.feedToDelete.id);
      this.toastService.show(this.localeService.t('toast.feedRemoved'));
      await this.feedService.loadFeeds();
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    this.feedToDelete = null;
  }

  onCancelDelete(): void {
    this.modalVisible = false;
    this.feedToDelete = null;
  }

  get totalPages(): number { return Math.ceil(this.articleService.totalCount() / this.articleService.pageSize) || 1; }

  prevPage(): void {
    if (this.articleService.page() > 1) {
      document.getElementById('main')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      this.articleService.goToPage(this.articleService.page() - 1, this.feedService.getSelectedIdsParam());
    }
  }

  nextPage(): void {
    if (this.articleService.page() < this.totalPages) {
      document.getElementById('main')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      this.articleService.goToPage(this.articleService.page() + 1, this.feedService.getSelectedIdsParam());
    }
  }

  get emptyStateHtml(): string {
    const ls = this.localeService;
    if (this.articleService.searchQuery() || this.articleService.dateFrom() || this.articleService.dateTo()) {
      let desc = ls.t('empty.search');
      const q = this.articleService.searchQuery();
      if (q) desc += ls.t('empty.searchFor', { term: this.escapeHtml(q) });
      if (this.articleService.dateFrom() || this.articleService.dateTo()) desc += ls.t('empty.searchDateRange');
      desc += '.';
      return `<div class="glyph">🔍</div><h2>${desc}</h2><p>${ls.t('empty.searchHint')}</p>`;
    }
    if (this.uiService.viewMode() === 'playlists' && !this.playlistService.selectedId()) {
      return `<div class="glyph">📁</div><h2>${ls.t('empty.noPlaylistSelected')}</h2><p>${ls.t('empty.noPlaylistHint')}</p>`;
    }
    if (this.uiService.viewMode() === 'playlists' && this.playlistService.selectedId()) {
      return `<div class="glyph">📁</div><h2>${ls.t('empty.playlistEmpty')}</h2><p>${ls.t('empty.playlistHint')}</p>`;
    }
    if (this.feedService.selectedIds().size === 0 && !this.feedService.allMode()) {
      return `<div class="glyph">📭</div><h2>${ls.t('empty.noFeedSelected')}</h2><p>${ls.t('empty.noFeedHint')}</p>`;
    }
    if (this.feedService.selectedIds().size === 1) {
      return `<div class="glyph">📭</div><h2>${ls.t('empty.singleFeedEmpty')}</h2><p>${ls.t('empty.singleFeedHint')}</p>`;
    }
    if (this.articleService.starredOnly()) {
      return `<div class="glyph">⭐</div><h2>${ls.t('empty.noStarred')}</h2><p>${ls.t('empty.noStarredHint')}</p>`;
    }
    if (this.feedService.feeds().length === 0) {
      return `<div class="glyph">📭</div><h2>${ls.t('empty.firstBoot')}</h2>`;
    }
    return `<div class="glyph">📭</div><h2>${ls.t('empty.allFeedsEmpty')}</h2><p>${ls.t('empty.allFeedsHint')}</p>`;
  }

  get showEmpty(): boolean { return !this.articleService.loading() && this.articleService.articles().length === 0; }

  get showPagination(): boolean {
    return this.totalPages > 1 && !this.articleService.loading() && this.articleService.articles().length > 0;
  }

  get resultsSummaryText(): string | null {
    if (this.articleService.loading()) return null;
    const q = this.articleService.searchQuery();
    const df = this.articleService.dateFrom();
    const dt = this.articleService.dateTo();
    const st = this.articleService.starredOnly();

    if (!q && !df && !dt && !st) return null;

    const ls = this.localeService;
    const parts: string[] = [];
    if (st) parts.push(ls.t('summary.starred'));
    if (q) parts.push(`"${q}"`);

    let range = '';
    if (df && dt) range = ls.t('summary.range', { from: df, to: dt });
    else if (df) range = ls.t('summary.since', { from: df });
    else if (dt) range = ls.t('summary.until', { to: dt });
    if (range) parts.push(range);

    return ls.t('summary.found', { count: this.articleService.totalCount(), filters: parts.join(' · ') });
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
