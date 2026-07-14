import { Component, Input, AfterViewInit, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Article } from '../../models/article';
import { Feed } from '../../models/feed';

@Component({
  selector: 'app-article-card',
  standalone: true,
  templateUrl: './article-card.component.html'
})
export class ArticleCardComponent implements AfterViewInit {
  @Input() article!: Article;
  @Input() feeds!: Feed[];
  @Input() stationColorFn!: (id: string) => string;

  collapsed = false;

  constructor(private el: ElementRef, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      const contentEl = this.el.nativeElement.querySelector('.content');
      if (contentEl && contentEl.scrollHeight > 250) {
        this.collapsed = true;
        this.cdr.detectChanges();
      }
    }, 0);
  }

  expand(): void { this.collapsed = false; }

  get feedName(): string {
    const feed = this.feeds.find(f => f.id === this.article.feedId);
    return feed ? (feed.title || feed.url) : '';
  }

  get color(): string {
    const feed = this.feeds.find(f => f.id === this.article.feedId);
    return feed ? this.stationColorFn(feed.id) : 'var(--teal)';
  }

  get date(): string {
    return this.article.publishedAt
      ? new Date(this.article.publishedAt).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : '';
  }

  get safeLink(): string {
    return /^(https?:|\/)/i.test(this.article.link) ? this.article.link : '#';
  }

  escapeHtml(s: string | null | undefined): string {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }
}
