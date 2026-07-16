using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using RssReader.Api.Database;
using RssReader.Api.Endpoints;
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
builder.Services.Configure<ForwardedHeadersOptions>(opts =>
{
    opts.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});
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
app.UseForwardedHeaders();
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

// ── Endpoints ──────────────────────────────────────────────
app.MapAuthEndpoints();
app.MapFeedEndpoints();
app.MapArticleEndpoints();
app.MapPlaylistEndpoints();
app.MapDigestEndpoints();

app.MapFallbackToFile("index.html");

app.Run();

