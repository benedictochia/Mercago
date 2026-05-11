<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * GET /api/reports/activity
     * Generates a report of user activity logs.
     * EXPLICITLY uses Query Builder Joins for academic demonstration (Task 4).
     */
    public function getActivityLogs()
    {
        // Using an explicit INNER JOIN to combine users and activity_logs
        $logs = \Illuminate\Support\Facades\DB::table('activity_logs')
            ->join('users', 'users.id', '=', 'activity_logs.user_id')
            ->select(
                'activity_logs.id',
                'users.first_name',
                'users.last_name',
                'users.role',
                'activity_logs.action',
                'activity_logs.description',
                'activity_logs.created_at'
            )
            ->orderBy('activity_logs.created_at', 'desc')
            ->get();

        return response()->json($logs);
    }
}
