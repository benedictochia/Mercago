<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;
use Stripe\Stripe;
use Stripe\PaymentIntent;

class PaymentController extends Controller
{
    /**
     * POST /api/payments/create-intent
     * Creates a Stripe PaymentIntent for an existing order.
     */
    public function createPaymentIntent(Request $request)
    {
        $request->validate([
            'order_id' => ['required', 'uuid', 'exists:orders,id'],
        ]);

        $order = Order::where('id', $request->order_id)
            ->where('shopper_id', $request->user()->id)
            ->firstOrFail();

        // Already paid?
        if ($order->payment_status === 'paid') {
            return response()->json(['message' => 'Order is already paid.'], 400);
        }

        Stripe::setApiKey(config('services.stripe.secret'));

        try {
            // Stripe amounts are in cents (e.g. 500 PHP = 50000)
            $amountInCents = (int) ($order->total_amount * 100);

            $paymentIntent = PaymentIntent::create([
                'amount' => $amountInCents,
                'currency' => 'php',
                'metadata' => [
                    'order_id' => $order->id,
                    'shopper_email' => $request->user()->email,
                ],
                'automatic_payment_methods' => [
                    'enabled' => true,
                ],
            ]);

            return response()->json([
                'clientSecret' => $paymentIntent->client_secret,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/payments/confirm
     * Manually confirm payment status (Frontend fallback).
     * In production, use Webhooks instead!
     */
    public function confirmPayment(Request $request)
    {
        $request->validate([
            'order_id' => ['required', 'uuid', 'exists:orders,id'],
            'payment_intent_id' => ['required', 'string'],
        ]);

        $order = Order::where('id', $request->order_id)
            ->where('shopper_id', $request->user()->id)
            ->firstOrFail();

        // Verify with Stripe
        Stripe::setApiKey(config('services.stripe.secret'));
        $intent = PaymentIntent::retrieve($request->payment_intent_id);

        if ($intent->status === 'succeeded') {
            $order->update([
                'payment_status' => 'paid',
                'status' => 'placed' // Ensure it's active
            ]);

            return response()->json(['message' => 'Payment confirmed successfully!']);
        }

        return response()->json(['message' => 'Payment verification failed.'], 400);
    }
}
