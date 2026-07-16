import { Component, inject, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FeedService } from '../../services/feed.service';
import { ArticleService } from '../../services/article.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { UiService } from '../../services/ui.service';
import { PlaylistService } from '../../services/playlist.service';
import { LocaleService } from '../../services/locale.service';
import { Feed } from '../../models/feed';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  readonly feedService = inject(FeedService);
  readonly articleService = inject(ArticleService);
  readonly authService = inject(AuthService);
  readonly toastService = inject(ToastService);
  readonly uiService = inject(UiService);
  readonly playlistService = inject(PlaylistService);
  readonly localeService = inject(LocaleService);

  @Output() deleteRequested = new EventEmitter<Feed>();

  activeTab = signal<'feeds' | 'playlists'>('feeds');
  refreshAllDisabled = false;
  addDisabled = false;
  guestLimitModal = signal(false);
  guestModalType = signal<'feed' | 'star' | 'playlist'>('feed');
  url = '';
  newPlaylistName = '';

  settingsOpen = signal(false);
  settingsMode = signal<'feed' | 'playlist'>('feed');
  settingsId = signal('');
  editTitle = signal('');
  editUrl = signal('');
  editColor = signal<string | null>(null);
  editEmoji = signal('📁');
  addFeedDropdownOpen = signal(false);
  playlistFeeds = signal<Feed[]>([]);
  availableFeeds = signal<Feed[]>([]);
  refreshingFeedIds = signal<Set<string>>(new Set());
  refreshingPlaylistIds = signal<Set<string>>(new Set());

  readonly FEED_COLORS = ['#FF6B47', '#F3722C', '#F9C74F', '#90BE6D', '#0F7A6C', '#277DA1', '#577590', '#F94144'];
  readonly PLAYLIST_EMOJIS = ['📁', '📰', '🎯', '💡', '🔥', '⭐', '🏷️'];

  readonly HUES = [8, 24, 40, 160, 172, 190, 204, 340];
  stationColor(id: string, customColor?: string | null): string {
    if (customColor) return customColor;
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${this.HUES[h % this.HUES.length]} 72% 52%)`;
  }

  isFeedSelected(f: Feed): boolean {
    if (this.feedService.allMode()) return false;
    return this.feedService.selectedIds().has(f.id);
  }

  ngOnInit(): void {
    if (!this.authService.isGuest()) {
      this.playlistService.load();
    }
  }

  selectAllFeeds(): void {
    this.feedService.allMode.set(true);
    this.feedService.selectedIds.set(new Set());
    this.articleService.loadArticles(true, null);
  }

  async selectFeed(f: Feed): Promise<void> {
    this.feedService.toggleFeed(f.id);
    const feedIdsParam = this.feedService.getSelectedIdsParam();
    await this.articleService.loadArticles(true, feedIdsParam);

    const singleSelected = !this.feedService.allMode()
      && this.feedService.selectedIds().size === 1
      && this.feedService.selectedIds().has(f.id);
    const noFilterActive = !this.articleService.searchQuery()
      && !this.articleService.dateFrom()
      && !this.articleService.dateTo()
      && !this.articleService.starredOnly();

    // First-time selection can be empty if feed was just added and not refreshed yet.
    if (singleSelected && noFilterActive && this.articleService.articles().length === 0) {
      try {
        await this.feedService.refreshFeed(f.id);
        this.articleService.invalidateCache(f.id);
        await this.articleService.loadArticles(true, feedIdsParam);
      } catch {
        // Keep silent; selection still succeeds even if refresh fails.
      }
    }
  }

  async selectPlaylist(id: string): Promise<void> {
    if (this.playlistService.selectedId() === id) {
      this.playlistService.select(null);
      this.articleService.articles.set([]);
      this.articleService.totalCount.set(0);
      return;
    }
    this.playlistService.select(id);
    const feeds = await firstValueFrom(
      this.http.get<Feed[]>(`/playlists/${id}/feeds`)
    );
    const ids = feeds.map(f => f.id).join(',') || null;
    await this.articleService.loadArticles(true, ids);
  }

  // --- Feeds ---
  async addFeed(): Promise<void> {
    const u = this.url.trim();
    if (!u) return;
    this.addDisabled = true;
    try {
      await this.feedService.addFeed(u);
      this.url = '';
      await this.feedService.loadFeeds();
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
      this.toastService.show(this.localeService.t('toast.feedAdded'));
    } catch (err: any) {
      if (err?.error?.error === 'GUEST_FEED_LIMIT') {
        this.guestModalType.set('feed');
        this.guestLimitModal.set(true);
      } else {
        this.toastService.show(err.message || err.error?.error, 'error');
      }
    }
    this.addDisabled = false;
  }

  goToRegister(): void {
    this.router.navigate(['/register'], { queryParams: { convert: true } });
  }

  onPlaylistTabLocked(): void {
    this.guestModalType.set('playlist');
    this.guestLimitModal.set(true);
  }

  async refreshFeed(f: Feed): Promise<void> {
    if (this.refreshingFeedIds().has(f.id)) return;
    this.refreshingFeedIds.update(s => { s.add(f.id); return new Set(s); });
    try {
      const res = await this.feedService.refreshFeed(f.id);
      this.toastService.show(res.articleCount ? this.localeService.t('toast.pulledArticles', { count: res.articleCount }) : this.localeService.t('toast.noNewArticles'));
      this.articleService.invalidateCache(f.id);
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    finally {
      this.refreshingFeedIds.update(s => { s.delete(f.id); return new Set(s); });
    }
  }

  openFeedSettings(f: Feed): void {
    this.settingsMode.set('feed');
    this.settingsId.set(f.id);
    this.editTitle.set(f.title || '');
    this.editUrl.set(f.url);
    this.editColor.set(f.color ?? null);
    this.settingsOpen.set(true);
  }

  async saveFeedSettings(): Promise<void> {
    try {
      await this.feedService.updateFeed(this.settingsId(), this.editTitle().trim(), this.editUrl().trim(), this.editColor());
      this.settingsOpen.set(false);
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  // --- Playlists ---
  async createPlaylist(): Promise<void> {
    const name = this.newPlaylistName.trim();
    if (!name) return;
    try {
      await this.playlistService.create(name);
      this.newPlaylistName = '';
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  openPlaylistSettings(p: any): void {
    this.settingsMode.set('playlist');
    this.settingsId.set(p.id);
    this.editTitle.set(p.name);
    this.editEmoji.set(p.emoji || '📁');
    this.addFeedDropdownOpen.set(false);
    this.loadPlaylistDetail(p.id);
    this.settingsOpen.set(true);
  }

  async loadPlaylistDetail(id: string): Promise<void> {
    try {
      const [inPlaylist, allFeeds] = await Promise.all([
        firstValueFrom(this.http.get<Feed[]>(`/playlists/${id}/feeds`)),
        Promise.resolve(this.feedService.feeds()),
      ]);
      this.playlistFeeds.set(inPlaylist);
      const inIds = new Set(inPlaylist.map(f => f.id));
      this.availableFeeds.set(allFeeds.filter(f => !inIds.has(f.id)));
    } catch { }
  }

  async savePlaylistSettings(): Promise<void> {
    try {
      await this.playlistService.rename(this.settingsId(), this.editTitle().trim(), this.editEmoji());
      this.settingsOpen.set(false);
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  async addFeedToPlaylist(feedId: string): Promise<void> {
    try {
      await this.playlistService.addFeed(this.settingsId(), feedId);
      await this.loadPlaylistDetail(this.settingsId());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  async removeFeedFromPlaylist(feedId: string): Promise<void> {
    try {
      await this.playlistService.removeFeed(this.settingsId(), feedId);
      await this.loadPlaylistDetail(this.settingsId());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  async refreshPlaylist(id: string): Promise<void> {
    if (this.refreshingPlaylistIds().has(id)) return;
    this.refreshingPlaylistIds.update(s => { s.add(id); return new Set(s); });
    try {
      const res = await this.playlistService.refresh(id);
      let msg = res.articleCount ? this.localeService.t('toast.pulledArticles', { count: res.articleCount }) : this.localeService.t('toast.noNewArticles');
      if (res?.failed?.length) msg += this.localeService.t('toast.feedsFailed', { count: res.failed.length });
      this.toastService.show(msg, res?.failed?.length ? 'error' : 'success');
      // Invalidate cache and reload with the playlist's feed IDs
      this.articleService.invalidateCache();
      const feeds = await firstValueFrom(this.http.get<Feed[]>(`/playlists/${id}/feeds`));
      const ids = feeds.map(f => f.id).join(',') || null;
      await this.articleService.loadArticles(true, ids);
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    finally {
      this.refreshingPlaylistIds.update(s => { s.delete(id); return new Set(s); });
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    try {
      await this.playlistService.remove(id);
      this.settingsOpen.set(false);
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  // --- Refresh All ---
  async refreshAll(): Promise<void> {
    this.refreshAllDisabled = true;
    try {
      const res = await this.feedService.refreshAll();
      let msg = res?.articleCount ? this.localeService.t('toast.pulledArticles', { count: res.articleCount }) : this.localeService.t('toast.noNewArticles');
      if (res?.failed?.length) msg += this.localeService.t('toast.feedsFailed', { count: res.failed.length });
      this.toastService.show(msg, res?.failed?.length ? 'error' : 'success');
      this.articleService.invalidateCache();
      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
    this.refreshAllDisabled = false;
  }

  // --- Star + Email Popup ---
  showEmailPopup = signal(false);
  emailPopupMode = signal<'feed' | 'playlist'>('feed');
  emailPopupId = signal('');
  playlistStarred = signal<Map<string, boolean>>(new Map());

  async onStarFeed(f: Feed): Promise<void> {
    if (this.authService.isGuest()) {
      this.guestModalType.set('star');
      this.guestLimitModal.set(true);
      return;
    }
    try {
      const res = await this.feedService.starFeed(f.id);
      if (res.starred && !f.emailNotifications) {
        this.emailPopupId.set(f.id);
        this.emailPopupMode.set('feed');
        this.showEmailPopup.set(true);
      }
    } catch (err: any) { this.toastService.show(err.message, 'error'); }
  }

  async onStarPlaylist(p: any): Promise<void> {
    const res = await this.playlistService.starPlaylist(p.id);
    this.playlistStarred.update(m => { m.set(p.id, res.starred); return new Map(m); });
    if (res.starred && res.starCount > 0) {
      this.emailPopupId.set(p.id);
      this.emailPopupMode.set('playlist');
      this.showEmailPopup.set(true);
    }
  }

  async enableEmailNotifications(): Promise<void> {
    if (this.emailPopupMode() === 'feed') {
      await this.feedService.toggleEmailNotifications(this.emailPopupId());
    } else {
      await this.playlistService.toggleEmailNotifications(this.emailPopupId());
    }
    this.showEmailPopup.set(false);
  }

  closeEmailPopup(): void {
    this.showEmailPopup.set(false);
  }
}
