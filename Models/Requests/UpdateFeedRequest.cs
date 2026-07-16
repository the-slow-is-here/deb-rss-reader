namespace RssReader.Api.Models.Requests;

public record UpdateFeedRequest(string? Title, string? Url, string? Color);
