using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Database;
using RssReader.Api.Extensions;
using RssReader.Api.Models;
using RssReader.Api.Models.Requests;
using RssReader.Api.Services;

namespace RssReader.Api.Endpoints;

public static class DigestEndpoints
{
    public static void MapDigestEndpoints(this WebApplication app)
    {
        app.MapPatch("/auth/me", async (UpdateUserRequest req, AppDbContext db, UserManager<User> userManager, ClaimsPrincipal user) =>
        {
            var email = user.GetUserEmail();
            var u = await userManager.FindByEmailAsync(email);
            if (u == null) return Results.NotFound();
            if (req.DigestFrequencyHours.HasValue) u.DigestFrequencyHours = req.DigestFrequencyHours.Value;
            await db.SaveChangesAsync();
            return Results.Ok(new { u.DigestFrequencyHours });
        }).RequireAuthorization();

        app.MapPost("/auth/test-email", async (AppDbContext db, DigestWorker worker, UserManager<User> userManager, IConfiguration config, ClaimsPrincipal user) =>
        {
            var apiKey = config["SendGrid:ApiKey"] ?? Environment.GetEnvironmentVariable("SENDGRID_API_KEY") ?? "";
            if (string.IsNullOrWhiteSpace(apiKey))
                return Results.BadRequest(new { error = "SendGrid API key not configured." });

            var email = user.GetUserEmail();
            var u = await userManager.FindByEmailAsync(email);
            if (u == null) return Results.NotFound();

            var feedIds = await db.Feeds.Where(f => f.UserId == u.Id && f.EmailNotifications).Select(f => f.Id).ToListAsync();
            if (feedIds.Count == 0)
                return Results.Ok(new { sent = false, error = "No email-enabled feeds. Enable email notifications on some feeds first." });

            var articleCount = await db.Articles.CountAsync(a => feedIds.Contains(a.FeedId));
            if (articleCount == 0)
                return Results.Ok(new { sent = false, error = "No articles yet. Hit ↻ Refresh All to fetch articles first." });

            try
            {
                await worker.SendTestEmail(u.Id, CancellationToken.None);
                return Results.Ok(new { sent = true, email = u.Email });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        }).RequireAuthorization();
    }
}
