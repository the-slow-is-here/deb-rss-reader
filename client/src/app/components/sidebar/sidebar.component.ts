import { Component, inject, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeedService } from '../../services/feed.service';
import { ArticleService } from '../../services/article.service';
import { ToastService } from '../../services/toast.service';
import { UiService } from '../../services/ui.service';
import { Feed } from '../../models/feed';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  readonly feedService = inject(FeedService);
  readonly articleService = inject(ArticleService);
  readonly toastService = inject(ToastService);
  readonly uiService = inject(UiService);

  @Output() deleteRequested = new EventEmitter<Feed>();

  refreshAllDisabled = false;
  addDisabled = false;
  url = '';

  readonly HUES = [8, 24, 40, 160, 172, 190, 204, 340];
  stationColor(id: string): string {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${this.HUES[h % this.HUES.length]} 72% 52%)`;
  }

  isFeedSelected(f: Feed): boolean {
    if (this.feedService.allMode()) return false;
    return this.feedService.selectedIds().has(f.id);
  }

  async addFeed(): Promise<void> {
    const u = this.url.trim();
    if (!u) return;
    this.addDisabled = true;
    try {
      await this.feedService.addFeed(u);
      this.url = '';
      await this.feedService.loadFeeds();
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    this.addDisabled = false;
  }

  onDelete(f: Feed): void {
    this.deleteRequested.emit(f);
  }

  async refreshFeed(f: Feed, btn: HTMLButtonElement): Promise<void> {
    btn.textContent = '⏳';
    try {
      const res = await this.feedService.refreshFeed(f.id);
      this.toastService.show(res.articleCount ? `Pulled ${res.articleCount} new articles` : 'No new articles');
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    btn.textContent = '↻';
  }

  async refreshAll(): Promise<void> {
    this.refreshAllDisabled = true;
    try {
      const res = await this.feedService.refreshAll();
      this.toastService.show(res?.articleCount ? `Pulled ${res.articleCount} new articles` : 'No new articles');
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    this.refreshAllDisabled = false;
  }
}
