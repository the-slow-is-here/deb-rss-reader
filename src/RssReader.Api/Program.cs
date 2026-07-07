using RssReader.Api.Models;
using RssReader.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<StorageService>();
builder.Services.AddSingleton<FeedService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/feeds", async (StorageService store) =>
{
    var feeds = await store.GetFeedsAsync();
    return Results.Ok(feeds);
});

app.MapPost("/feeds", async (string url, FeedService feedService) =>
{
    try
    {
        var feed = await feedService.AddFeedAsync(url);
        return Results.Created($"/feeds/{feed.Id}", feed);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapDelete("/feeds/{id}", async (string id, StorageService store) =>
{
    await store.RemoveFeedAsync(id);
    return Results.NoContent();
});

app.MapPost("/feeds/{id}/refresh", async (string id, FeedService feedService) =>
{
    try
    {
        await feedService.RefreshFeedAsync(id);
        return Results.Ok(new { message = "Feed refreshed" });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.MapGet("/articles", async (int? page, int? pageSize, StorageService store) =>
{
    var p = page ?? 1;
    var ps = pageSize ?? 20;
    var articles = await store.GetArticlesAsync(p, ps);
    return Results.Ok(articles);
});

app.Run();
