using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using RssReader.Api.Extensions;
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
            return Results.Created("/auth/me", new { email = user.Email, isGuest = false });
        });

        app.MapPost("/auth/login", async (AuthRequest req, UserManager<User> userManager, SignInManager<User> signIn) =>
        {
            var user = await userManager.FindByEmailAsync(req.Email);
            if (user == null)
                return Results.BadRequest(new { error = "Invalid email or password." });

            var result = await signIn.CheckPasswordSignInAsync(user, req.Password, false);
            if (!result.Succeeded)
                return Results.BadRequest(new { error = "Invalid email or password." });

            var claims = new List<Claim>
            {
                new("IsGuest", user.IsGuest ? "true" : "false")
            };
            await signIn.SignInWithClaimsAsync(user, isPersistent: true, claims);
            return Results.Ok(new { email = user.Email, isGuest = user.IsGuest });
        });

        app.MapPost("/auth/guest", async (UserManager<User> userManager, SignInManager<User> signIn) =>
        {
            var guestUser = new User
            {
                UserName = Guid.NewGuid().ToString("N"),
                IsGuest = true,
                GuestCreatedAt = DateTime.UtcNow
            };
            var result = await userManager.CreateAsync(guestUser);
            if (!result.Succeeded)
                return Results.BadRequest(new { error = result.Errors.First().Description });

            var claims = new List<Claim>
            {
                new("IsGuest", "true")
            };
            await signIn.SignInWithClaimsAsync(guestUser, isPersistent: true, claims);
            return Results.Ok(new { email = (string?)null, isGuest = true });
        });

        app.MapPost("/auth/convert", async (AuthRequest req, UserManager<User> userManager, SignInManager<User> signIn, ClaimsPrincipal principal) =>
        {
            var userId = principal.GetUserId();
            var user = await userManager.FindByIdAsync(userId);
            if (user == null || !user.IsGuest)
                return Results.BadRequest(new { error = "This account cannot be converted." });

            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return Results.BadRequest(new { error = "Email and password are required." });

            if (!req.Email.Contains('@') || !req.Email.Contains('.') || req.Email.EndsWith('.'))
                return Results.BadRequest(new { error = "Please enter a valid email address." });

            user.UserName = req.Email;
            user.Email = req.Email;
            user.IsGuest = false;
            user.GuestCreatedAt = null;

            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var passwordResult = await userManager.ResetPasswordAsync(user, token, req.Password);
            if (!passwordResult.Succeeded)
                return Results.BadRequest(new { errors = passwordResult.Errors.Select(e => e.Description), error = passwordResult.Errors.First().Description });

            var result = await userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description), error = result.Errors.First().Description });

            // Update claims in the database
            var existingClaims = await userManager.GetClaimsAsync(user);
            var oldEmailClaim = existingClaims.FirstOrDefault(c => c.Type == ClaimTypes.Email);
            if (oldEmailClaim != null)
                await userManager.RemoveClaimAsync(user, oldEmailClaim);
            await userManager.AddClaimAsync(user, new Claim(ClaimTypes.Email, req.Email));
            await userManager.RemoveClaimAsync(user, new Claim("IsGuest", "true"));
            await userManager.AddClaimAsync(user, new Claim("IsGuest", "false"));

            // Re-issue the auth cookie with updated claims so the user is no longer seen as a guest
            var claims = new List<Claim>
            {
                new(ClaimTypes.Email, req.Email),
                new("IsGuest", "false")
            };
            await signIn.SignInWithClaimsAsync(user, isPersistent: true, claims);

            return Results.Ok(new { email = req.Email, isGuest = false });
        }).RequireAuthorization();

        app.MapPost("/auth/logout", async (SignInManager<User> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.Ok(new { message = "Logged out" });
        });

        app.MapGet("/auth/me", (ClaimsPrincipal user) =>
        {
            var email = user.FindFirstValue(ClaimTypes.Email);
            var isGuest = user.FindFirstValue("IsGuest") == "true";
            if (email == null && !isGuest) return Results.Unauthorized();
            return Results.Ok(new { email = email ?? (string?)null, isGuest });
        });
    }
}
