<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RiderController extends Controller
{
    /**
     * GET /api/rider/orders
     * Returns all orders with status 'finding_rider'
     * that this rider has NOT previously declined.
     * Auto-refreshed by the frontend every few seconds (polling).
     */
    public function availableOrders(Request $request)
    {
        $riderId = $request->user()->id;

        // Get IDs of orders this rider already declined
        $declinedOrderIds = DB::table('order_declines')
            ->where('rider_id', $riderId)
            ->pluck('order_id');

        $orders = Order::where('delivery_status', 'finding_rider')
            ->whereNotIn('id', $declinedOrderIds)
            ->with(['shopper', 'vendor', 'items'])
            ->latest()
            ->get()
            ->map(fn($order) => $this->formatOrder($order));

        return response()->json($orders);
    }

    /**
     * POST /api/rider/orders/{id}/accept
     * Rider accepts the order → status becomes 'ongoing', rider is assigned.
     */
    public function acceptOrder(Request $request, string $id)
    {
        $updated = DB::table('orders')
            ->where('id', $id)
            ->where('delivery_status', 'finding_rider')
            ->update([
                'rider_id'        => $request->user()->id,
                'delivery_status' => 'found_rider', // The rider accepted, now heading to vendor
                'updated_at'      => now(),
            ]);

        if (!$updated) {
            return response()->json(['message' => 'Order already accepted by another rider or no longer available.'], 409);
        }

        $order = Order::with(['shopper', 'vendor', 'items'])->find($id);

        return response()->json([
            'message' => 'Order accepted! Head to the vendor.',
            'order'   => $this->formatOrder($order),
        ]);
    }

    /**
     * POST /api/rider/orders/{id}/decline
     * Rider declines the order → records decline, order stays 'finding_rider'
     * for other riders to pick up.
     */
    public function declineOrder(Request $request, string $id)
    {
        $order = Order::where('id', $id)
            ->where('delivery_status', 'finding_rider')
            ->firstOrFail();

        // Record the decline so this rider won't see it again
        DB::table('order_declines')->insertOrIgnore([
            'order_id'   => $order->id,
            'rider_id'   => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Order declined. It will be offered to another rider.']);
    }

    /**
     * POST /api/rider/orders/{id}/complete
     * Rider confirms delivery → status becomes 'completed'.
     * Only the assigned rider can complete it.
     */
    public function completeDelivery(Request $request, string $id)
    {
        $order = Order::where('id', $id)
            ->where('rider_id', $request->user()->id)
            ->where('delivery_status', 'ongoing') // Vendor must have marked ready first
            ->firstOrFail();

        $order->update(['delivery_status' => 'completed']);

        return response()->json([
            'message' => 'Delivery completed! Great job.',
            'order'   => $this->formatOrder($order->fresh(['shopper', 'vendor', 'items'])),
        ]);
    }

    /**
     * GET /api/rider/my-deliveries
     * Returns the rider's active (ongoing) and past (completed) deliveries.
     */
    public function myDeliveries(Request $request)
    {
        $orders = Order::where('rider_id', $request->user()->id)
            ->with(['shopper', 'vendor', 'items'])
            ->latest()
            ->get()
            ->map(fn($order) => $this->formatOrder($order));

        return response()->json($orders);
    }

    /**
     * Shared formatter for order data returned to riders.
     */
    private function formatOrder(Order $order): array
    {
        return [
            'order_id'         => $order->id,
            'delivery_status'  => $order->delivery_status,
            'total_amount'     => $order->total_amount,
            'ordered_at'       => $order->created_at->toDateTimeString(),
            'shopper_name'     => optional($order->shopper)->first_name . ' ' . optional($order->shopper)->last_name,
            'shopper_address'  => optional($order->shopper)->address,
            'vendor_name'      => optional($order->vendor)->first_name . ' ' . optional($order->vendor)->last_name,
            'items'            => $order->items->map(fn($i) => [
                'product_name' => $i->product_name,
                'quantity'     => $i->quantity,
                'subtotal'     => $i->subtotal,
            ]),
        ];
    }
}
