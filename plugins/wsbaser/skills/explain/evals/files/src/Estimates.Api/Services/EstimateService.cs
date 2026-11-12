using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Estimates.Api.Domain;
using Estimates.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Estimates.Api.Services;

public sealed record EstimateLineDto(Guid? Id, string Description, decimal Quantity, decimal UnitPrice);

public sealed record SaveEstimateRequest(IReadOnlyList<EstimateLineDto> Lines);

public sealed record EstimateDto(Guid Id, string Number, decimal Total, IReadOnlyList<EstimateLineDto> Lines);

public sealed class EstimateService
{
    private readonly EstimatesDbContext _db;
    private readonly RetryPolicy _retry;

    public EstimateService(EstimatesDbContext db, RetryPolicy retry)
    {
        _db = db;
        _retry = retry;
    }

    public async Task<EstimateDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var estimate = await _db.Estimates
            .AsNoTracking()
            .Include(e => e.Lines)
            .SingleOrDefaultAsync(e => e.Id == id, ct);

        return estimate is null ? null : ToDto(estimate);
    }

    public async Task<IReadOnlyList<EstimateDto>> ListAsync(Guid customerId, CancellationToken ct)
    {
        var estimates = await _db.Estimates
            .AsNoTracking()
            .Include(e => e.Lines)
            .Where(e => e.CustomerId == customerId)
            .OrderByDescending(e => e.UpdatedAt)
            .ToListAsync(ct);

        return estimates.Select(ToDto).ToList();
    }

    public async Task<EstimateDto> CreateAsync(Guid customerId, string number, CancellationToken ct)
    {
        var estimate = new Estimate
        {
            Id = Guid.NewGuid(),
            Number = number,
            CustomerId = customerId,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Estimates.Add(estimate);
        await _db.SaveChangesAsync(ct);
        return ToDto(estimate);
    }

    // Called by PUT /estimates/{id}. The frontend sends every line it has on screen.
    public async Task<EstimateDto?> SaveAsync(Guid id, SaveEstimateRequest request, CancellationToken ct)
    {
        EstimateDto? result = null;

        await _retry.ExecuteAsync(async token =>
        {
            // Read the estimate as it is in the database at this moment.
            var estimate = await _db.Estimates.Include(e => e.Lines).SingleOrDefaultAsync(e => e.Id == id, token);
            if (estimate is null)
            {
                return;
            }

            // Replace the lines with the ones the frontend sent.
            estimate.Lines.Clear();
            foreach (var line in request.Lines)
            {
                estimate.Lines.Add(new EstimateLine { Id = line.Id ?? Guid.NewGuid(), EstimateId = estimate.Id, Description = line.Description, Quantity = line.Quantity, UnitPrice = line.UnitPrice });
            }

            estimate.RecalculateTotal();
            estimate.UpdatedAt = DateTime.UtcNow;

            // UPDATE ... WHERE Id = @id. Estimate has no concurrency token, so the row is written
            // whatever another request saved since the read above.
            await _db.SaveChangesAsync(token);
            result = ToDto(estimate);
        }, id, ct);

        return result;
    }

    private static EstimateDto ToDto(Estimate e) =>
        new(e.Id, e.Number, e.Total, e.Lines.Select(l => new EstimateLineDto(l.Id, l.Description, l.Quantity, l.UnitPrice)).ToList());
}
