<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pothole extends Model
{
    protected $fillable = [
        'latitude',
        'longitude',
        'gforce',
        'recorded_at',
        'maps_link',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'gforce' => 'decimal:3',
    ];
}
