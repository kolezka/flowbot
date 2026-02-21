"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, Product } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, Package, DollarSign, Box, CheckCircle, XCircle } from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProduct(productId);
      setProduct(data);
    } catch (err: any) {
      setError(err.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteProduct(productId);
      router.push("/dashboard/products");
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading product...</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error || "Product not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          {product.sku && (
            <p className="text-muted-foreground">SKU: {product.sku}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/products/${product.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {showDeleteDialog && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Confirm Delete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete &quot;{product.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Product"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Name" value={product.name} />
            <InfoRow label="SKU" value={product.sku || "Not set"} />
            <InfoRow
              label="Category"
              value={product.category?.name || "Not assigned"}
            />
            <InfoRow
              label="Status"
              value={
                <Badge variant={product.isActive ? "default" : "secondary"}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Price"
              value={
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  ${product.price.toFixed(2)}
                </span>
              }
            />
            {product.compareAtPrice && (
              <InfoRow
                label="Compare at Price"
                value={
                  <span className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    ${product.compareAtPrice.toFixed(2)}
                  </span>
                }
              />
            )}
            <InfoRow
              label="Stock Status"
              value={
                <span className="flex items-center gap-2">
                  {product.stock > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {product.stock > 0 ? "In Stock" : "Out of Stock"}
                </span>
              }
            />
            <InfoRow
              label="Stock Quantity"
              value={
                <span className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  {product.stock} units
                </span>
              }
            />
          </CardContent>
        </Card>
      </div>

      {product.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{product.description}</p>
          </CardContent>
        </Card>
      )}

      {product.images && product.images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {product.images.map((image, index) => (
                <div key={index} className="aspect-square overflow-hidden rounded-lg border">
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Technical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Product ID" value={product.id} />
          <InfoRow label="Slug" value={product.slug} />
          <InfoRow
            label="Featured"
            value={
              product.isFeatured ? (
                <Badge variant="default">Yes</Badge>
              ) : (
                <Badge variant="secondary">No</Badge>
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
