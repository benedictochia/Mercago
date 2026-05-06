<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;

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
        $validated = $request->validate([
            'product_name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'unit' => ['required', 'string', 'max:50'],
            'stock_qty' => ['required', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $validated['vendor_id'] = (string) $request->user()->id;

        if ($request->hasFile('image')) {
            $validated['image'] = $this->uploadToCloudinary($request->file('image')->getRealPath(), 'products');
        }

        $product = Product::create($validated);

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $product,
        ], 201);
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
            'stock_qty' => ['sometimes', 'required', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            // Optional: delete old image if needed, but for now we just overwrite the DB field
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

        $product->delete();

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }

    /**
     * Upload a file to Cloudinary using explicit credentials from env vars.
     */
    private function uploadToCloudinary(string $filePath, string $folder): string
    {
        $cloudinary = new Cloudinary(
            Configuration::instance([
                'cloud' => [
                    'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
                    'api_key'    => env('CLOUDINARY_KEY'),
                    'api_secret' => env('CLOUDINARY_SECRET'),
                ],
                'url' => ['secure' => true],
            ])
        );

        $result = $cloudinary->uploadApi()->upload($filePath, ['folder' => $folder]);

        return $result['secure_url'];
    }
}
