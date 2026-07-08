namespace RssReader.Api.Models;
public class Feed
{
    public string Id {get; set;} = Guid.NewGuid().ToString();
    public string Title {get; set;} = string.Empty;
    public string Url {get; set;} = string.Empty;
    public DateTime AddedAt {get; set;} = DateTime.UtcNow;
}

