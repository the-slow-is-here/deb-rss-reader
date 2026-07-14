import { Component, inject, OnInit } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ArticleCardComponent } from './components/article-card/article-card.component';
import { ToastComponent } from './components/toast/toast.component';
import { ModalComponent } from './components/modal/modal.component';
import { FeedService } from './services/feed.service';
import { ArticleService } from './services/article.service';
import { UiService } from './services/ui.service';
import { ToastService } from './services/toast.service';
import { Feed } from './models/feed';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HeaderComponent, SidebarComponent, ArticleCardComponent, ToastComponent, ModalComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  readonly feedService = inject(FeedService);
  readonly articleService = inject(ArticleService);
  readonly uiService = inject(UiService);
  readonly toastService = inject(ToastService);

  modalVisible = false;
  modalMessage = '';
  private feedToDelete: Feed | null = null;

  readonly HUES = [8, 24, 40, 160, 172, 190, 204, 340];
  stationColor(id: string): string {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${this.HUES[h % this.HUES.length]} 72% 52%)`;
  }

  ngOnInit(): void {
    this.feedService.loadFeeds().then(() => {
      this.articleService.loadArticles(true, null);
    });
  }

  onDeleteRequest(f: Feed): void {
    this.feedToDelete = f;
    this.modalMessage = `Are you sure you want to remove "${f.title || f.url}"?`;
    this.modalVisible = true;
  }

  async onConfirmDelete(): Promise<void> {
    this.modalVisible = false;
    if (!this.feedToDelete) return;
    try {
      await this.feedService.removeFeed(this.feedToDelete.id);
      this.toastService.show('Feed removed');
      await this.feedService.loadFeeds();
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    this.feedToDelete = null;
  }

  onCancelDelete(): void {
    this.modalVisible = false;
    this.feedToDelete = null;
  }

  get totalPages(): number {
    return Math.ceil(this.articleService.totalCount() / this.articleService.pageSize) || 1;
  }

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
    if (this.articleService.searchQuery() || this.articleService.dateFrom() || this.articleService.dateTo()) {
      let desc = 'No matches found';
      const q = this.articleService.searchQuery();
      if (q) desc += ` for &ldquo;<strong>${this.escapeHtml(q)}</strong>&rdquo;`;
      if (this.articleService.dateFrom() || this.articleService.dateTo()) {
        desc += ' in the selected date range';
      }
      desc += '.';
      return `<div class="glyph">🔍</div><h2>${desc}</h2><p>Try adjusting your search or clearing the filters.</p>`;
    }
    const noSelection = this.feedService.selectedIds().size === 0 && !this.feedService.allMode();
    if (noSelection) {
      return '<div class="glyph">📭</div><h2>No feed selected</h2><p>Choose feeds from the sidebar or select <strong>All Feeds</strong> to see articles.</p>';
    }
    return '<div class="glyph">📭</div><h2>No articles found</h2><p>Hit <strong>↻ Refresh All</strong> or the <strong>↻</strong> button beside a feed to pull in the latest.</p>';
  }

  get showEmpty(): boolean {
    if (this.articleService.loading()) return false;
    if (this.articleService.articles().length > 0) return false;
    return true;
  }

  get showPagination(): boolean {
    return !this.articleService.loading() && this.articleService.articles().length > 0 && this.totalPages > 1;
  }

  get resultsSummaryText(): string | null {
    const q = this.articleService.searchQuery();
    const df = this.articleService.dateFrom();
    const dt = this.articleService.dateTo();
    if (!q && !df && !dt) return null;
    const parts: string[] = [];
    if (q) parts.push(`"${q}"`);
    let range = '';
    if (df && dt) range = `${df} – ${dt}`;
    else if (df) range = `since ${df}`;
    else if (dt) range = `until ${dt}`;
    if (range) parts.push(range);
    return `Found ${this.articleService.totalCount()} results for ${parts.join(' · ')}`;
  }

  escapeHtml(s: string | null | undefined): string {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }
}
