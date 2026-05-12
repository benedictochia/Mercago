<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RiderLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RiderController extends Controller
{
    /**
     * GET /api/rider/orders
     * Returns all orders with status 'finding_rider'
     * that this rider has NOT previously declined.
     */
    public function availableOrders(Request $request)
    {
        $rider = $request->user();
        $outstanding = $this->outstandingBalance($rider->id);
        $maxAbono = (float) $rider->max_abono;

        // Block if rider is already over their cap
        if ($outstanding >= $maxAbono) {
            return response()->json([
                'message'     => "You have reached your Abono limit of ₱" . number_format($maxAbono, 2) . ". Complete pending deliveries to accept new orders.",
                'abono_blocked' => true,
                'outstanding' => $outstanding,
                'max_abono'   => $maxAbono,
                'orders'      => [],
            ]);
        }

        $declinedOrderIds = DB::table('order_declines')
            ->where('rider_id', $rider->id)
            ->pluck('order_id');

        // Only show orders that:
        // 1. Are finding a rider
        // 2. Haven't been declined
        // 3. (Current Balance + Order Total) <= Max Abono Cap
        $orders = Order::where('delivery_status', 'finding_rider')
            ->whereNotIn('id', $declinedOrderIds)
            ->with(['shopper', 'vendor', 'items'])
            ->get()
            ->filter(function($order) use ($outstanding, $maxAbono) {
                // If it's not COD, the rider doesn't need to advance cash
                if ($order->payment_method !== 'cod') return true;
                return ($outstanding + $order->total_amount) <= $maxAbono;
            })
            ->values()
            ->map(fn($order) => $this->formatOrder($order));

        return response()->json($orders);
    }

    /**
     * POST /api/rider/orders/{id}/accept
     * Rider accepts the order → rider is assigned, status → found_rider.
     */
    public function acceptOrder(Request $request, string $id)
    {
        $user = $request->user();
        $order = Order::where('id', $id)->where('delivery_status', 'finding_rider')->firstOrFail();
        
        $outstanding = $this->outstandingBalance($user->id);
        if ($order->payment_method === 'cod') {
            $totalPotentialBalance = $outstanding + $order->total_amount;
            if ($totalPotentialBalance > $user->max_abono) {
                return response()->json([
                    'message' => "This COD order (₱" . number_format($order->total_amount, 2) . ") would put you over your Abono limit. Your current limit is ₱" . number_format($user->max_abono, 2) . ". Please increase your cap in the Abono tab first.",
                    'abono_blocked' => true
                ], 403);
            }
        }

        $updated = DB::table('orders')
            ->where('id', $id)
            ->where('delivery_status', 'finding_rider')
            ->update([
                'rider_id'        => $user->id,
                'delivery_status' => 'found_rider',
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
     * Rider declines → recorded, order stays 'finding_rider' for others.
     */
    public function declineOrder(Request $request, string $id)
    {
        $order = Order::where('id', $id)
            ->where('delivery_status', 'finding_rider')
            ->firstOrFail();

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
     * Rider confirms delivery → status 'completed'.
     * For COD orders: creates a 'collection' ledger entry (rider collected cash).
     */
    public function completeDelivery(Request $request, string $id)
    {
        $order = Order::where('id', $id)
            ->where('rider_id', $request->user()->id)
            ->where('delivery_status', 'ongoing')
            ->firstOrFail();

        $order->update([
            'delivery_status' => 'completed',
            'payment_status'  => $order->payment_method === 'cod' ? 'collected' : 'settled',
        ]);

        // For COD: rider collected cash from shopper — credit the ledger
        if ($order->payment_method === 'cod') {
            RiderLedger::create([
                'rider_id' => $request->user()->id,
                'order_id' => $order->id,
                'type'     => 'collection',
                'amount'   => $order->total_amount,
                'note'     => "COD collected from shopper for order #{$order->id}",
            ]);
        }

        return response()->json([
            'message' => 'Delivery completed! Great job.',
            'order'   => $this->formatOrder($order->fresh(['shopper', 'vendor', 'items'])),
        ]);
    }

    /**
     * GET /api/rider/my-deliveries
     * Returns the rider's active and past deliveries.
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
     * GET /api/rider/ledger
     * Returns the rider's full abono ledger history and current balance.
     */
    public function ledger(Request $request)
    {
        $rider   = $request->user();
        $entries = RiderLedger::where('rider_id', $rider->id)
            ->with('order')
            ->latest()
            ->get()
            ->map(fn($e) => [
                'id'         => $e->id,
                'type'       => $e->type,
                'amount'     => $e->amount,
                'note'       => $e->note,
                'created_at' => $e->created_at->toDateTimeString(),
                'order_id'   => $e->order_id,
            ]);

        $totalAdvances    = RiderLedger::where('rider_id', $rider->id)->where('type', 'advance')->sum('amount');
        $totalCollections = RiderLedger::where('rider_id', $rider->id)->where('type', 'collection')->sum('amount');
        $outstanding      = $totalAdvances - $totalCollections;

        return response()->json([
            'max_abono'         => $rider->max_abono,
            'total_advances'    => $totalAdvances,
            'total_collections' => $totalCollections,
            'outstanding'       => $outstanding,
            'entries'           => $entries,
        ]);
    }

    /**
     * PUT /api/rider/abono-settings
     * Rider updates their own max_abono cap.
     */
    public function updateAbonoSettings(Request $request)
    {
        $request->validate([
            'max_abono' => ['required', 'numeric', 'min:1', 'max:10000'],
        ]);

        $request->user()->update(['max_abono' => $request->max_abono]);

        return response()->json([
            'message'   => 'Abono limit updated successfully.',
            'max_abono' => $request->user()->max_abono,
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Calculate the rider's current outstanding advance balance.
     * Outstanding = total advances − total collections.
     */
    private function outstandingBalance(string $riderId): float
    {
        $advances    = RiderLedger::where('rider_id', $riderId)->where('type', 'advance')->sum('amount');
        $collections = RiderLedger::where('rider_id', $riderId)->where('type', 'collection')->sum('amount');
        return (float) ($advances - $collections);
    }

    /**
     * Shared formatter for order data returned to riders.
     */
    private function formatOrder(Order $order): array
    {
        return [
            'order_id'         => $order->id,
            'delivery_status'  => $order->delivery_status,
            'payment_method'   => $order->payment_method,
            'payment_status'   => $order->payment_status,
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
