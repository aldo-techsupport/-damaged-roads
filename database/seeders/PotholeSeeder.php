<?php

namespace Database\Seeders;

use App\Models\Pothole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class PotholeSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run(): void
    {
        // Read the TSV file
        $tsvFile = base_path('potholes (uji coba).tsv');
        
        if (!File::exists($tsvFile)) {
            $this->command->error('TSV file not found!');
            return;
        }

        $lines = File::lines($tsvFile);
        $isFirstLine = true;

        foreach ($lines as $line) {
            // Skip header line
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
            }
        }

        $this->command->info('Potholes data imported successfully!');
    }
}
