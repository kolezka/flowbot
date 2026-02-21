"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Category } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronRight, ChevronDown, FolderOpen, Edit } from "lucide-react";

type CategoryWithChildren = Category & { children?: CategoryWithChildren[] };

interface CategoryRowProps {
  category: CategoryWithChildren;
  level: number;
  onToggle: (id: string) => void;
  expanded: Set<string>;
}

function CategoryRow({ category, level, onToggle, expanded }: CategoryRowProps) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expanded.has(category.id);
  const indent = level * 24;

  return (
    <>
      <div className="flex items-center gap-3 py-3 px-4 hover:bg-muted/50 transition-colors border-b">
        <div style={{ marginLeft: indent }}>
          {hasChildren ? (
            <button
              onClick={() => onToggle(category.id)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-6" />
          )}
        </div>
        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{category.name}</span>
            <Badge variant={category.isActive ? "default" : "secondary"} className="text-xs">
              {category.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            /{category.slug}
          </div>
        </div>
        <div className="text-sm text-muted-foreground hidden sm:block">
          Order: {category.sortOrder}
        </div>
        <div className="text-sm text-muted-foreground hidden md:block">
          {category.productCount ?? 0} products
        </div>
        <Link href={`/dashboard/categories/${category.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
        <Link href={`/dashboard/categories/${category.id}/edit`}>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      {isExpanded && hasChildren && (
        <>
          {category.children!.map((child) => (
            <CategoryRow
              key={child.id}
              category={child}
              level={level + 1}
              onToggle={onToggle}
              expanded={expanded}
            />
          ))}
        </>
      )}
    </>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategoryTree();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const addIds = (cats: CategoryWithChildren[]) => {
      cats.forEach((cat) => {
        expanded.add(cat.id);
        if (cat.children) {
          addIds(cat.children);
        }
      });
    };
    const newExpanded = new Set<string>();
    addIds(categories as CategoryWithChildren[]);
    setExpanded(newExpanded);
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">
            Manage your product categories
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
          <Link href="/dashboard/categories/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Category
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading categories...</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div className="text-muted-foreground">No categories found</div>
              <Link href="/dashboard/categories/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Category
                </Button>
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 py-2 px-4 bg-muted/50 text-sm font-medium border-b">
                <div className="w-6"></div>
                <div className="flex-1">Name</div>
                <div className="hidden sm:block w-20">Order</div>
                <div className="hidden md:block w-24">Products</div>
                <div className="w-20"></div>
                <div className="w-12"></div>
              </div>
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category as CategoryWithChildren}
                  level={0}
                  onToggle={toggleExpand}
                  expanded={expanded}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
