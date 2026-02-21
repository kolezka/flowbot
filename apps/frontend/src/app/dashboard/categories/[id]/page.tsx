"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api, Category } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, FolderTree, Package } from "lucide-react";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.id as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCategory();
  }, [categoryId]);

  const loadCategory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategory(categoryId);
      setCategory(data);
    } catch (err: any) {
      setError(err.message || "Failed to load category");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteCategory(categoryId);
      router.push("/dashboard/categories");
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
      setDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    const hasProducts = (category?.productCount || 0) > 0;
    const hasChildren = category?.children && category.children.length > 0;

    if (hasProducts || hasChildren) {
      setError(`Cannot delete category because it ${hasProducts ? "has products" : ""}${hasChildren ? "has subcategories" : ""}`);
      return;
    }

    setDeleteDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading category...</div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/categories">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Category not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/categories">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="text-muted-foreground">Category details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/categories/${category.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={confirmDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Info */}
        <Card>
          <CardHeader>
            <CardTitle>Category Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Name</div>
              <div className="font-medium">{category.name}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Slug</div>
              <div className="font-mono text-sm">/{category.slug}</div>
            </div>

            {category.description && (
              <div>
                <div className="text-sm text-muted-foreground">Description</div>
                <div>{category.description}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge variant={category.isActive ? "default" : "secondary"}>
                {category.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Sort Order</div>
              <div>{category.sortOrder}</div>
            </div>
          </CardContent>
        </Card>

        {/* Relationships */}
        <Card>
          <CardHeader>
            <CardTitle>Relationships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.parent ? (
              <div>
                <div className="text-sm text-muted-foreground mb-2">Parent Category</div>
                <Link
                  href={`/dashboard/categories/${category.parent.id}`}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <FolderTree className="h-4 w-4 text-primary" />
                  <span className="font-medium">{category.parent.name}</span>
                </Link>
              </div>
            ) : (
              <div>
                <div className="text-sm text-muted-foreground">Parent Category</div>
                <div className="text-muted-foreground">None (Root category)</div>
              </div>
            )}

            {category.children && category.children.length > 0 ? (
              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Subcategories ({category.children.length})
                </div>
                <div className="space-y-1">
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/dashboard/categories/${child.id}`}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <FolderTree className="h-4 w-4 text-primary" />
                      <span className="font-medium">{child.name}</span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {child.productCount || 0}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm text-muted-foreground">Subcategories</div>
                <div className="text-muted-foreground">None</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-md bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{category.productCount || 0}</div>
                <div className="text-sm text-muted-foreground">Products</div>
              </div>
            </div>

            {category.children && category.children.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-md bg-primary/10">
                  <FolderTree className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{category.children.length}</div>
                  <div className="text-sm text-muted-foreground">Subcategories</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">ID</div>
              <div className="font-mono text-xs">{category.id}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div>{new Date(category.createdAt).toLocaleString()}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div>{new Date(category.updatedAt).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <DialogContent
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
      >
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{category.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setDeleteDialog(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  );
}
