<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PotholeFile extends Model
{
    protected $fillable = [
        'filename',
        'original_filename',
        'file_path',
        'total_records',
        'is_imported',
        'imported_at',
        'uploaded_by',
    ];

    protected $casts = [
        'is_imported' => 'boolean',
        'imported_at' => 'datetime',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
