"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Product, Category } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveTable, Column } from "@/components/responsive-table";
import { Search, Plus, Edit, Trash2, Image } from "lucide-react";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [page, search, selectedCategory, activeFilter, stockFilter]);

  const loadCategories = async () => {
    try {
      const data = await api.getAllCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const isActive = activeFilter === "all" ? undefined : activeFilter === "active";
      const inStock = stockFilter === "all" ? undefined : stockFilter === "in-stock";
      const categoryId = selectedCategory === "all" ? undefined : selectedCategory;

      const data = await api.getProducts(
        page,
        pageSize,
        search || undefined,
        categoryId,
        isActive,
        inStock
      );
      setProducts(data.data);
      setTotalProducts(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.deleteProduct(id);
      loadProducts();
    } catch (err: any) {
      alert(err.message || "Failed to delete product");
    }
  };

  const productColumns: Column<Product>[] = [
    {
      header: "Image",
      accessor: (product) =>
        product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-10 w-10 rounded object-cover"
          />
        ) : product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <Image className="h-5 w-5 text-muted-foreground" />
          </div>
        ),
      headerClassName: "w-16",
      hideOnMobile: true,
    },
    {
      header: "Name",
      accessor: (product) => (
        <div>
          <div className="font-medium">{product.name}</div>
          <div className="text-sm text-muted-foreground">{product.slug}</div>
        </div>
      ),
    },
    {
      header: "Category",
      accessor: (product) => product.category?.name || "-",
      cellClassName: "text-muted-foreground",
    },
    {
      header: "Price",
      accessor: (product) => (
        <div>
          <div className="font-medium">${product.price.toFixed(2)}</div>
          {product.compareAtPrice && (
            <div className="text-sm text-muted-foreground line-through">
              ${product.compareAtPrice.toFixed(2)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Stock",
      accessor: (product) => (
        <Badge variant={product.stock > 0 ? "default" : "secondary"}>
          {product.stock}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessor: (product) => (
        <div className="flex gap-1 flex-wrap">
          {product.isActive && <Badge variant="default">Active</Badge>}
          {product.isFeatured && <Badge variant="secondary">Featured</Badge>}
          {!product.isActive && <Badge variant="outline">Inactive</Badge>}
        </div>
      ),
    },
    {
      header: "Actions",
      accessor: (product) => (
        <div className="flex justify-end gap-2">
          <Link href={`/dashboard/products/${product.id}`} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
          <Link href={`/dashboard/products/${product.id}/edit`} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleDelete(product.id, e)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      cellClassName: "text-right",
      headerClassName: "text-right",
      hideOnMobile: true,
    },
  ];

  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Products</CardTitle>
            <Link href="/dashboard/products/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name..."
                className="pl-8"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Active Filter */}
            <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            {/* Stock Filter */}
            <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="out-of-stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <ResponsiveTable
            columns={productColumns}
            data={products}
            keyExtractor={(product) => product.id}
            onRowClick={(product) => router.push(`/dashboard/products/${product.id}`)}
            loading={loading}
            emptyMessage="No products found"
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalProducts)} of {totalProducts} products
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = totalPages <= 5
                      ? i + 1
                      : page <= 3
                        ? i + 1
                        : page >= totalPages - 2
                          ? totalPages - 4 + i
                          : page - 2 + i;

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
