import { Head, router, useForm } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, Upload as UploadIcon, FolderOpen, CheckCircle2, Edit, Trash2, Download } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Pothole {
    id: number;
    latitude: string;
    longitude: string;
    gforce: string;
    recorded_at: string;
    maps_link: string;
}

interface PotholeFile {
    id: number;
    filename: string;
    original_filename: string;
    total_records: number;
    is_imported: boolean;
    imported_at: string | null;
    created_at: string;
    uploader: {
        name: string;
    };
}

interface DashboardProps {
    potholes: Pothole[];
    files: PotholeFile[];
    activeFile: PotholeFile | null;
}

export default function Dashboard({ potholes, files, activeFile }: DashboardProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<any>(null);
    const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);
    const [leaflet, setLeaflet] = useState<any>(null);
    const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingPothole, setEditingPothole] = useState<Pothole | null>(null);
    const [markers, setMarkers] = useState<Map<number, any>>(new Map());
    const [activeMarkerId, setActiveMarkerId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [severityFilter, setSeverityFilter] = useState<'all' | 'severe' | 'moderate' | 'mild'>('all');
    const itemsPerPage = 20;

    const { data, setData, put, processing } = useForm({
        latitude: '',
        longitude: '',
        gforce: '',
        recorded_at: '',
    });

    const handleFileSelect = (fileId: number) => {
        setIsFileDialogOpen(false);
        router.post(`/dashboard/load-file/${fileId}`);
    };

    const handleUploadClick = () => {
        setIsFileDialogOpen(false);
        router.visit('/files');
    };

    const handleEdit = (pothole: Pothole) => {
        setEditingPothole(pothole);
        setData({
            latitude: pothole.latitude,
            longitude: pothole.longitude,
            gforce: pothole.gforce,
            recorded_at: pothole.recorded_at.split('T')[0] + ' ' + pothole.recorded_at.split('T')[1].split('.')[0],
        });
        setIsEditDialogOpen(true);
    };

    const handleEditFromSidebar = () => {
        if (selectedPothole) {
            handleEdit(selectedPothole);
        }
    };

    const handleDeleteFromSidebar = () => {
        if (selectedPothole) {
            handleDelete(selectedPothole.id);
        }
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPothole) {
            put(`/potholes/${editingPothole.id}`, {
                onSuccess: () => {
                    setIsEditDialogOpen(false);
                    setEditingPothole(null);
                },
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus data ini? Aksi tidak dapat dibatalkan.')) {
            router.delete(`/potholes/${id}`);
        }
    };

    const handleDownload = () => {
        window.location.href = '/potholes/export';
    };

    // Filter function to check if pothole matches current filter
    const matchesFilter = (pothole: Pothole) => {
        if (severityFilter === 'all') return true;
        
        const gforce = parseFloat(pothole.gforce);
        if (severityFilter === 'severe') return gforce >= 1.15;
        if (severityFilter === 'moderate') return gforce >= 1.05 && gforce < 1.15;
        if (severityFilter === 'mild') return gforce < 1.05;
        return true;
    };

    useEffect(() => {
        // Load Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Add custom CSS to fix z-index and add marker animations
        const style = document.createElement('style');
        style.textContent = `
            .leaflet-pane,
            .leaflet-tile,
            .leaflet-marker-icon,
            .leaflet-marker-shadow,
            .leaflet-tile-container,
            .leaflet-pane > svg,
            .leaflet-pane > canvas,
            .leaflet-zoom-box,
            .leaflet-image-layer,
            .leaflet-layer {
                z-index: 1 !important;
            }
            .leaflet-top,
            .leaflet-bottom {
                z-index: 10 !important;
            }
            
            /* Marker active state animation */
            .custom-marker.active > div {
                animation: pulse 1.5s ease-in-out infinite;
                transform: scale(1.3);
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7), 0 4px 8px rgba(0,0,0,0.4) !important;
                border-width: 4px !important;
                z-index: 1000 !important;
            }
            
            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7), 0 4px 8px rgba(0,0,0,0.4);
                }
                50% {
                    box-shadow: 0 0 0 10px rgba(255, 255, 255, 0), 0 4px 8px rgba(0,0,0,0.4);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0), 0 4px 8px rgba(0,0,0,0.4);
                }
            }
            
            .custom-marker > div {
                transition: all 0.3s ease;
            }
        `;
        document.head.appendChild(style);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            const L = (window as any).L;
            setLeaflet(L);

            if (mapRef.current && potholes.length > 0) {
                // Initialize map only once with zoom controls
                const leafletMap = L.map(mapRef.current, {
                    center: [-1.15, 114.6],
                    zoom: 11,
                    zoomControl: true,
                    scrollWheelZoom: true,
                    doubleClickZoom: true,
                    touchZoom: true,
                });

                // Add OpenStreetMap tiles (FREE!)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution:
                        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19,
                    minZoom: 3,
                }).addTo(leafletMap);

                setMap(leafletMap);
            }
        };

        return () => {
            if (map) {
                map.remove();
            }
        };
    }, [potholes.length]);

    // Update markers when filter changes - but keep ALL markers, just hide/show them
    useEffect(() => {
        if (!map || !leaflet || potholes.length === 0) return;

        // Clear existing markers
        markers.forEach((marker) => {
            map.removeLayer(marker);
        });

        // Store markers in a Map for later reference
        const markersMap = new Map<number, any>();

        // Add markers for ALL potholes (not filtered)
        potholes.forEach((pothole) => {
            const lat = parseFloat(pothole.latitude);
            const lng = parseFloat(pothole.longitude);
            const gforce = parseFloat(pothole.gforce);

            // Check if this pothole matches the current filter
            const isVisible = matchesFilter(pothole);
            
            // Skip creating marker if not visible
            if (!isVisible) return;

            // Create custom icon with color
            const color = getColorByGforce(gforce);
            const icon = leaflet.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${color};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            });

            const marker = leaflet.marker([lat, lng], { icon }).addTo(map);

            // Store marker reference
            markersMap.set(pothole.id, marker);

            // Add popup
            marker.bindPopup(`
                <div style="min-width: 200px;">
                    <strong>Pothole #${pothole.id}</strong><br/>
                    <span style="color: ${color}; font-weight: bold;">
                        ${getSeverityLabel(gforce)} (${gforce})
                    </span><br/>
                    <small>${new Date(pothole.recorded_at).toLocaleString()}</small><br/>
                    <a href="${pothole.maps_link}" target="_blank" style="color: #2563eb;">
                        Buka di Google Maps →
                    </a>
                </div>
            `);

            // Add click listener
            marker.on('click', () => {
                // Remove active class from all markers
                markersMap.forEach((m) => {
                    const element = m.getElement();
                    if (element) {
                        element.classList.remove('active');
                    }
                });

                // Add active class to clicked marker
                const element = marker.getElement();
                if (element) {
                    element.classList.add('active');
                }

                setSelectedPothole(pothole);
                setActiveMarkerId(pothole.id);
            });
        });

        // Save markers to state
        setMarkers(markersMap);

        // Calculate bounds only for visible markers
        const visiblePotholes = potholes.filter(matchesFilter);
        if (visiblePotholes.length > 0) {
            const bounds: [number, number][] = visiblePotholes.map((pothole) => [
                parseFloat(pothole.latitude),
                parseFloat(pothole.longitude),
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [map, leaflet, severityFilter, potholes]);

    const getColorByGforce = (gforce: number): string => {
        if (gforce >= 1.15) return '#ef4444'; // red - severe
        if (gforce >= 1.05) return '#f97316'; // orange - moderate
        return '#eab308'; // yellow - mild
    };

    const getSeverityLabel = (gforce: number): string => {
        if (gforce >= 1.15) return 'Parah';
        if (gforce >= 1.05) return 'Sedang';
        return 'Ringan';
    };

    const getSeverityColor = (gforce: number): 'destructive' | 'default' | 'secondary' => {
        if (gforce >= 1.15) return 'destructive';
        if (gforce >= 1.05) return 'default';
        return 'secondary';
    };

    const openInGoogleMaps = (pothole: Pothole) => {
        window.open(pothole.maps_link, '_blank');
    };

    const focusOnMap = (pothole: Pothole) => {
        if (map && leaflet) {
            const lat = parseFloat(pothole.latitude);
            const lng = parseFloat(pothole.longitude);
            map.setView([lat, lng], 16);
            setSelectedPothole(pothole);

            // Remove active class from all markers
            markers.forEach((marker) => {
                const element = marker.getElement();
                if (element) {
                    element.classList.remove('active');
                }
            });

            // Add active class to the selected marker
            const selectedMarker = markers.get(pothole.id);
            if (selectedMarker) {
                const element = selectedMarker.getElement();
                if (element) {
                    element.classList.add('active');
                }
                // Open popup
                selectedMarker.openPopup();
            }

            setActiveMarkerId(pothole.id);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={[{ label: 'Dashboard' }]}>
            <Head title="Dashboard - Deteksi Lubang Jalan" />

            <div className="space-y-6">
                <Heading 
                    title="Dashboard Deteksi Lubang Jalan"
                    description="Monitoring dan visualisasi lokasi lubang jalan yang terdeteksi"
                />

                {/* File Selector Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">
                                        {activeFile ? activeFile.original_filename : 'Belum ada file dipilih'}
                                    </p>
                                    {activeFile && (
                                        <p className="text-xs text-muted-foreground">
                                            {activeFile.total_records} records • Diimport: {new Date(activeFile.imported_at!).toLocaleString('id-ID')}
                                        </p>
                                    )}
                                </div>
                                {activeFile && (
                                    <Badge variant="default">
                                        {activeFile.total_records} data aktif
                                    </Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {activeFile && potholes.length > 0 && (
                                    <Button variant="outline" size="sm" onClick={handleDownload}>
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Data
                                    </Button>
                                )}
                                <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <FolderOpen className="w-4 h-4 mr-2" />
                                            Pilih File Data
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Pilih File Data</DialogTitle>
                                        <DialogDescription>
                                            Pilih file untuk ditampilkan di dashboard. Data lama akan diganti dengan data dari file yang dipilih.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-3 mt-4">
                                        {files.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                                                <p className="text-muted-foreground mb-4">Belum ada file yang diupload</p>
                                                <Button onClick={handleUploadClick}>
                                                    <UploadIcon className="w-4 h-4 mr-2" />
                                                    Upload File Baru
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                {files.map((file) => (
                                                    <div
                                                        key={file.id}
                                                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all hover:border-primary hover:bg-accent ${
                                                            file.is_imported ? 'border-primary bg-primary/5' : ''
                                                        }`}
                                                        onClick={() => handleFileSelect(file.id)}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1">
                                                            <div className={`p-2 rounded-lg ${file.is_imported ? 'bg-primary/10' : 'bg-muted'}`}>
                                                                <FileText className={`w-5 h-5 ${file.is_imported ? 'text-primary' : 'text-muted-foreground'}`} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-medium">{file.original_filename}</h4>
                                                                    {file.is_imported && (
                                                                        <Badge variant="default" className="gap-1">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Aktif
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                                                    <span>{file.total_records} records</span>
                                                                    <span>•</span>
                                                                    <span>Upload: {new Date(file.created_at).toLocaleDateString('id-ID')}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {!file.is_imported && (
                                                            <Button size="sm" variant="outline">
                                                                Load Data
                                                            </Button>
                                                        )}
                                                    </div>
                                                ))}

                                                <div className="pt-3 border-t">
                                                    <Button 
                                                        variant="outline" 
                                                        className="w-full"
                                                        onClick={handleUploadClick}
                                                    >
                                                        <UploadIcon className="w-4 h-4 mr-2" />
                                                        Upload File Baru
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Lubang</CardTitle>
                            <CardDescription>Lokasi terdeteksi</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {activeFile ? potholes.length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Parah</CardTitle>
                            <CardDescription>G-Force ≥ 1.15</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">
                                {activeFile ? potholes.filter((p) => parseFloat(p.gforce) >= 1.15).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Sedang</CardTitle>
                            <CardDescription>G-Force 1.05 - 1.14</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-600">
                                {activeFile ? potholes.filter((p) => {
                                    const gforce = parseFloat(p.gforce);
                                    return gforce >= 1.05 && gforce < 1.15;
                                }).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Kondisi Ringan</CardTitle>
                            <CardDescription>G-Force &lt; 1.05</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-yellow-600">
                                {activeFile ? potholes.filter((p) => parseFloat(p.gforce) < 1.05).length : 0}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Deteksi Terakhir</CardTitle>
                            <CardDescription>Paling baru</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm">
                                {activeFile && potholes.length > 0
                                    ? new Date(potholes[0].recorded_at).toLocaleString('id-ID')
                                    : 'Tidak ada data'}
                            </div>
                            {!activeFile && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Pilih file untuk melihat data
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {potholes.length === 0 ? (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center">
                                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Belum Ada Data</h3>
                                <p className="text-muted-foreground mb-4">
                                    Pilih file dari dropdown di atas atau upload file baru untuk menampilkan peta
                                </p>
                                <Button onClick={() => router.visit('/files')}>
                                    <UploadIcon className="w-4 h-4 mr-2" />
                                    Upload File
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                <>
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Peta Lokasi</CardTitle>
                            <CardDescription>
                                Klik marker untuk detail. Warna: 🔴 Parah, 🟠 Sedang, 🟡 Ringan
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div ref={mapRef} className="w-full h-[600px] rounded-lg border relative z-0" />
                            <p className="text-xs text-muted-foreground mt-2">
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>
                                {selectedPothole ? `Lubang #${selectedPothole.id}` : 'Pilih Marker'}
                            </CardTitle>
                            <CardDescription>
                                {selectedPothole ? 'Detail Informasi' : 'Klik marker untuk melihat detail'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedPothole ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Tingkat Keparahan</div>
                                        <Badge
                                            variant={getSeverityColor(parseFloat(selectedPothole.gforce))}
                                            className="mt-1"
                                        >
                                            {getSeverityLabel(parseFloat(selectedPothole.gforce))}
                                        </Badge>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">G-Force</div>
                                        <div className="text-lg font-semibold">{selectedPothole.gforce}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Koordinat</div>
                                        <div className="text-sm">
                                            Lat: {selectedPothole.latitude}
                                            <br />
                                            Lng: {selectedPothole.longitude}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Waktu Deteksi</div>
                                        <div className="text-sm">
                                            {new Date(selectedPothole.recorded_at).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Button        onClick={() => openInGoogleMaps(selectedPothole)}
                                            className="w-full"
                                            variant="default"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Buka di Google Maps
                                        </Button>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleEditFromSidebar}
                                                className="flex-1"
                                                variant="outline"
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                onClick={handleDeleteFromSidebar}
                                                className="flex-1"
                                                variant="destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Hapus
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">
                                    Klik marker di peta untuk melihat informasi detail tentang lubang jalan tersebut.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Deteksi Terbaru</CardTitle>
                                <CardDescription>
                                    Menampilkan {Math.min(itemsPerPage, potholes.filter(matchesFilter).length - (currentPage - 1) * itemsPerPage)} dari {potholes.filter(matchesFilter).length} lubang jalan
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant={severityFilter === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('all');
                                        setCurrentPage(1);
                                    }}
                                >
                                    Semua
                                </Button>
                                <Button
                                    variant={severityFilter === 'severe' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('severe');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'severe' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    Parah
                                </Button>
                                <Button
                                    variant={severityFilter === 'moderate' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('moderate');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'moderate' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                                >
                                    Sedang
                                </Button>
                                <Button
                                    variant={severityFilter === 'mild' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setSeverityFilter('mild');
                                        setCurrentPage(1);
                                    }}
                                    className={severityFilter === 'mild' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                                >
                                    Ringan
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {potholes
                                .filter(matchesFilter)
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                .map((pothole) => (
                                <div
                                    key={pothole.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                    onClick={() => focusOnMap(pothole)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor: getColorByGforce(parseFloat(pothole.gforce)),
                                            }}
                                        />
                                        <div>
                                            <div className="font-medium">Lubang #{pothole.id}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {pothole.latitude}, {pothole.longitude}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <div>
                                            <Badge variant={getSeverityColor(parseFloat(pothole.gforce))}>
                                                {pothole.gforce}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {new Date(pothole.recorded_at).toLocaleDateString('id-ID')}
                                            </div>
                                        </div>
                                        <Button
                                            key={`edit-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(pothole);
                                            }}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            key={`maps-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openInGoogleMaps(pothole);
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            key={`delete-${pothole.id}`}
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(pothole.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Pagination */}
                        {potholes.filter(matchesFilter).length > itemsPerPage && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground">
                                    Halaman {currentPage} dari {Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage)}
                                </div>
                                <div className="flex gap-1">
                                    {/* Previous button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                    >
                                        ‹
                                    </Button>
                                    
                                    {/* Page numbers */}
                                    {(() => {
                                        const totalPages = Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage);
                                        const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter((page) => {
                                                // Show first page, last page, current page, and pages around current
                                                if (page === 1 || page === totalPages) return true;
                                                if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                                                return false;
                                            });
                                        
                                        const elements: JSX.Element[] = [];
                                        pages.forEach((page, index) => {
                                            // Add ellipsis if there's a gap
                                            const prevPage = pages[index - 1];
                                            if (prevPage && page - prevPage > 1) {
                                                elements.push(
                                                    <span key={`ellipsis-${prevPage}-${page}`} className="px-2 py-1 text-sm text-muted-foreground">
                                                        ...
                                                    </span>
                                                );
                                            }
                                            
                                            elements.push(
                                                <Button
                                                    key={`page-${page}`}
                                                    variant={currentPage === page ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setCurrentPage(page)}
                                                    className="min-w-[2.5rem]"
                                                >
                                                    {page}
                                                </Button>
                                            );
                                        });
                                        
                                        return elements;
                                    })()}
                                    
                                    {/* Next button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        disabled={currentPage === Math.ceil(potholes.filter(matchesFilter).length / itemsPerPage)}
                                    >
                                        ›
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </>
                )}

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Data Lubang</DialogTitle>
                            <DialogDescription>
                                Edit informasi lubang jalan #{editingPothole?.id}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <Label htmlFor="latitude">Latitude</Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    value={data.latitude}
                                    onChange={(e) => setData('latitude', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="longitude">Longitude</Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    value={data.longitude}
                                    onChange={(e) => setData('longitude', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="gforce">G-Force</Label>
                                <Input
                                    id="gforce"
                                    type="number"
                                    step="any"
                                    value={data.gforce}
                                    onChange={(e) => setData('gforce', e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="recorded_at">Waktu Deteksi</Label>
                                <Input
                                    id="recorded_at"
                                    type="datetime-local"
                                    value={data.recorded_at}
                                    onChange={(e) => setData('recorded_at', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppSidebarLayout>
    );
}
