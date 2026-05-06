<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'contact_no' => ['required', 'string', 'max:20'],
            'age' => ['required', 'integer', 'min:1'],
            'sex' => ['required', 'string', 'max:10'],
            'address' => ['required', 'string'],
            'role' => ['required', 'string', 'max:50'],
        ]);

        // Explicit bcrypt hashing for task requirement.
        $validated['password'] = Hash::make($validated['password']);

        $user = User::create($validated);
        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully.',
            'token' => $token,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function updateBanner(Request $request)
    {
        $request->validate([
            'banner' => ['required', 'image', 'max:5120'], // 5MB max
        ]);

        $user = $request->user();

        if ($request->hasFile('banner')) {
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
            $result = $cloudinary->uploadApi()->upload($request->file('banner')->getRealPath(), ['folder' => 'banners']);
            $user->banner_url = $result['secure_url'];
            $user->save();
        }

        return response()->json([
            'message' => 'Banner updated successfully.',
            'user' => $user,
        ]);
    }

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:50'],
            'last_name' => ['required', 'string', 'max:100'],
            'contact_no' => ['required', 'string', 'max:20'],
            'age' => ['required', 'integer', 'min:1'],
            'sex' => ['required', 'string', 'max:10'],
            'address' => ['required', 'string'],
        ]);

        $user = $request->user();
        $user->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user,
        ]);
    }
}
