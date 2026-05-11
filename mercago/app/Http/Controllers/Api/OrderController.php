<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    /**
     * GET /api/shop
     * Returns all products from all vendors, grouped by vendor.
     * Accessible by shoppers.
     */
    public function shop()
    {
        $vendors = User::where('role', 'vendor')
            ->with(['products' => function ($q) {
                $q->where('stock_qty', '>', 0)
                  ->with('reviews.user')
                  ->latest();
            }, 'vendorReviews.user'])
            ->get()
            ->map(function ($vendor) {
                return [
                    'vendor_id'   => $vendor->id,
                    'vendor_name' => "{$vendor->first_name} {$vendor->last_name}",
                    'banner_url'  => $vendor->banner_url,
                    'vendor_rating' => round((float) $vendor->vendorReviews->avg('rating'), 1),
                    'vendor_reviews' => $vendor->vendorReviews,
                    'products'    => $vendor->products->map(function($product) {
                        $productArray = $product->toArray();
                        $productArray['avg_rating'] = round((float) $product->reviews->avg('rating'), 1);
                        return $productArray;
                    })->values(),
                ];
            })
            ->filter(fn($v) => $v['products']->isNotEmpty() || !empty($v['banner_url']))
            ->values();

        return response()->json($vendors);
    }

    /**
     * POST /api/orders
     * Shopper places an order. Deducts stock and records history.
     *
     * Body: { items: [{ product_id, quantity }] }
     */
    public function store(Request $request)
    {
        $request->validate([
            'items'             => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'items.*.quantity'  => ['required', 'integer', 'min:1'],
        ]);

        // Group cart items by vendor so we create one Order per vendor
        $productIds = collect($request->items)->pluck('product_id');
        $products   = Product::whereIn('id', $productIds)->with('vendor')->get()->keyBy('id');

        // Validate stock first before touching anything
        foreach ($request->items as $item) {
            $product = $products->get($item['product_id']);
            if (!$product) {
                return response()->json(['message' => "Product not found."], 404);
            }
            if ($product->stock_qty < $item['quantity']) {
                return response()->json([
                    'message' => "Insufficient stock for \"{$product->product_name}\". Only {$product->stock_qty} left.",
                ], 422);
            }
        }

        // Group cart items by vendor_id
        $groupedByVendor = collect($request->items)->groupBy(function ($item) use ($products) {
            return $products->get($item['product_id'])->vendor_id;
        });

        $createdOrders = [];

        DB::transaction(function () use ($request, $products, $groupedByVendor, &$createdOrders) {
            foreach ($groupedByVendor as $vendorId => $vendorItems) {
                $totalAmount = 0;
                $orderItemsData = [];

                foreach ($vendorItems as $item) {
                    $product  = $products->get($item['product_id']);
                    $subtotal = $product->price * $item['quantity'];
                    $totalAmount += $subtotal;

                    $orderItemsData[] = [
                        'product_id'   => $product->id,
                        'product_name' => $product->product_name,
                        'unit_price'   => $product->price,
                        'quantity'     => $item['quantity'],
                        'subtotal'     => $subtotal,
                    ];

                    // Deduct stock
                    $product->decrement('stock_qty', $item['quantity']);
                }

                // Create one Order per vendor
                $order = Order::create([
                    'shopper_id'      => $request->user()->id,
                    'vendor_id'       => $vendorId,
                    'total_amount'    => $totalAmount,
                    'status'          => 'placed',
                    'delivery_status' => 'finding_rider', // Broadcast to riders immediately
                ]);

                foreach ($orderItemsData as $itemData) {
                    OrderItem::create(array_merge($itemData, ['order_id' => $order->id]));
                }

                $createdOrders[] = $order->load('items', 'vendor');
            }
        });

        // Log the activity
        $totalItems = collect($request->items)->sum('quantity');
        \App\Models\ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'place_order',
            'description' => "Shopper placed an order for {$totalItems} items across " . count($groupedByVendor) . " vendor(s)."
        ]);

        return response()->json([
            'message' => 'Order placed successfully!',
            'orders'  => $createdOrders,
        ], 201);
    }

    /**
     * GET /api/orders
     * Returns purchase history for a shopper, or sales history for a vendor.
     */
    public function history(Request $request)
    {
        $user = $request->user();

        if ($user->role === 'shopper') {
            // Shopper sees their own purchase history, grouped by vendor
            $orders = Order::where('shopper_id', $user->id)
                ->with(['vendor', 'items'])
                ->latest()
                ->get()
                ->map(function ($order) {
                    return [
                        'order_id'        => $order->id,
                        'vendor_name'     => "{$order->vendor->first_name} {$order->vendor->last_name}",
                        'total_amount'    => $order->total_amount,
                        'delivery_status' => $order->delivery_status,
                        'status'          => $order->status,
                        'ordered_at'      => $order->created_at->toDateTimeString(),
                        'items'        => $order->items->map(fn($i) => [
                            'product_name' => $i->product_name,
                            'unit_price'   => $i->unit_price,
                            'quantity'     => $i->quantity,
                            'subtotal'     => $i->subtotal,
                        ]),
                    ];
                });

            return response()->json($orders);
        }

        if ($user->role === 'vendor') {
            // Vendor sees who bought from them
            $orders = Order::where('vendor_id', $user->id)
                ->with(['shopper', 'items'])
                ->latest()
                ->get()
                ->map(function ($order) {
                    return [
                        'order_id'        => $order->id,
                        'shopper_name'    => "{$order->shopper->first_name} {$order->shopper->last_name}",
                        'shopper_email'   => $order->shopper->email,
                        'total_amount'    => $order->total_amount,
                        'delivery_status' => $order->delivery_status,
                        'status'          => $order->status,
                        'ordered_at'      => $order->created_at->toDateTimeString(),
                        'items'        => $order->items->map(fn($i) => [
                            'product_name' => $i->product_name,
                            'unit_price'   => $i->unit_price,
                            'quantity'     => $i->quantity,
                            'subtotal'     => $i->subtotal,
                        ]),
                    ];
                });

            return response()->json($orders);
        }

        return response()->json(['message' => 'Unauthorized role.'], 403);
    }

    /**
     * POST /api/orders/{id}/ready
     * Vendor marks the order as ready for pickup.
     * Moves delivery_status from 'found_rider' → 'ongoing'
     * so the rider can now deliver it.
     * Only the vendor who owns this order can call this.
     */
    public function markReady(Request $request, string $id)
    {
        $order = Order::where('id', $id)
            ->where('vendor_id', $request->user()->id)
            ->where('delivery_status', 'found_rider')
            ->firstOrFail();

        $order->update(['delivery_status' => 'ongoing']);

        return response()->json([
            'message' => 'Order marked as ready! The rider will now deliver it.',
            'order_id' => $order->id,
            'delivery_status' => $order->delivery_status,
        ]);
    }
}

