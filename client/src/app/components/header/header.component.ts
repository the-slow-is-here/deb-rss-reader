import { Component, inject, HostListener, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../services/theme.service';
import { ArticleService } from '../../services/article.service';
import { AuthService } from '../../services/auth.service';
import { FeedService } from '../../services/feed.service';
import { UiService } from '../../services/ui.service';
import { ToastService } from '../../services/toast.service';
import { ModalComponent } from '../modal/modal.component';
import { Feed } from '../../models/feed';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private http = inject(HttpClient);
  readonly themeService = inject(ThemeService);
  readonly articleService = inject(ArticleService);
  readonly authService = inject(AuthService);
  readonly uiService = inject(UiService);
  readonly feedService = inject(FeedService);
  readonly toastService = inject(ToastService);

  logoutConfirm = signal(false);
  settingsOpen = signal(false);
  digestFrequency = 24;
  emailFeeds = signal<Feed[]>([]);

  searchQuery = '';
  dateFrom = '';
  dateTo = '';
  filterOpen = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  openSettings(): void {
    this.digestFrequency = 24;
    this.emailFeeds.set(this.feedService.feeds());
    this.settingsOpen.set(true);
  }

  onSearchInput(): void {
    this.articleService.loading.set(true);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.articleService.searchQuery.set(this.searchQuery.trim());
      this.articleService.page.set(1);
      this.articleService.loadArticles(true, null);
    }, 200);
  }

  toggleStarred(): void {
    this.articleService.starredOnly.update(v => !v);
    this.articleService.page.set(1);
    this.articleService.loadArticles(true, null);
  }

  toggleFilter(): void { this.filterOpen = !this.filterOpen; }

  applyFilter(): void {
    this.articleService.dateFrom.set(this.dateFrom);
    this.articleService.dateTo.set(this.dateTo);
    this.filterOpen = false;
    this.articleService.page.set(1);
    this.articleService.loadArticles(true, null);
  }

  clearFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.articleService.dateFrom.set('');
    this.articleService.dateTo.set('');
    this.filterOpen = false;
    this.articleService.page.set(1);
    this.articleService.loadArticles(true, null);
  }

  async toggleFeedEmail(f: Feed): Promise<void> {
    try {
      await this.feedService.toggleEmailNotifications(f.id);
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  async saveDigestSettings(): Promise<void> {
    await firstValueFrom(this.http.patch('/auth/me', { digestFrequencyHours: this.digestFrequency }));
    this.settingsOpen.set(false);
  }

  async sendTestEmail(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ sent: boolean }>('/auth/test-email', null));
      this.toastService.show(res.sent ? 'Test email sent!' : 'Failed to send');
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.filter-wrap')) this.filterOpen = false;
  }
}
