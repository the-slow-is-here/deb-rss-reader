using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Data;
using RssReader.Api.Models;
using RssReader.Api.Services;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = "wwwroot/browser"
});

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddIdentity<User, IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opts =>
    {
        opts.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = 401;
            return Task.CompletedTask;
        };
        opts.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = 403;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton(sp => new HttpClient());
builder.Services.AddSingleton<FeedService>();
builder.Services.AddSingleton<DigestWorker>();
builder.Services.AddHostedService<DigestWorker>(sp => sp.GetRequiredService<DigestWorker>());

var app = builder.Build();

Directory.CreateDirectory("data");
// "disk I/O error" — starts fresh if the database was corrupted
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        db.Database.Migrate();
    }
    catch
    {
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();
    }
}

await DbSeeder.SeedAsync(app.Services);

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        ctx.Response.StatusCode = 400;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

// --------------- Auth ---------------

app.MapPost("/auth/register", async (string email, string password, UserManager<User> userManager) =>
{
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        return Results.BadRequest(new { error = "Email and password are required." });

    var user = new User { UserName = email, Email = email };
    var result = await userManager.CreateAsync(user, password);
    if (!result.Succeeded)
        return Results.BadRequest(new { error = result.Errors.First().Description });

    await userManager.AddClaimAsync(user, new Claim(ClaimTypes.Email, email));
    return Results.Created("/auth/me", new { email = user.Email });
});

app.MapPost("/auth/login", async (string email, string password, UserManager<User> userManager, SignInManager<User> signIn) =>
{
    var user = await userManager.FindByEmailAsync(email);
    if (user == null)
        return Results.BadRequest(new { error = "Invalid email or password." });

    var result = await signIn.CheckPasswordSignInAsync(user, password, false);
    if (!result.Succeeded)
        return Results.BadRequest(new { error = "Invalid email or password." });

    await signIn.SignInAsync(user, isPersistent: true);
    return Results.Ok(new { email = user.Email });
});

app.MapPost("/auth/logout", async (SignInManager<User> signIn) =>
{
    await signIn.SignOutAsync();
    return Results.Ok(new { message = "Logged out" });
});

app.MapGet("/auth/me", (ClaimsPrincipal user) =>
{
    var email = user.FindFirstValue(ClaimTypes.Email);
    if (email == null) return Results.Unauthorized();
    return Results.Ok(new { email });
});

// --------------- Feeds ---------------

app.MapGet("/feeds", async (AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();
    var feeds = await db.Feeds.Where(f => f.UserId == userId).OrderBy(f => f.AddedAt).ToListAsync();
    return Results.Ok(feeds);
}).RequireAuthorization();

app.MapPost("/feeds", async (string url, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException();
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
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
    if (feed == null) return Results.NotFound();
    db.Articles.RemoveRange(db.Articles.Where(a => a.FeedId == id));
    db.Feeds.Remove(feed);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.MapPost("/feeds/{id}/refresh", async (string id, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
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
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var feeds = await db.Feeds.Where(f => f.UserId == userId).ToListAsync();
    var total = 0;
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
        catch { }
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { message = $"Refreshed {feeds.Count} feeds", articleCount = total });
}).RequireAuthorization();

// --------------- Playlists ---------------

app.MapPost("/playlists", async (string name, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = new Playlist { Name = name, UserId = userId };
    db.Playlists.Add(playlist);
    await db.SaveChangesAsync();
    return Results.Created($"/playlists/{playlist.Id}", playlist);
}).RequireAuthorization();

app.MapGet("/playlists", async (AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlists = await db.Playlists
        .Where(p => p.UserId == userId)
        .Select(p => new { p.Id, p.Name, Emoji = p.Emoji, FeedCount = p.FeedPlaylists.Count })
        .ToListAsync();
    return Results.Ok(playlists);
}).RequireAuthorization();

app.MapPut("/playlists/{id}", async (string id, string name, string? emoji, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    playlist.Name = name;
    if (emoji != null) playlist.Emoji = emoji;
    await db.SaveChangesAsync();
    return Results.Ok(playlist);
}).RequireAuthorization();

app.MapGet("/playlists/{id}/feeds", async (string id, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    var feeds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id)
        .Select(fp => fp.Feed).ToListAsync();
    return Results.Ok(feeds);
}).RequireAuthorization();

app.MapDelete("/playlists/{id}", async (string id, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    db.Playlists.Remove(playlist);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.MapPost("/playlists/{id}/feeds", async (string id, string feedId, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
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
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    var link = await db.FeedPlaylists.FirstOrDefaultAsync(fp => fp.PlaylistId == id && fp.FeedId == feedId);
    if (link == null) return Results.NotFound();
    db.FeedPlaylists.Remove(link);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.MapPost("/feeds/{id}/star", async (string id, AppDbContext db, ClaimsPrincipal user) =>
{
    try
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
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
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
    if (feed == null) return Results.NotFound();
    if (!string.IsNullOrWhiteSpace(req.Title)) feed.Title = req.Title;
    if (!string.IsNullOrWhiteSpace(req.Url)) feed.Url = req.Url;
    feed.Color = req.Color; // null clears it
    await db.SaveChangesAsync();
    return Results.Ok(feed);
}).RequireAuthorization();

app.MapPost("/playlists/{id}/refresh", async (string id, AppDbContext db, FeedService feedService, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    var feedIds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id).Select(fp => fp.FeedId).ToListAsync();
    var total = 0;
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
        catch { }
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { articleCount = total });
}).RequireAuthorization();

// --------------- Articles (with starred filter) ---------------

app.MapGet("/articles", async (AppDbContext db, ClaimsPrincipal user,
    int? page, int? pageSize, string? feedIds, string? q, DateTime? dateFrom, DateTime? dateTo, bool? starred) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
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

app.MapPost("/feeds/{id}/email-notifications", async (string id, AppDbContext db, ClaimsPrincipal user) =>
{
    try
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var feed = await db.Feeds.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (feed == null) return Results.NotFound();
        feed.EmailNotifications = !feed.EmailNotifications;
        await db.SaveChangesAsync();
        return Results.Ok(new { feed.EmailNotifications });
    }
    catch (Exception ex) { return Results.BadRequest(new { error = ex.Message }); }
}).RequireAuthorization();

app.MapPost("/playlists/{id}/star", async (string id, AppDbContext db, ClaimsPrincipal user) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
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
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
    var playlist = await db.Playlists.FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);
    if (playlist == null) return Results.NotFound();
    var feedIds = await db.FeedPlaylists.Where(fp => fp.PlaylistId == id).Select(fp => fp.FeedId).ToListAsync();
    var feeds = await db.Feeds.Where(f => feedIds.Contains(f.Id) && f.UserId == userId).ToListAsync();
    var allEnabled = feeds.All(f => f.EmailNotifications);
    foreach (var f in feeds) f.EmailNotifications = !allEnabled;
    await db.SaveChangesAsync();
    return Results.Ok(new { emailCount = feeds.Count, enabled = !allEnabled });
}).RequireAuthorization();

app.MapPatch("/auth/me", async (UpdateUserRequest req, AppDbContext db, UserManager<User> userManager, ClaimsPrincipal user) =>
{
    var email = user.FindFirstValue(ClaimTypes.Email)!;
    var u = await userManager.FindByEmailAsync(email);
    if (u == null) return Results.NotFound();
    if (req.DigestFrequencyHours.HasValue) u.DigestFrequencyHours = req.DigestFrequencyHours.Value;
    await db.SaveChangesAsync();
    return Results.Ok(new { u.DigestFrequencyHours });
}).RequireAuthorization();

app.MapPost("/auth/test-email", async (AppDbContext db, DigestWorker worker, UserManager<User> userManager, IConfiguration config, ClaimsPrincipal user) =>
{
    var cfgKey = config["SendGrid:ApiKey"];
    var apiKey = string.IsNullOrWhiteSpace(cfgKey) ? Environment.GetEnvironmentVariable("SENDGRID_API_KEY") ?? "" : cfgKey;
    if (string.IsNullOrWhiteSpace(apiKey))
        return Results.BadRequest(new { error = "SendGrid API key not configured." });

    var email = user.FindFirstValue(ClaimTypes.Email)!;
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

app.MapFallbackToFile("index.html");

app.Run();

internal record UpdateFeedRequest(string? Title, string? Url, string? Color);
internal record UpdateUserRequest(int? DigestFrequencyHours);
