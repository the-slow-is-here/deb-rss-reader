using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using RssReader.Api.Models;
using RssReader.Api.Models.Requests;

namespace RssReader.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/auth/register", async (AuthRequest req, UserManager<User> userManager) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest(new { error = "Email and password are required." });

            if (!req.Email.Contains('@') || !req.Email.Contains('.') || req.Email.EndsWith('.'))
                return Results.BadRequest(new { error = "Please enter a valid email address." });

            var user = new User { UserName = req.Email, Email = req.Email };
            var result = await userManager.CreateAsync(user, req.Password);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description), error = result.Errors.First().Description });

            await userManager.AddClaimAsync(user, new Claim(ClaimTypes.Email, req.Email));
            return Results.Created("/auth/me", new { email = user.Email });
        });

        app.MapPost("/auth/login", async (AuthRequest req, UserManager<User> userManager, SignInManager<User> signIn) =>
        {
            var user = await userManager.FindByEmailAsync(req.Email);
            if (user == null)
                return Results.BadRequest(new { error = "Invalid email or password." });

            var result = await signIn.CheckPasswordSignInAsync(user, req.Password, false);
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
    }
}
