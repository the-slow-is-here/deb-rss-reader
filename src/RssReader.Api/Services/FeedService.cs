using CodeHollow.FeedReader;
using Ganss.Xss;
using RssReader.Api.Models;

namespace RssReader.Api.Services;

public class FeedService
{
    private readonly StorageService _store;
    private readonly HttpClient _http;
    private static readonly HtmlSanitizer _sanitizer = new();

    public FeedService(StorageService store, HttpClient http)
    {
        _store = store;
        _http = http;
    }

    public async Task<Models.Feed> AddFeedAsync(string url)
    {
        var feed = await FeedReader.ReadAsync(url);
        var newFeed = new Models.Feed
        {
            Id = Guid.NewGuid().ToString(),
            Title = feed.Title,
            Url = url,
            AddedAt = DateTime.UtcNow
        };
        await _store.AddFeedAsync(newFeed);
        return newFeed;
    }

    public async Task RefreshFeedAsync(string feedId)
    {
        var feed = await _store.GetFeedAsync(feedId)
            ?? throw new InvalidOperationException("Feed not found");

        try
        {
            var xml = await _http.GetStringAsync(feed.Url);
            var parsed = FeedReader.ReadFromString(xml); // this part return exceptions if there are malformed content

            var articles = parsed.Items.Select(item => new Article
            {
                Id = Guid.NewGuid().ToString(),
                FeedId = feedId,
                Title = item.Title ?? "",
                Content = _sanitizer.Sanitize(item.Content ?? item.Description ?? ""),
                Link = item.Link ?? "",
                Author = item.Author ?? "",
                PublishedAt = item.PublishingDate ?? DateTime.UtcNow
            });

            await _store.AddArticlesAsync(articles);
        }
        catch
        {
        }
    }
}
