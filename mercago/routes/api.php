<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\RiderController;
use App\Http\Controllers\Api\ReviewController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// ── Public (no auth required) ──────────────────────────────────────────────
Route::get('/public/shop', [OrderController::class, 'shop']);
Route::get('/public/debug-env', function () {
    return response()->json([
        'CLOUDINARY_CLOUD_NAME' => env('CLOUDINARY_CLOUD_NAME'),
        'CLOUDINARY_KEY' => env('CLOUDINARY_KEY'),
        'CLOUDINARY_SECRET' => env('CLOUDINARY_SECRET'),
        'config_cloudinary_url' => config('cloudinary.cloud_url')
    ]);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    
    // ── Profile Management ───────────────────────────────────────────────────
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // ── Vendor: manage their own products & profile ────────────────────
    Route::post('/profile/banner', [AuthController::class, 'updateBanner']);
    Route::get('/vendor/reviews', [ReviewController::class, 'vendorReviews']);
    Route::get('/products', [ProductController::class, 'index']);
    Route::post('/products', [ProductController::class, 'store']);
    Route::put('/products/{id}', [ProductController::class, 'update']);
    Route::delete('/products/{id}', [ProductController::class, 'destroy']);

    // ── Shopper: browse shop + place orders + view history ─────────────
    Route::get('/shop', [OrderController::class, 'shop']);
    // Place an order (shopper) + order history (shopper & vendor)
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/history', [OrderController::class, 'history']);
    Route::post('/orders/{id}/ready', [OrderController::class, 'markReady']); // Vendor: mark order ready for pickup

    // ── Rider: see available orders, accept/decline, complete ──────────
    Route::get('/rider/orders', [RiderController::class, 'availableOrders']);
    Route::post('/rider/orders/{id}/accept', [RiderController::class, 'acceptOrder']);
    Route::post('/rider/orders/{id}/decline', [RiderController::class, 'declineOrder']);
    Route::post('/rider/orders/{id}/complete', [RiderController::class, 'completeDelivery']);
    Route::get('/rider/my-deliveries', [RiderController::class, 'myDeliveries']);
});
