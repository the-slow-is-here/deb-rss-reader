using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Database;
using RssReader.Api.Extensions;
using RssReader.Api.Models;
using RssReader.Api.Services;

namespace RssReader.Api.Endpoints;

public static class PlaylistEndpoints
{
    public static void MapPlaylistEndpoints(this WebApplication app)
    {
        app.MapPost("/playlists", async (string name, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = new Playlist { Name = name, UserId = userId };
            db.Playlists.Add(playlist);
            await db.SaveChangesAsync();
            return Results.Created($"/playlists/{playlist.Id}", playlist);
        }).RequireAuthorization();

        app.MapGet("/playlists", async (AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlists = await db.Playlists
                .Where(p => p.UserId == userId)
                .Select(p => new { p.Id, p.Name, Emoji = p.Emoji, FeedCount = p.FeedPlaylists.Count })
                .ToListAsync();
            return Results.Ok(playlists);
        }).RequireAuthorization();

        app.MapPut("/playlists/{id}", async (string id, string name, string? emoji, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            playlist.Name = name;
            if (emoji != null) playlist.Emoji = emoji;
            await db.SaveChangesAsync();
            return Results.Ok(playlist);
        }).RequireAuthorization();

        app.MapGet("/playlists/{id}/feeds", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var feeds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id)
                .Select(fp => fp.Feed).ToListAsync();
            return Results.Ok(feeds);
        }).RequireAuthorization();

        app.MapDelete("/playlists/{id}", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            db.Playlists.Remove(playlist);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        app.MapPost("/playlists/{id}/feeds", async (string id, string feedId, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == feedId && f.UserId == userId);
            if (feed == null) return Results.NotFound();
            if (await db.FeedPlaylists.AnyAsync(fp => fp.PlaylistId == id && fp.FeedId == feedId))
                return Results.BadRequest(new { error = "Feed already in playlist" });
            db.FeedPlaylists.Add(new FeedPlaylist { PlaylistId = id, FeedId = feedId });
            await db.SaveChangesAsync();
            return Results.Ok();
        }).RequireAuthorization();

        app.MapDelete("/playlists/{id}/feeds/{feedId}", async (string id, string feedId, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var link = await db.FeedPlaylists.FirstOrDefaultAsync(fp => fp.PlaylistId == id && fp.FeedId == feedId);
            if (link == null) return Results.NotFound();
            db.FeedPlaylists.Remove(link);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        app.MapPost("/playlists/{id}/refresh", async (string id, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var feedIds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id).Select(fp => fp.FeedId).ToListAsync();
            var total = 0;
            var failed = new List<object>();
            foreach (var fid in feedIds)
            {
                var f = await db.Feeds.FindAsync(fid);
                if (f == null) continue;
                try
                {
                    var articles = await feedService.FetchArticlesAsync(f.Url);
                    foreach (var a in articles)
                    {
                        a.FeedId = fid;
                        if (!await db.Articles.AnyAsync(x => x.Link == a.Link))
                        { db.Articles.Add(a); total++; }
                    }
                }
                catch (Exception ex) { failed.Add(new { f!.Id, f.Title, error = ex.Message }); }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { articleCount = total, failed });
        }).RequireAuthorization();

        app.MapPost("/playlists/{id}/star", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var feedIds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id).Select(fp => fp.FeedId).ToListAsync();
            var feeds = await db.Feeds.Where(f => feedIds.Contains(f.Id) && f.UserId == userId).ToListAsync();
            var allStarred = feeds.All(f => f.Starred);
            foreach (var f in feeds) f.Starred = !allStarred;
            await db.SaveChangesAsync();
            return Results.Ok(new { starCount = feeds.Count, starred = !allStarred });
        }).RequireAuthorization();

        app.MapPost("/playlists/{id}/email-notifications", async (string id, AppDbContext db, ClaimsPrincipal user) =>
        {
            var userId = user.GetUserId();
            var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
            if (playlist == null) return Results.NotFound();
            var feedIds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id).Select(fp => fp.FeedId).ToListAsync();
            var feeds = await db.Feeds.Where(f => feedIds.Contains(f.Id) && f.UserId == userId).ToListAsync();
            var allEnabled = feeds.All(f => f.EmailNotifications);
            foreach (var f in feeds) f.EmailNotifications = !allEnabled;
            await db.SaveChangesAsync();
            return Results.Ok(new { emailCount = feeds.Count, enabled = !allEnabled });
        }).RequireAuthorization();
    }
}
