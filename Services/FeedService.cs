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
        /*
         * FIX: Friendly error messages for invalid RSS URLs.
         * Problem: FeedReader or HttpClient throws raw exceptions like
         * "No such host is known" or XML parse errors — those mean nothing
         * to the user staring at a toast.
         * Fix: catch specific exceptions and map to human-readable messages.
         * The frontend toast already displays them.
         */
        try
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
        catch (UriFormatException)
        {
            throw new InvalidOperationException("Please enter a valid URL.");
        }
        catch (HttpRequestException)
        {
            throw new InvalidOperationException("Could not reach the server. Check the URL and try again.");
        }
        catch (System.Xml.XmlException)
        {
            throw new InvalidOperationException("The URL doesn't appear to be a valid RSS or Atom feed.");
        }
        catch (Exception ex) when (ex.Message.Contains("html", StringComparison.OrdinalIgnoreCase))
        {
            // FeedReader throws when the page returns HTML instead of XML
            throw new InvalidOperationException("The URL doesn't appear to be a valid RSS or Atom feed.");
        }
    }

    public async Task<int> RefreshFeedAsync(string feedId)
    {
        var feed = await _store.GetFeedAsync(feedId)
            ?? throw new InvalidOperationException("Feed not found");

        try
        {
            var xml = await _http.GetStringAsync(feed.Url);
            var parsed = FeedReader.ReadFromString(xml);

            var articles = parsed.Items.Select(item => new Article
            {
                Id = Guid.NewGuid().ToString(),
                FeedId = feedId,
                Title = item.Title ?? "",
                Content = _sanitizer.Sanitize(item.Content ?? item.Description ?? ""),
                Link = item.Link ?? "",
                Author = item.Author ?? "",
                PublishedAt = item.PublishingDate ?? DateTime.UtcNow
            }).ToList();

            await _store.AddArticlesAsync(articles);
            return articles.Count;
        }
        catch
        {
            return 0;
        }
    }
}
