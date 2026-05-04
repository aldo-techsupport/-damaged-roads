<?php

namespace App\Http\Controllers;

use App\Models\Pothole;
use App\Models\PotholeFile;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        // Ambil file yang sedang aktif (terakhir diimport)
        $activeFile = PotholeFile::where('is_imported', true)
            ->orderBy('imported_at', 'desc')
            ->first();
        
        // Hanya ambil data potholes jika ada file aktif
        $potholes = $activeFile 
            ? Pothole::orderBy('recorded_at', 'desc')->get()
            : collect([]);
        
        // Ambil semua file yang sudah diupload
        $files = PotholeFile::with('uploader')
            ->orderBy('created_at', 'desc')
            ->get();
        
        return Inertia::render('dashboard-leaflet', [
            'potholes' => $potholes,
            'files' => $files,
            'activeFile' => $activeFile,
        ]);
    }
    
    public function loadFile($id)
    {
        $potholeFile = PotholeFile::findOrFail($id);

        // Hapus data lama
        Pothole::truncate();

        // Baca file
        $content = \Storage::get($potholeFile->file_path);
        $lines = explode("\n", trim($content));
        
        $imported = 0;
        $isFirstLine = true;

        foreach ($lines as $line) {
            // Skip header
            if ($isFirstLine) {
                $isFirstLine = false;
                continue;
            }

            // Parse TSV line
            $data = str_getcsv($line, "\t");
            
            if (count($data) >= 6) {
                Pothole::create([
                    'latitude' => $data[1],
                    'longitude' => $data[2],
                    'gforce' => $data[3],
                    'recorded_at' => $data[4],
                    'maps_link' => $data[5],
                ]);
                $imported++;
            }
        }

        // Reset semua file ke not imported
        PotholeFile::query()->update(['is_imported' => false, 'imported_at' => null]);
        
        // Update status file yang dipilih
        $potholeFile->update([
            'is_imported' => true,
            'imported_at' => now(),
        ]);

        return redirect()->back()->with('success', "Berhasil load {$imported} data dari {$potholeFile->original_filename}!");
    }
}
