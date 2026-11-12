using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Estimates.Api.Persistence;

// Retries a database save on transient SQL errors (deadlock, timeout).
public sealed class RetryPolicy
{
    private const int MaxAttempts = 3;
    private readonly ILogger<RetryPolicy> _logger;

    public RetryPolicy(ILogger<RetryPolicy> logger) => _logger = logger;

    public async Task ExecuteAsync(Func<CancellationToken, Task> save, Guid estimateId, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await save(ct);
                return;
            }
            catch (SqlException ex) when (IsTransient(ex))
            {
                if (attempt == MaxAttempts)
                {
                    // Third failure: the exception goes to the caller and nothing runs again.
                    _logger.LogError(ex, "Retrying save of estimate {EstimateId}", estimateId);
                    throw;
                }

                _logger.LogWarning(ex, "Save of estimate {EstimateId} failed on attempt {Attempt}; retrying", estimateId, attempt);
                await Task.Delay(TimeSpan.FromMilliseconds(200 * attempt), ct);
            }
        }
    }

    private static bool IsTransient(SqlException ex) => ex.Number is 1205 or -2;
}
