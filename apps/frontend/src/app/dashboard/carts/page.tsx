"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Cart, User } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingBag, Trash2, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";

interface CartWithUser extends Cart {
  user?: User;
}

interface CartRowProps {
  cart: CartWithUser;
  onClear: (userId: string) => Promise<void>;
  onRefresh: () => void;
}

function CartRow({ cart, onClear, onRefresh }: CartRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClear(cart.userId);
      onRefresh();
    } catch (err) {
      setClearing(false);
    }
  };

  return (
    <>
      <TableRow className="group transition-colors">
        <TableCell onClick={() => setExpanded(!expanded)} className="cursor-pointer">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="p-1 hover:bg-muted rounded">
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <span className="font-medium">
                {cart.user?.firstName || cart.user?.username || `User ${cart.userId}`}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {cart.user?.username && cart.user?.firstName && `@${cart.user.username}`}
            </div>
            <div className="text-xs text-muted-foreground">
              ID: {cart.userId}
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden sm:table-cell cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <Badge variant="secondary">{cart.totalItems} items</Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell cursor-pointer" onClick={() => setExpanded(!expanded)}>
          ${cart.totalAmount.toFixed(2)}
        </TableCell>
        <TableCell className="hidden sm:table-cell cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {formatDate(cart.updatedAt)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {cart.items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                disabled={clearing}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Link href={`/dashboard/users/${cart.userId}`}>
              <Button variant="ghost" size="sm" className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                View
              </Button>
            </Link>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-4">
            {cart.items.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                This cart is empty
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium">Cart Items ({cart.items.length})</div>
                <div className="space-y-2">
                  {cart.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                      {item.product?.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {item.product?.name || "Unknown Product"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × ${item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        ${(item.quantity * item.price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-2 border-t text-sm">
                  <span className="font-medium">Total</span>
                  <span className="font-bold">${cart.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function CartsPage() {
  const [carts, setCarts] = useState<CartWithUser[]>([]);
  const [totalCarts, setTotalCarts] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadCarts();
  }, [page, search]);

  const loadCarts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAllCarts(page, pageSize);
      setCarts(data.data);
      setTotalCarts(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load carts");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClearCart = async (userId: string) => {
    try {
      await api.clearCart(userId);
      await loadCarts();
    } catch (err: any) {
      throw err;
    }
  };

  const totalPages = Math.ceil(totalCarts / pageSize);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <CardTitle>Shopping Carts</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by user name or ID..."
                className="pl-8"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden sm:table-cell">Items</TableHead>
                  <TableHead className="hidden md:table-cell">Total Amount</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Updated</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : carts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No carts found
                    </TableCell>
                  </TableRow>
                ) : (
                  carts.map((cart) => (
                    <CartRow
                      key={cart.id}
                      cart={cart}
                      onClear={handleClearCart}
                      onRefresh={loadCarts}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCarts)} of {totalCarts} carts
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
