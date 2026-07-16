using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Database;
using RssReader.Api.Extensions;
using RssReader.Api.Models.Requests;
using RssReader.Api.Services;

namespace RssReader.Api.Endpoints;

public static class FeedEndpoints
{
    public static void MapFeedEndpoints(this WebApplication app)
    {
        app.MapGet("/feeds", async (AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var feeds = await db.Feeds.Where(f => f.UserId == userId).OrderBy(f => f.AddedAt).ToListAsync();
            return Results.Ok(feeds);
        }).RequireAuthorization();

        app.MapPost("/feeds", async (string url, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            try
            {
                var feed = await feedService.AddFeedAsync(url);
                feed.UserId = userId;
                db.Feeds.Add(feed);
                await db.SaveChangesAsync();
                return Results.Created($"/feeds/{feed.Id}", feed);
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        app.MapDelete("/feeds/{id}", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
            if (feed == null) return Results.NotFound();
            db.Articles.RemoveRange(db.Articles.Where(a => a.FeedId == id));
            db.Feeds.Remove(feed);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        app.MapPost("/feeds/{id}/refresh", async (string id, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
            if (feed == null) return Results.NotFound();
            try
            {
                var articles = await feedService.FetchArticlesAsync(feed.Url);
                var count = 0;
                foreach (var article in articles)
                {
                    article.FeedId = id;
                    var exists = await db.Articles.AnyAsync(a => a.Link == article.Link);
                    if (!exists)
                    {
                        db.Articles.Add(article);
                        count++;
                    }
                }
                await db.SaveChangesAsync();
                return Results.Ok(new { message = "Feed refreshed", articleCount = count });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();

        app.MapPost("/feeds/refresh-all", async (AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var feeds = await db.Feeds.Where(f => f.UserId == userId).ToListAsync();
            var total = 0;
            var failed = new List<object>();
            foreach (var f in feeds)
            {
                try
                {
                    var articles = await feedService.FetchArticlesAsync(f.Url);
                    foreach (var article in articles)
                    {
                        article.FeedId = f.Id;
                        var exists = await db.Articles.AnyAsync(a => a.Link == article.Link);
                        if (!exists) { db.Articles.Add(article); total++; }
                    }
                }
                catch (Exception ex) { failed.Add(new { f.Id, f.Title, error = ex.Message }); }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { message = $"Refreshed {feeds.Count} feeds", articleCount = total, failed });
        }).RequireAuthorization();

        app.MapPost("/feeds/{id}/star", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            try
            {
                var userId = user.GetUserId();
                var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
                if (feed == null) return Results.NotFound();
                feed.Starred = !feed.Starred;
                await db.SaveChangesAsync();
                return Results.Ok(new { feed.Starred });
            }
            catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
        }).RequireAuthorization();

        app.MapPatch("/feeds/{id}", async (string id, UpdateFeedRequest req, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
            if (feed == null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(req.Title)) feed.Title = req.Title;
            if (!string.IsNullOrWhiteSpace(req.Url)) feed.Url = req.Url;
            feed.Color = req.Color;
            await db.SaveChangesAsync();
            return Results.Ok(feed);
        }).RequireAuthorization();

        app.MapPost("/feeds/{id}/email-notifications", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            try
            {
                var userId = user.GetUserId();
                var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
                if (feed == null) return Results.NotFound();
                feed.EmailNotifications = !feed.EmailNotifications;
                await db.SaveChangesAsync();
                return Results.Ok(new { feed.EmailNotifications });
            }
            catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
        }).RequireAuthorization();
    }
}
