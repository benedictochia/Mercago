<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Cloudinary\Cloudinary;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        // Only return products that belong to the currently authenticated vendor.
        $products = Product::where('vendor_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json($products);
    }

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'product_name' => ['required', 'string', 'max:255'],
                'category' => ['required', 'string', 'max:100'],
                'price' => ['required', 'numeric', 'min:0'],
                'unit' => ['required', 'string', 'max:50'],
                'stock_qty' => ['required', 'numeric', 'min:0'],
                'image' => ['nullable', 'image', 'max:5120'],
            ]);

            $validated['vendor_id'] = (string) $request->user()->id;

            if ($request->hasFile('image')) {
                $validated['image'] = $this->uploadToCloudinary($request->file('image')->getRealPath(), 'products');
            }

            $product = Product::create($validated);

            // Log the activity
            \App\Models\ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'create_product',
                'description' => "Vendor added a new product: {$product->product_name}."
            ]);

            return response()->json([
                'message' => 'Product created successfully.',
                'data' => $product,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e; // Let Laravel handle validation errors with structured field-level response
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, string $id)
    {
        $product = Product::where('id', $id)->firstOrFail();

        if ((string) $product->vendor_id !== (string) $request->user()->id) {
            return response()->json([
                'message' => 'You are not allowed to update this product.',
            ], 403);
        }

        $validated = $request->validate([
            'product_name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['sometimes', 'required', 'string', 'max:100'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'unit' => ['sometimes', 'required', 'string', 'max:50'],
            'stock_qty' => ['sometimes', 'required', 'numeric', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            // Delete old image from Cloudinary
            if ($product->image) {
                $this->deleteFromCloudinary($product->image);
            }
            $validated['image'] = $this->uploadToCloudinary($request->file('image')->getRealPath(), 'products');
        }

        $product->update($validated);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product,
        ]);
    }

    public function destroy(Request $request, string $id)
    {
        $product = Product::where('id', $id)->firstOrFail();

        if ((string) $product->vendor_id !== (string) $request->user()->id) {
            return response()->json([
                'message' => 'You are not allowed to delete this product.',
            ], 403);
        }

        // Delete image from Cloudinary before deleting product
        if ($product->image) {
            $this->deleteFromCloudinary($product->image);
        }

        $productName = $product->product_name;
        $product->delete();

        // Log the activity
        \App\Models\ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'delete_product',
            'description' => "Vendor deleted product: {$productName}."
        ]);

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }

    /**
     * Upload a file to Cloudinary using explicit credentials from env vars.
     */
    private function uploadToCloudinary(string $filePath, string $folder): string
    {
        $cloudinary = new Cloudinary(config('cloudinary.cloud_url'));

        $result = $cloudinary->uploadApi()->upload($filePath, ['folder' => $folder]);

        // Insert optimization transformations (WebP, auto-quality, max-width) into the URL
        return str_replace('/upload/', '/upload/q_auto,f_auto,w_800,c_limit/', $result['secure_url']);
    }

    /**
     * Delete an image from Cloudinary using its URL.
     */
    private function deleteFromCloudinary(string $url): void
    {
        try {
            // Extract public_id (e.g., 'products/filename' or 'banners/filename')
            if (preg_match('/(products\/[^\.]+)/', $url, $matches)) {
                $publicId = $matches[1];
                $cloudinary = new Cloudinary(config('cloudinary.cloud_url'));
                $cloudinary->uploadApi()->destroy($publicId);
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Failed to delete from Cloudinary: " . $e->getMessage());
        }
    }
}
