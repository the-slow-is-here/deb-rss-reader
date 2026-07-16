using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Database;
using RssReader.Api.Extensions;

namespace RssReader.Api.Endpoints;

public static class ArticleEndpoints
{
    public static void MapArticleEndpoints(this WebApplication app)
    {
        app.MapGet("/articles", async (AppDbContext db, ClaimsPrincipal user,
            int? page, int? pageSize, string? feedIds, string? q, DateTime? dateFrom, DateTime? dateTo, bool? starred) =>
        {
            var userId = user.GetUserId();
            var p = page ?? 1;
            var ps = pageSize ?? 20;

            var query = db.Articles
                .Include(a => a.Feed)
                .Where(a => a.Feed.UserId == userId)
                .AsQueryable();

            if (starred == true)
                query = query.Where(a => a.Feed.Starred);
            if (!string.IsNullOrEmpty(feedIds))
            {
                var ids = new HashSet<string>(feedIds.Split(',', StringSplitOptions.RemoveEmptyEntries), StringComparer.OrdinalIgnoreCase);
                query = query.Where(a => ids.Contains(a.FeedId));
            }
            if (!string.IsNullOrWhiteSpace(q))
                query = query.Where(a => a.Title.Contains(q) || a.Content.Contains(q));
            if (dateFrom.HasValue)
                query = query.Where(a => a.PublishedAt >= dateFrom.Value);
            if (dateTo.HasValue)
                query = query.Where(a => a.PublishedAt <= dateTo.Value);

            var total = await query.CountAsync();
            var articles = await query
                .OrderByDescending(a => a.PublishedAt)
                .Skip((p - 1) * ps)
                .Take(ps)
                .ToListAsync();

            return Results.Ok(new { articles, totalCount = total });
        }).RequireAuthorization();
    }
}
