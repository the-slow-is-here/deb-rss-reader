using System.Net.Http.Headers;
using System.Text.Json;
using RssReader.Api.Models;

namespace RssReader.Api.Services;

public class StorageService
{
    private readonly string _filePath = "src/RssReader.Api/data/subscriptions.json";
    private SubscriptionStore _store = new();
    private readonly SemaphoreSlim _lock = new(1,1);

    public StorageService()
    {
        var json = File.ReadAllText(_filePath);
        _store = JsonSerializer.Deserialize<SubscriptionStore>(json) ?? new SubscriptionStore();
    }

    private async Task SaveAsync()
    {
        await _lock.WaitAsync();
        try
        {
            var json = JsonSerializer.Serialize(_store , new JsonSerializerOptions{WriteIndented = true});
            await File.WriteAllTextAsync(_filePath , json);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task AddFeedAsync(Feed feed)
    {
        if(_store.Feeds.Any(f => f.Url.Equals(feed.Url , StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Feed already exists");
        _store.Feeds.Add(feed);
        await SaveAsync();
    }

    public async Task RemoveFeedAsync(string feedId)
    {
        _store.Feeds.RemoveAll(f => f.Id.Equals(feedId));
        _store.Articles.RemoveAll(f => f.Id.Equals(feedId));
        await SaveAsync();
    }

    public async Task RefreshFeed(string feedId)
    {
        // _store.Articles.RemoveAll(a => a.FeedId == feedId);
        // _store.Articles
    }


}