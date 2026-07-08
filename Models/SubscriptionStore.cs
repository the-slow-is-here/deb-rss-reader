namespace RssReader.Api.Models;

public class SubscriptionStore
{
    public List<Feed> Feeds {get; set;} = [];
    public List<Article> Articles {get; set;} = [];
}