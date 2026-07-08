namespace RssReader.Api.Models;
public class Article
{
    public string Id {get; set;} = Guid.NewGuid().ToString();
    public string FeedId {get; set;} = string.Empty;
    public string Title {get; set;} = string.Empty;
    public string Content{get; set;} = string.Empty;
    public string Link {get; set;} = string.Empty;
    public string Author {get; set;} = string.Empty;
    public DateTime PublishedAt {get; set;} = DateTime.UtcNow;
}
