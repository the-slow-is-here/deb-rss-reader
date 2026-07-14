import { Component, inject, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { ArticleService } from '../../services/article.service';
import { UiService } from '../../services/ui.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  readonly themeService = inject(ThemeService);
  readonly articleService = inject(ArticleService);
  readonly uiService = inject(UiService);

  searchQuery = '';
  dateFrom = '';
  dateTo = '';
  filterOpen = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  onSearchInput(): void {
    this.articleService.loading.set(true);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.articleService.searchQuery.set(this.searchQuery.trim());
      this.articleService.page.set(1);
      this.articleService.loadArticles(true, null);
    }, 200);
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

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.filter-wrap')) this.filterOpen = false;
  }
}
