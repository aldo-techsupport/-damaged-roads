<?php

namespace App\Http\Controllers;

use App\Models\Pothole;
use Illuminate\Http\Request;

class PotholeController extends Controller
{
    public function update(Request $request, $id)
    {
        $pothole = Pothole::findOrFail($id);
        
        $validated = $request->validate([
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'gforce' => 'required|numeric',
            'recorded_at' => 'required|date',
        ]);

        // Update data
        $pothole->latitude = $validated['latitude'];
        $pothole->longitude = $validated['longitude'];
        $pothole->gforce = $validated['gforce'];
        $pothole->recorded_at = $validated['recorded_at'];
        
        // Auto-generate maps_link dari koordinat baru
        $pothole->maps_link = "https://maps.google.com/?q={$validated['latitude']},{$validated['longitude']}";
        
        $pothole->save();

        return redirect()->back()->with('success', 'Data berhasil diupdate! Link Google Maps sudah disesuaikan.');
    }

    public function destroy($id)
    {
        $pothole = Pothole::findOrFail($id);
        $pothole->delete();

        return redirect()->back()->with('success', 'Data berhasil dihapus!');
    }

    public function export()
    {
        $potholes = Pothole::orderBy('recorded_at', 'desc')->get();
        
        $filename = 'potholes_' . date('Y-m-d_His') . '.tsv';
        
        $content = "id\tlatitude\tlongitude\tgforce\ttimestamp\tmaps_link\n";
        
        foreach ($potholes as $pothole) {
            $content .= "{$pothole->id}\t{$pothole->latitude}\t{$pothole->longitude}\t{$pothole->gforce}\t{$pothole->recorded_at}\t{$pothole->maps_link}\n";
        }
        
        return response($content)
            ->header('Content-Type', 'text/tab-separated-values')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }
}
