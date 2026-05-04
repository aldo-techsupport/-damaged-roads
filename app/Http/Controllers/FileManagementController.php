<?php

namespace App\Http\Controllers;

use App\Models\Pothole;
use App\Models\PotholeFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class FileManagementController extends Controller
{
    public function index()
    {
        $files = PotholeFile::with('uploader')
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('file-management', [
            'files' => $files,
        ]);
    }

    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:tsv,txt,csv|max:10240', // Max 10MB
        ]);

        $file = $request->file('file');
        $originalName = $file->getClientOriginalName();
        $filename = time() . '_' . $originalName;
        
        // Simpan file ke storage/app/pothole-files
        $path = $file->storeAs('pothole-files', $filename);

        // Hitung jumlah baris (minus header)
        $content = Storage::get($path);
        $lines = explode("\n", trim($content));
        $totalRecords = count($lines) - 1; // Minus header

        // Simpan info file ke database
        $potholeFile = PotholeFile::create([
            'filename' => $filename,
            'original_filename' => $originalName,
            'file_path' => $path,
            'total_records' => $totalRecords,
            'uploaded_by' => auth()->id(),
        ]);

        return redirect()->back()->with('success', "File berhasil diupload! Total {$totalRecords} records.");
    }

    public function import($id)
    {
        $potholeFile = PotholeFile::findOrFail($id);

        // Hapus data lama
        Pothole::truncate();

        // Reset semua file ke not imported
        PotholeFile::query()->update(['is_imported' => false, 'imported_at' => null]);

        // Baca file
        $content = Storage::get($potholeFile->file_path);
        $lines = explode("\n", $content);
        
        $imported = 0;
        $skipped = 0;
        $isFirstLine = true;

        foreach ($lines as $lineNumber => $line) {
            // Skip empty lines
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            // Skip header
            if ($isFirstLine) {
                $isFirstLine = false;
                continue;
            }

            // Parse TSV line
            $data = str_getcsv($line, "\t");
            
            // Validate data has minimum required columns
            if (count($data) >= 6) {
                try {
                    Pothole::create([
                        'latitude' => trim($data[1]),
                        'longitude' => trim($data[2]),
                        'gforce' => trim($data[3]),
                        'recorded_at' => trim($data[4]),
                        'maps_link' => trim($data[5]),
                    ]);
                    $imported++;
                } catch (\Exception $e) {
                    $skipped++;
                    \Log::warning("Failed to import line {$lineNumber}: " . $e->getMessage());
                }
            } else {
                $skipped++;
            }
        }

        // Update status file
        $potholeFile->update([
            'is_imported' => true,
            'imported_at' => now(),
        ]);

        $message = "Berhasil import {$imported} data ke dashboard!";
        if ($skipped > 0) {
            $message .= " ({$skipped} baris dilewati)";
        }

        return redirect()->back()->with('success', $message);
    }

    public function delete($id)
    {
        $potholeFile = PotholeFile::findOrFail($id);

        // Hapus file dari storage
        Storage::delete($potholeFile->file_path);

        // Hapus record dari database
        $potholeFile->delete();

        return redirect()->back()->with('success', 'File berhasil dihapus!');
    }

    public function download($id)
    {
        $potholeFile = PotholeFile::findOrFail($id);

        return Storage::download($potholeFile->file_path, $potholeFile->original_filename);
    }
}
