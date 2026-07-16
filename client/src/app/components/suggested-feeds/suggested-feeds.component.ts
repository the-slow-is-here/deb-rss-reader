import { Component, inject, signal } from '@angular/core';
import { FeedService } from '../../services/feed.service';
import { ArticleService } from '../../services/article.service';
import { ToastService } from '../../services/toast.service';
import { LocaleService } from '../../services/locale.service';

interface SuggestedFeed {
  title: string;
  url: string;
  emoji: string;
  description: string;
}

const SUGGESTIONS: SuggestedFeed[] = [
  { title: 'Hacker News', url: 'https://hnrss.org/frontpage', emoji: '💻', description: 'Tech news & startup discussion' },
  { title: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', emoji: '🌍', description: 'International news from BBC' },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', emoji: '📱', description: 'Technology & gadget reviews' },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', emoji: '🔬', description: 'In-depth tech & science reporting' },
  { title: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', emoji: '🎨', description: 'Web design & front-end tips' },
  { title: 'Smashing Mag', url: 'https://www.smashingmagazine.com/feed/', emoji: '⚡', description: 'UX, design & web development' },
];

@Component({
  selector: 'app-suggested-feeds',
  standalone: true,
  templateUrl: './suggested-feeds.component.html',
  styleUrls: ['./suggested-feeds.component.css']
})
export class SuggestedFeedsComponent {
  readonly feedService = inject(FeedService);
  readonly articleService = inject(ArticleService);
  readonly toastService = inject(ToastService);
  readonly localeService = inject(LocaleService);

  suggestions = signal<SuggestedFeed[]>(
    SUGGESTIONS.filter(s => !this.feedService.feeds().some(f => f.url === s.url))
  );
  addingUrl = signal<string | null>(null);

  private normalizeUrl(url: string): string {
    return url.trim().replace(/\/+$/, '').toLowerCase();
  }

  async add(url: string): Promise<void> {
    this.addingUrl.set(url);
    try {
      await this.feedService.addFeed(url);
      await this.feedService.loadFeeds();

      // Auto-select and refresh the new feed so first click/read works immediately.
      const target = this.feedService.feeds().find(f => this.normalizeUrl(f.url) === this.normalizeUrl(url));
      if (target) {
        this.feedService.allMode.set(false);
        this.feedService.selectedIds.set(new Set([target.id]));
        try {
          await this.feedService.refreshFeed(target.id);
          this.articleService.invalidateCache(target.id);
        } catch {
          // Keep going even if remote refresh fails; existing stored articles may still load.
        }
      }

      await this.articleService.loadArticles(true, this.feedService.getSelectedIdsParam());
      this.suggestions.update(arr => arr.filter(s => s.url !== url));
    } catch (err: any) {
      this.toastService.show(err.message || err.error?.error, 'error');
    }
    this.addingUrl.set(null);
  }
}
