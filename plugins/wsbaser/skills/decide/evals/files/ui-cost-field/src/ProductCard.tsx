import { Product } from "../model/product";

// Product card on the catalogue screen. Shown to purchasing staff in Iceland and Germany.
export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <dl>
        <dt>SKU</dt>
        <dd>{product.sku}</dd>
        <dt>Supplier</dt>
        <dd>{product.supplierName}</dd>
        <dt>Cost</dt>
        <dd>{product.cost}</dd>
        <dt>In stock</dt>
        <dd>{product.stock}</dd>
      </dl>
    </div>
  );
}

// Sample from the catalogue: { name: "Hex bolt M8 x 40, zinc", sku: "HB-0840-Z",
// supplierName: "Fastenal Europe", cost: 1234.5, currency: "EUR", unit: "box of 100", stock: 37 }
