<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FileManagementController;
use App\Http\Controllers\PotholeController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::post('dashboard/load-file/{id}', [DashboardController::class, 'loadFile'])->name('dashboard.loadFile');
    
    // Pothole CRUD
    Route::put('potholes/{id}', [PotholeController::class, 'update'])->name('potholes.update');
    Route::delete('potholes/{id}', [PotholeController::class, 'destroy'])->name('potholes.destroy');
    Route::get('potholes/export', [PotholeController::class, 'export'])->name('potholes.export');
    
    // File Management Routes
    Route::get('files', [FileManagementController::class, 'index'])->name('files.index');
    Route::post('files/upload', [FileManagementController::class, 'upload'])->name('files.upload');
    Route::post('files/{id}/import', [FileManagementController::class, 'import'])->name('files.import');
    Route::delete('files/{id}', [FileManagementController::class, 'delete'])->name('files.delete');
    Route::get('files/{id}/download', [FileManagementController::class, 'download'])->name('files.download');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
