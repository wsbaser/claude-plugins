using System;
using System.Collections.Generic;
using System.Linq;

namespace Estimates.Api.Domain;

public class Estimate
{
    public Guid Id { get; set; }

    public string Number { get; set; } = "";

    public Guid CustomerId { get; set; }

    public List<EstimateLine> Lines { get; set; } = new();

    // Stored so lists and reports can sort and filter by it without loading the lines.
    public decimal Total { get; set; }

    public DateTime UpdatedAt { get; set; }

    public void RecalculateTotal() => Total = Lines.Sum(l => l.Quantity * l.UnitPrice);
}

public class EstimateLine
{
    public Guid Id { get; set; }
    public Guid EstimateId { get; set; }
    public string Description { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
