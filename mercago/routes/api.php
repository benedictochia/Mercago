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

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    
    // ── Profile Management (All Authenticated Users) ─────────────────────────
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // ── Vendor Routes ────────────────────────────────────────────────────────
    Route::middleware('role:vendor')->group(function () {
        Route::get('/reports/activity', [\App\Http\Controllers\Api\ReportController::class, 'getActivityLogs']);
        Route::post('/profile/banner', [AuthController::class, 'updateBanner']);
        Route::get('/vendor/reviews', [ReviewController::class, 'vendorReviews']);
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::post('/orders/{id}/ready', [OrderController::class, 'markReady']); // Vendor: mark order ready for pickup
    });

    Route::get('/orders/history', [OrderController::class, 'history']);

    // ── Shopper Routes ───────────────────────────────────────────────────────
    Route::middleware('role:shopper')->group(function () {
        Route::get('/shop', [OrderController::class, 'shop']);
        Route::post('/orders', [OrderController::class, 'store']);
    });

    // ── Rider Routes ─────────────────────────────────────────────────────────
    Route::middleware('role:rider')->group(function () {
        Route::get('/rider/orders', [RiderController::class, 'availableOrders']);
        Route::post('/rider/orders/{id}/accept', [RiderController::class, 'acceptOrder']);
        Route::post('/rider/orders/{id}/decline', [RiderController::class, 'declineOrder']);
        Route::post('/rider/orders/{id}/complete', [RiderController::class, 'completeDelivery']);
        Route::get('/rider/my-deliveries', [RiderController::class, 'myDeliveries']);
    });
});
